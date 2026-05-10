"""
Siren Detection Integration Bridge
-----------------------------------
Connects the ambulance siren detection system with the main dispatch platform.
Enables real-time traffic signal preemption (Green Corridor) when ambulances
are detected approaching intersections.
"""

import asyncio
import json
import threading
from typing import Optional, Callable
from dataclasses import dataclass
from datetime import datetime

# Import the siren detection components
from .audio_detector import SirenDetector
from .camera_detector import AmbulanceDetector  
from .traffic_controller import TrafficController, LANES


@dataclass
class DetectionEvent:
    """Represents a siren/ambulance detection event"""
    event_type: str  # 'siren' or 'ambulance'
    lane: Optional[str]
    detected: bool
    confidence: float
    timestamp: datetime
    intersection_id: str


class SirenDetectionBridge:
    """
    Bridge between the siren detection system and the dispatch platform.
    
    Features:
    - Connects audio siren detection with dispatch notifications
    - Connects camera ambulance detection with traffic control
    - Emits events to WebSocket for real-time dashboard updates
    - Triggers Green Corridor activation in the main system
    """
    
    def __init__(
        self,
        intersection_id: str = "intersection-001",
        simulation: bool = True,
        demo_mode: bool = False,
        on_siren_detected: Optional[Callable] = None,
        on_ambulance_detected: Optional[Callable] = None,
        on_traffic_change: Optional[Callable] = None
    ):
        self.intersection_id = intersection_id
        self.simulation = simulation
        self.demo_mode = demo_mode
        
        # Callbacks for integration
        self._on_siren_detected = on_siren_detected
        self._on_ambulance_detected = on_ambulance_detected
        self._on_traffic_change = on_traffic_change
        
        # Tune probabilities for demo mode
        siren_prob = 0.6 if demo_mode else 0.15
        amb_prob = 0.4 if demo_mode else 0.10
        
        # Initialize traffic controller
        self.traffic_controller = TrafficController(
            green_duration=5.0 if demo_mode else 10.0,
            yellow_duration=1.5 if demo_mode else 2.0,
        )
        
        # Initialize siren detector
        self.siren_detector = SirenDetector(
            callback=self._handle_siren,
            simulation=simulation,
            sim_siren_probability=siren_prob,
        )
        
        # Initialize camera detectors (one per lane)
        self.camera_detectors = []
        for idx, lane in enumerate(LANES):
            detector = AmbulanceDetector(
                camera_index=idx,
                lane=lane,
                callback=self._handle_ambulance,
                simulation=simulation,
                sim_ambulance_probability=amb_prob,
            )
            self.camera_detectors.append(detector)
        
        # State tracking
        self._siren_active = False
        self._ambulance_lanes = set()
        self._running = False
        self._event_log = []
        
    def _handle_siren(self, detected: bool):
        """Handle siren detection event"""
        self._siren_active = detected
        self.traffic_controller.set_siren(detected)
        
        event = DetectionEvent(
            event_type='siren',
            lane=None,
            detected=detected,
            confidence=0.85 if detected else 0.0,
            timestamp=datetime.now(),
            intersection_id=self.intersection_id
        )
        
        self._log_event(event)
        
        if self._on_siren_detected:
            self._on_siren_detected(event)
            
        # In simulation mode, trigger camera detection on a random lane
        if detected and self.simulation:
            import random
            idle = [d for d in self.camera_detectors if not d._sim_active]
            if idle:
                chosen = random.choice(idle)
                chosen.trigger_sim_ambulance()
                
    def _handle_ambulance(self, lane: str, detected: bool):
        """Handle ambulance camera detection event"""
        self.traffic_controller.set_ambulance(lane, detected)
        
        if detected:
            self._ambulance_lanes.add(lane)
        else:
            self._ambulance_lanes.discard(lane)
            
        event = DetectionEvent(
            event_type='ambulance',
            lane=lane,
            detected=detected,
            confidence=0.92 if detected else 0.0,
            timestamp=datetime.now(),
            intersection_id=self.intersection_id
        )
        
        self._log_event(event)
        
        if self._on_ambulance_detected:
            self._on_ambulance_detected(event)
            
        # Notify traffic state change
        if self._on_traffic_change:
            self._on_traffic_change(self.get_traffic_state())
            
    def _log_event(self, event: DetectionEvent):
        """Log detection event"""
        self._event_log.append(event)
        if len(self._event_log) > 100:
            self._event_log.pop(0)
            
    def get_traffic_state(self) -> dict:
        """Get current traffic light state for all lanes"""
        state = self.traffic_controller.get_state()
        return {
            'intersection_id': self.intersection_id,
            'timestamp': datetime.now().isoformat(),
            'siren_active': self._siren_active,
            'lanes': {
                lane: {
                    'light': info['light'],
                    'ambulance_here': info['ambulance_here'],
                    'siren_heard': info.get('siren_heard', False)
                }
                for lane, info in state.items()
            },
            'emergency_active': any(
                info['ambulance_here'] for info in state.values()
            )
        }
        
    def get_status(self) -> dict:
        """Get full system status"""
        return {
            'intersection_id': self.intersection_id,
            'running': self._running,
            'simulation': self.simulation,
            'demo_mode': self.demo_mode,
            'siren_detected': self._siren_active,
            'ambulance_lanes': list(self._ambulance_lanes),
            'traffic_state': self.get_traffic_state(),
            'recent_events': [
                {
                    'type': e.event_type,
                    'lane': e.lane,
                    'detected': e.detected,
                    'confidence': e.confidence,
                    'timestamp': e.timestamp.isoformat()
                }
                for e in self._event_log[-10:]
            ]
        }
        
    def start(self):
        """Start all detection subsystems"""
        if self._running:
            return
            
        self._running = True
        self.traffic_controller.start()
        self.siren_detector.start()
        
        for detector in self.camera_detectors:
            detector.start()
            
        print(f"[SirenBridge] Started for {self.intersection_id}")
        
    def stop(self):
        """Stop all detection subsystems"""
        self._running = False
        self.siren_detector.stop()
        
        for detector in self.camera_detectors:
            detector.stop()
            
        self.traffic_controller.stop()
        print(f"[SirenBridge] Stopped for {self.intersection_id}")


# REST API integration helper
def create_api_routes(app, bridge: SirenDetectionBridge):
    """Add siren detection routes to an Express-like app"""
    
    @app.route('/api/siren-detection/status')
    def get_status():
        return bridge.get_status()
        
    @app.route('/api/siren-detection/traffic')
    def get_traffic():
        return bridge.get_traffic_state()
        
    @app.route('/api/siren-detection/events')
    def get_events():
        return {
            'events': [
                {
                    'type': e.event_type,
                    'lane': e.lane,
                    'detected': e.detected,
                    'confidence': e.confidence,
                    'timestamp': e.timestamp.isoformat()
                }
                for e in bridge._event_log[-50:]
            ]
        }
