const { Server } = require('socket.io');
const http = require('http');
const jwt = require('jsonwebtoken');
const Redis = require('ioredis');

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';
const PORT = process.env.WEBSOCKET_PORT || 3001;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL);
const redisSub = new Redis(REDIS_URL);

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:19006'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Room namespaces
const ROOMS = {
  DISPATCHERS: 'dispatchers',
  DRIVERS: 'drivers',
  HOSPITALS: 'hospitals',
  INCIDENTS: (id) => `incident:${id}`,
  AMBULANCES: (id) => `ambulance:${id}`,
  ZONES: (zone) => `zone:${zone}`
};

// Authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      socket.data.user = { role: 'CITIZEN', anonymous: true };
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    socket.data.user = decoded;
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  console.log(`Client connected: ${socket.id} (${user.role})`);

  // Join role-based rooms
  if (user.role === 'DISPATCHER') {
    socket.join(ROOMS.DISPATCHERS);
  } else if (user.role === 'DRIVER' && user.ambulance_id) {
    socket.join(ROOMS.DRIVERS);
    socket.join(ROOMS.AMBULANCES(user.ambulance_id));
  } else if (user.role === 'HOSPITAL_STAFF' && user.hospital_id) {
    socket.join(ROOMS.HOSPITALS);
    socket.join(`hospital:${user.hospital_id}`);
  }

  // Subscribe to incident
  socket.on('incident:subscribe', (incidentId) => {
    socket.join(ROOMS.INCIDENTS(incidentId));
    console.log(`${socket.id} subscribed to incident ${incidentId}`);
  });

  socket.on('incident:unsubscribe', (incidentId) => {
    socket.leave(ROOMS.INCIDENTS(incidentId));
  });

  // Driver location updates
  socket.on('driver:location', async (data) => {
    if (user.role !== 'DRIVER') return;
    
    const { latitude, longitude, heading, speed } = data;
    const locationData = {
      ambulance_id: user.ambulance_id,
      latitude,
      longitude,
      heading,
      speed,
      timestamp: new Date().toISOString()
    };

    await redis.setex(
      `ambulance:location:${user.ambulance_id}`,
      30,
      JSON.stringify(locationData)
    );

    await redis.publish('ambulance:locations', JSON.stringify(locationData));

    io.to(ROOMS.DISPATCHERS).emit('ambulance:location', locationData);

    if (user.active_incident_id) {
      io.to(ROOMS.INCIDENTS(user.active_incident_id)).emit('ambulance:location', locationData);
    }
  });

  // Driver status update
  socket.on('driver:status', async (data) => {
    if (user.role !== 'DRIVER') return;
    
    const statusData = {
      ambulance_id: user.ambulance_id,
      status: data.status,
      timestamp: new Date().toISOString()
    };

    await redis.publish('ambulance:status', JSON.stringify(statusData));
    io.to(ROOMS.DISPATCHERS).emit('ambulance:status', statusData);
  });

  // Assignment acceptance
  socket.on('assignment:accept', async (data) => {
    if (user.role !== 'DRIVER') return;
    
    await redis.publish('assignment:accepted', JSON.stringify({
      assignment_id: data.assignment_id,
      ambulance_id: user.ambulance_id,
      driver_id: user.id
    }));

    io.to(ROOMS.DISPATCHERS).emit('assignment:accepted', data);
    io.to(ROOMS.INCIDENTS(data.incident_id)).emit('assignment:accepted', data);
  });

  // Assignment rejection
  socket.on('assignment:reject', async (data) => {
    if (user.role !== 'DRIVER') return;
    
    await redis.publish('assignment:rejected', JSON.stringify({
      assignment_id: data.assignment_id,
      ambulance_id: user.ambulance_id,
      reason: data.reason
    }));

    io.to(ROOMS.DISPATCHERS).emit('assignment:rejected', data);
  });

  // Hospital capacity update
  socket.on('hospital:capacity', async (data) => {
    if (user.role !== 'HOSPITAL_STAFF') return;
    
    const capacityData = {
      hospital_id: user.hospital_id,
      ...data,
      timestamp: new Date().toISOString()
    };

    await redis.publish('hospital:capacity', JSON.stringify(capacityData));
    io.to(ROOMS.DISPATCHERS).emit('hospital:capacity', capacityData);
  });

  // Green corridor activation
  socket.on('greenCorridor:activate', (data) => {
    io.to(ROOMS.DISPATCHERS).emit('greenCorridor:activated', data);
  });

  socket.on('disconnect', (reason) => {
    console.log(`Client disconnected: ${socket.id} (${reason})`);
  });
});

// Subscribe to Redis channels
redisSub.subscribe(
  'incident:created',
  'incident:updated',
  'assignment:created',
  'assignment:updated',
  'hospital:alert',
  'greenCorridor:status'
);

redisSub.on('message', (channel, message) => {
  try {
    const data = JSON.parse(message);
    
    switch (channel) {
      case 'incident:created':
        io.to(ROOMS.DISPATCHERS).emit('incident:created', data);
        break;
        
      case 'incident:updated':
        io.to(ROOMS.DISPATCHERS).emit('incident:updated', data);
        io.to(ROOMS.INCIDENTS(data.id)).emit('incident:updated', data);
        break;
        
      case 'assignment:created':
        io.to(ROOMS.DISPATCHERS).emit('assignment:created', data);
        io.to(ROOMS.AMBULANCES(data.ambulance_id)).emit('assignment:created', data);
        io.to(ROOMS.INCIDENTS(data.incident_id)).emit('assignment:created', data);
        break;
        
      case 'assignment:updated':
        io.to(ROOMS.DISPATCHERS).emit('assignment:updated', data);
        io.to(ROOMS.AMBULANCES(data.ambulance_id)).emit('assignment:updated', data);
        io.to(ROOMS.INCIDENTS(data.incident_id)).emit('assignment:updated', data);
        break;
        
      case 'hospital:alert':
        io.to(`hospital:${data.hospital_id}`).emit('hospital:alert', data);
        break;
        
      case 'greenCorridor:status':
        io.to(ROOMS.DISPATCHERS).emit('greenCorridor:status', data);
        io.to(ROOMS.AMBULANCES(data.ambulance_id)).emit('greenCorridor:status', data);
        break;
    }
  } catch (error) {
    console.error('Redis message error:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down WebSocket server...');
  await redis.quit();
  await redisSub.quit();
  server.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});

server.listen(PORT, () => {
  console.log(`🔌 WebSocket server running on port ${PORT}`);
});

module.exports = { io, server };
