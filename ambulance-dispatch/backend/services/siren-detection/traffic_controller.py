"""
traffic_controller.py
---------------------
Simulates a 4-lane smart traffic-light intersection.

Normal operation: round-robin green phases (configurable duration).
Emergency override: when an ambulance is confirmed on a lane, that lane
  immediately goes GREEN and all others go RED.  The override stays active
  until the ambulance clears, then normal rotation resumes.
"""

import threading
import time
from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, Optional


# ─────────────────────────────────────────────────────────────────────────────
#  Types
# ─────────────────────────────────────────────────────────────────────────────

class LightState(Enum):
    RED    = "RED"
    YELLOW = "YELLOW"
    GREEN  = "GREEN"


LANES = ["NORTH", "SOUTH", "EAST", "WEST"]

GREEN_DURATION  = 10.0   # seconds per lane in normal mode
YELLOW_DURATION =  2.0   # seconds for yellow transition


@dataclass
class LaneStatus:
    name            : str
    light           : LightState = LightState.RED
    ambulance_here  : bool       = False
    siren_heard     : bool       = False


# ─────────────────────────────────────────────────────────────────────────────
#  Controller
# ─────────────────────────────────────────────────────────────────────────────

class TrafficController:
    """
    Manages traffic lights for a 4-lane intersection.

    Usage
    -----
    tc = TrafficController()
    tc.start()
    tc.set_siren(True)          # siren detected
    tc.set_ambulance("NORTH", True)   # camera confirmed on NORTH lane
    tc.stop()
    """

    def __init__(self, green_duration=GREEN_DURATION,
                 yellow_duration=YELLOW_DURATION):
        self.green_duration  = green_duration
        self.yellow_duration = yellow_duration

        self.lanes: Dict[str, LaneStatus] = {
            lane: LaneStatus(name=lane) for lane in LANES
        }

        self._emergency_lane: Optional[str] = None
        self._siren_active   = False
        self._running        = False
        self._lock           = threading.Lock()
        self._thread         = None
        self._current_idx    = 0   # index into LANES for normal rotation

        print("[TrafficController] Intersection initialised  "
              f"(green={green_duration}s, yellow={yellow_duration}s)")

    # ── Public API ────────────────────────────────────────────────────────

    def start(self):
        """Start the controller loop in a background thread."""
        self._running = True
        self._thread  = threading.Thread(target=self._loop, daemon=True,
                                         name="traffic-ctrl")
        self._thread.start()
        print("[TrafficController] >  Running")

    def stop(self):
        """Stop the controller."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        print("[TrafficController] []  Stopped")

    def set_siren(self, active: bool):
        """Called by SirenDetector when siren state changes.

        When the siren activates and a camera has already confirmed an ambulance
        on a lane, the emergency is triggered immediately.  When the siren clears
        and no camera sees an ambulance, the emergency is also cleared.
        """
        with self._lock:
            self._siren_active = active
            # Keep siren_heard in sync on every lane (used by dashboard)
            for status in self.lanes.values():
                status.siren_heard = active

            if active:
                # Siren alone is sufficient to trigger emergency — pick camera-confirmed
                # lane first, otherwise hold whichever lane is currently GREEN.
                if not self._emergency_lane:
                    amb_lane = next(
                        (l for l, s in self.lanes.items() if s.ambulance_here), None
                    )
                    green_lane = next(
                        (l for l, s in self.lanes.items() if s.light == LightState.GREEN), None
                    )
                    chosen = amb_lane or green_lane or LANES[0]
                    self._emergency_lane = chosen
                    print(f"[TrafficController] [ALERT] Siren detected -> EMERGENCY on {chosen}")
            else:
                # Siren gone: clear siren-only emergency (camera-confirmed emergencies stay)
                if self._emergency_lane:
                    still_amb = self.lanes[self._emergency_lane].ambulance_here
                    if not still_amb:
                        # Check if any other lane has an ambulance
                        other = next(
                            (l for l, s in self.lanes.items() if s.ambulance_here), None
                        )
                        self._emergency_lane = other
                        if other is None:
                            print("[TrafficController] [OK] Siren gone, emergency cleared")

        status = "[ALERT] SIREN ON" if active else "[QUIET] Siren off"
        print(f"[TrafficController] {status}")

    def set_ambulance(self, lane: str, detected: bool):
        """Called by AmbulanceDetector when camera confirms ambulance."""
        if lane not in self.lanes:
            return
        with self._lock:
            self.lanes[lane].ambulance_here = detected
            if detected:
                self._emergency_lane = lane
                print(f"[TrafficController] [AMBULANCE] EMERGENCY -> forcing GREEN on {lane}")
            else:
                # Clear emergency only if no other lane has an ambulance
                if self._emergency_lane == lane:
                    other = next(
                        (l for l, s in self.lanes.items() if s.ambulance_here),
                        None
                    )
                    self._emergency_lane = other
                    if other is None:
                        print("[TrafficController] [OK] Emergency cleared - resuming normal")

    def get_state(self) -> Dict[str, dict]:
        """Return a snapshot of current light states."""
        with self._lock:
            return {
                lane: {
                    "light"         : status.light.value,
                    "ambulance_here": status.ambulance_here,
                    "siren_heard"   : status.siren_heard,
                }
                for lane, status in self.lanes.items()
            }

    # ── Internal loop ─────────────────────────────────────────────────────

    def _set_lights(self, green_lane: Optional[str]):
        """Set lights: one lane GREEN, rest RED."""
        for lane, status in self.lanes.items():
            status.light = LightState.GREEN if lane == green_lane else LightState.RED

    def _loop(self):
        while self._running:
            with self._lock:
                em_lane = self._emergency_lane

            if em_lane:
                # ── EMERGENCY MODE ──────────────────────────────────────
                with self._lock:
                    self._set_lights(em_lane)
                time.sleep(1.0)   # check again every second
            else:
                # ── NORMAL ROUND-ROBIN ──────────────────────────────────
                current_lane = LANES[self._current_idx % len(LANES)]

                # Green phase
                with self._lock:
                    self._set_lights(current_lane)
                elapsed = 0.0
                while elapsed < self.green_duration and self._running:
                    time.sleep(0.5)
                    elapsed += 0.5
                    # Bail out immediately if emergency starts
                    with self._lock:
                        if self._emergency_lane:
                            break

                # Yellow transition (skip if emergency took over)
                with self._lock:
                    em_now = self._emergency_lane
                if not em_now:
                    with self._lock:
                        self.lanes[current_lane].light = LightState.YELLOW
                    time.sleep(self.yellow_duration)

                self._current_idx += 1
