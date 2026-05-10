const db = require('../../api/config/database');
const { v4: uuidv4 } = require('uuid');

const AMBULANCE_TYPES = {
  ALS: 'ALS',
  BLS: 'BLS',
  NEONATAL: 'NEONATAL',
};

const AMBULANCE_STATUS = {
  AVAILABLE: 'AVAILABLE',
  DISPATCHED: 'DISPATCHED',
  BUSY: 'BUSY',
  OFFLINE: 'OFFLINE',
  OUT_OF_SERVICE: 'OUT_OF_SERVICE',
};

const SHIFT_STATUS = {
  ON_DUTY: 'ON_DUTY',
  OFF_DUTY: 'OFF_DUTY',
  BREAK: 'BREAK',
};

const createTables = async () => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Enable PostGIS extension for geospatial queries
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis');

    // Ambulances table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ambulances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        call_sign VARCHAR(50) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('ALS', 'BLS', 'NEONATAL')),
        status VARCHAR(20) NOT NULL DEFAULT 'OFFLINE' 
          CHECK (status IN ('AVAILABLE', 'DISPATCHED', 'BUSY', 'OFFLINE', 'OUT_OF_SERVICE')),
        location GEOGRAPHY(Point, 4326),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        fuel_level INTEGER DEFAULT 100 CHECK (fuel_level >= 0 AND fuel_level <= 100),
        base_station VARCHAR(100),
        equipment JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        last_maintenance_date TIMESTAMP,
        next_maintenance_date TIMESTAMP,
        mileage INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      )
    `);

    // Create spatial index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ambulances_location 
      ON ambulances USING GIST(location)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ambulances_status 
      ON ambulances(status) WHERE deleted_at IS NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ambulances_type 
      ON ambulances(type) WHERE deleted_at IS NULL
    `);

    // Drivers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ambulance_drivers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        license_number VARCHAR(50) UNIQUE NOT NULL,
        license_expiry DATE NOT NULL,
        certifications JSONB DEFAULT '[]'::jsonb,
        shift_status VARCHAR(20) DEFAULT 'OFF_DUTY' 
          CHECK (shift_status IN ('ON_DUTY', 'OFF_DUTY', 'BREAK')),
        current_ambulance_id UUID REFERENCES ambulances(id) ON DELETE SET NULL,
        shift_start_time TIMESTAMP,
        shift_end_time TIMESTAMP,
        location GEOGRAPHY(Point, 4326),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        performance_metrics JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_drivers_user 
      ON ambulance_drivers(user_id) WHERE deleted_at IS NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_drivers_ambulance 
      ON ambulance_drivers(current_ambulance_id) WHERE deleted_at IS NULL
    `);

    // Equipment tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS ambulance_equipment (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ambulance_id UUID NOT NULL REFERENCES ambulances(id) ON DELETE CASCADE,
        equipment_name VARCHAR(100) NOT NULL,
        equipment_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'OPERATIONAL' 
          CHECK (status IN ('OPERATIONAL', 'NEEDS_CHECK', 'DEFECTIVE', 'MISSING')),
        quantity INTEGER DEFAULT 1,
        expiry_date DATE,
        last_checked TIMESTAMP,
        next_check_date TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_equipment_ambulance 
      ON ambulance_equipment(ambulance_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_equipment_status 
      ON ambulance_equipment(status)
    `);

    // Ambulance status history
    await client.query(`
      CREATE TABLE IF NOT EXISTS ambulance_status_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ambulance_id UUID NOT NULL REFERENCES ambulances(id) ON DELETE CASCADE,
        previous_status VARCHAR(20),
        new_status VARCHAR(20) NOT NULL,
        changed_by UUID,
        reason TEXT,
        incident_id UUID,
        location GEOGRAPHY(Point, 4326),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_status_history_ambulance 
      ON ambulance_status_history(ambulance_id, created_at DESC)
    `);

    // Maintenance records
    await client.query(`
      CREATE TABLE IF NOT EXISTS ambulance_maintenance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ambulance_id UUID NOT NULL REFERENCES ambulances(id) ON DELETE CASCADE,
        maintenance_type VARCHAR(50) NOT NULL,
        description TEXT,
        scheduled_date TIMESTAMP,
        completed_date TIMESTAMP,
        status VARCHAR(20) DEFAULT 'SCHEDULED' 
          CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
        cost DECIMAL(10, 2),
        performed_by VARCHAR(100),
        mileage_at_service INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_ambulance 
      ON ambulance_maintenance(ambulance_id, scheduled_date DESC)
    `);

    // Trigger to update updated_at timestamp
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_ambulances_updated_at ON ambulances
    `);

    await client.query(`
      CREATE TRIGGER update_ambulances_updated_at 
      BEFORE UPDATE ON ambulances 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_drivers_updated_at ON ambulance_drivers
    `);

    await client.query(`
      CREATE TRIGGER update_drivers_updated_at 
      BEFORE UPDATE ON ambulance_drivers 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);

    await client.query('COMMIT');
    console.log('Ambulance tables created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating ambulance tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  AMBULANCE_TYPES,
  AMBULANCE_STATUS,
  SHIFT_STATUS,
  createTables,
};
