"""
WebSocket Server for Ambulance Detection System
Serves real-time traffic light and audio detection data to the frontend
"""

import asyncio
import json
import time
import threading
import random
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from audio_detector import SirenDetector
from camera_detector import AmbulanceDetector
from traffic_controller import TrafficController, LANES

# ─────────────────────────────────────────────────────────────────────────────
#  WebSocket Manager
# ─────────────────────────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Send message to all connected clients"""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error broadcasting: {e}")


# ─────────────────────────────────────────────────────────────────────────────
#  System Manager
# ─────────────────────────────────────────────────────────────────────────────

class SystemManager:
    def __init__(self, manager: ConnectionManager):
        self.manager = manager
        self.demo_mode = True
        self.simulation = True

        # Tune probabilities for demo mode
        siren_prob = 0.6 if self.demo_mode else 0.15
        amb_prob = 0.4 if self.demo_mode else 0.10

        # Initialize traffic controller
        self.tc = TrafficController(
            green_duration=5.0 if self.demo_mode else 10.0,
            yellow_duration=1.5 if self.demo_mode else 2.0,
        )

        # Initialize audio detector
        self.siren_det = SirenDetector(
            callback=self._on_siren,
            simulation=self.simulation,
            sim_siren_probability=siren_prob,
        )

        # Initialize camera detectors
        self.cam_dets = []
        for idx, lane in enumerate(LANES):
            det = AmbulanceDetector(
                camera_index=idx,
                lane=lane,
                callback=self._on_ambulance,
                simulation=self.simulation,
                sim_ambulance_probability=amb_prob,
            )
            self.cam_dets.append(det)

        # State tracking
        self._siren_active = False
        self._audio_level = 0
        self._confidence = 0
        self._running = False

    def _on_siren(self, detected: bool):
        """Callback when siren is detected"""
        self._siren_active = detected
        self.tc.set_siren(detected)

        if detected:
            # Trigger ambulance on random lane for full detection pipeline
            if self.simulation:
                idle = [d for d in self.cam_dets if not d._sim_active]
                if idle:
                    chosen = random.choice(idle)
                    chosen.trigger_sim_ambulance()

    def _on_ambulance(self, lane: str, detected: bool):
        """Callback when ambulance is detected"""
        self.tc.set_ambulance(lane, detected)

    def get_status(self) -> dict:
        """Get current system status"""
        try:
            state = self.tc.get_state()
            lanes = {
                'north': [state['NORTH']['light'].lower()] * 2,
                'south': [state['SOUTH']['light'].lower()] * 2,
                'east': [state['EAST']['light'].lower()],
                'west': [state['WEST']['light'].lower()],
            }
        except Exception as e:
            print(f"[Server] Error getting lanes: {e}")
            print(f"[Server] State: {state if 'state' in locals() else 'state not created'}")
            lanes = {
                'north': ['red', 'red'],
                'south': ['red', 'red'],
                'east': ['red'],
                'west': ['red'],
            }

        return {
            'lanes': lanes,
            'siren_detected': self._siren_active,
            'audio_level': self._audio_level,
            'confidence': self._confidence,
        }

    async def update_audio(self):
        """Simulate audio level updates"""
        count = 0
        while self._running:
            if self._siren_active:
                self._audio_level = random.uniform(60, 100)
                self._confidence = random.uniform(0.7, 1.0)
            else:
                self._audio_level = random.uniform(0, 30)
                self._confidence = random.uniform(0, 0.3)

            count += 1
            if count % 10 == 0:
                print(f"[Server] Broadcasting to {len(self.manager.active_connections)} clients: {self.get_status()['lanes']}")

            await self.manager.broadcast({
                'type': 'status',
                'data': self.get_status()
            })
            await asyncio.sleep(0.5)

    def start(self):
        """Start all subsystems"""
        self._running = True
        self.tc.start()
        self.siren_det.start()
        for det in self.cam_dets:
            det.start()
        print("[Server] All subsystems started")

    def stop(self):
        """Stop all subsystems"""
        self._running = False
        self.siren_det.stop()
        for det in self.cam_dets:
            det.stop()
        self.tc.stop()
        print("[Server] All subsystems stopped")


# ─────────────────────────────────────────────────────────────────────────────
#  FastAPI Setup
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI()

# CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()
system = None


@app.on_event("startup")
async def startup():
    global system
    system = SystemManager(manager)
    system.start()

    # Start audio update task
    asyncio.create_task(system.update_audio())


@app.on_event("shutdown")
async def shutdown():
    if system:
        system.stop()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            # Handle any incoming commands if needed
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok"}


if __name__ == "__main__":
    print("""
========================================================
  AMBULANCE DETECTION SYSTEM - SERVER
========================================================

Starting WebSocket server on ws://localhost:8000/ws
Frontend should connect to http://localhost:5173
""")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
