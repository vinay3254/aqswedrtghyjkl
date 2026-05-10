"""
camera_detector.py
------------------
Detects an ambulance in a camera frame using two strategies:

  1. OCR  – looks for "AMBULANCE" or its mirror "ECNALUBMA" on the vehicle.
  2. Color – detects the characteristic white + red/blue color scheme.

Falls back to pure simulation when OpenCV / pytesseract are unavailable
so the demo works on any laptop without a camera.
"""

import threading
import time
import random
import numpy as np

# ── Optional imports ──────────────────────────────────────────────────────────
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

try:
    from PIL import Image
    import pytesseract
    # Verify the Tesseract binary is actually installed
    try:
        pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        pytesseract.get_tesseract_version()
        TESS_AVAILABLE = True
    except Exception:
        TESS_AVAILABLE = False
        print("[CameraDetector] [!] Tesseract binary not found - OCR disabled (color detection still active)")
except ImportError:
    TESS_AVAILABLE = False


# ─────────────────────────────────────────────────────────────────────────────
#  Constants
# ─────────────────────────────────────────────────────────────────────────────
OCR_KEYWORDS   = {"AMBULANCE", "ECNALUBMA", "AMBUL", "ANCE"}
WHITE_THRESH   = 0.10   # fraction of frame that must be white
YELLOW_THRESH  = 0.01   # fraction of frame with yellow (ambulance-specific)
RED_THRESH     = 0.02   # fraction of frame with red
CONFIRM_FRAMES = 3      # consecutive positive frames to confirm detection
CLEAR_FRAMES   = 5      # consecutive negative frames to clear detection (prevents flickering)


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _ocr_has_ambulance(frame_bgr: np.ndarray) -> bool:
    """Return True if OCR finds AMBULANCE / ECNALUBMA text in the frame."""
    if not TESS_AVAILABLE:
        return False
    try:
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
        pil_img = Image.fromarray(thresh)
        text = pytesseract.image_to_string(pil_img, config='--psm 6').upper()
        return any(kw in text for kw in OCR_KEYWORDS)
    except Exception as e:
        # Tesseract warnings/errors – fall back to color detection
        return False


def _color_has_ambulance(frame_bgr: np.ndarray) -> bool:
    """
    Return True if the frame contains the characteristic ambulance color pattern:
    white + red + yellow (not just any red/blue).
    """
    hsv   = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
    total = frame_bgr.shape[0] * frame_bgr.shape[1]

    # White mask (bright, low saturation)
    white_mask = cv2.inRange(hsv,
                             np.array([0,   0, 180]),
                             np.array([180, 40, 255]))
    white_ratio = cv2.countNonZero(white_mask) / total

    # Red mask (two hue ranges)
    red1 = cv2.inRange(hsv, np.array([0,  80,  70]), np.array([10, 255, 255]))
    red2 = cv2.inRange(hsv, np.array([165, 80, 70]), np.array([180, 255, 255]))
    red_mask  = cv2.bitwise_or(red1, red2)
    red_ratio = cv2.countNonZero(red_mask) / total

    # Yellow mask (ambulance roof)
    yellow_mask = cv2.inRange(hsv, np.array([15, 80, 70]), np.array([35, 255, 255]))
    yellow_ratio = cv2.countNonZero(yellow_mask) / total

    # Require white + red + yellow together (ambulance pattern)
    has_white = white_ratio > WHITE_THRESH
    has_red = red_ratio > RED_THRESH
    has_yellow = yellow_ratio > YELLOW_THRESH


    return has_white and has_red and has_yellow


def _analyse_frame(frame_bgr: np.ndarray) -> bool:
    """
    Run both detectors:
    - OCR text alone is enough (strong signal: "AMBULANCE" text found)
    - OR require strict color pattern (white + red + yellow together)
    """
    ocr   = _ocr_has_ambulance(frame_bgr)
    color = _color_has_ambulance(frame_bgr)

    return ocr or color


# ─────────────────────────────────────────────────────────────────────────────
#  Main class
# ─────────────────────────────────────────────────────────────────────────────

class AmbulanceDetector:
    """
    Reads from a camera (or simulation) and detects ambulances.

    Parameters
    ----------
    camera_index : int
        OpenCV camera index (0 = default webcam).
    lane : str
        Label of the intersection lane being watched (e.g. "NORTH").
    callback : callable(str, bool)
        Called with (lane, True/False) on detection state changes.
    simulation : bool
        Force simulation mode.
    sim_ambulance_probability : float
        Per-second chance of a simulated ambulance appearing.
    """

    def __init__(self, camera_index=0, lane="NORTH",
                 callback=None, simulation=False,
                 sim_ambulance_probability=0.2):
        self.camera_index   = camera_index
        self.lane           = lane
        self.callback       = callback or (lambda lane, det: None)
        self.simulation     = simulation or not CV2_AVAILABLE

        self.sim_prob       = sim_ambulance_probability
        self._running       = False
        self._thread        = None
        self._detected      = False
        self._consec        = 0
        self._consec_clears = 0   # separate counter for clearing detection

        # Simulation state
        self._sim_active    = False
        self._sim_duration  = 0.0
        self._sim_elapsed   = 0.0

        mode = "SIMULATION" if self.simulation else f"camera #{camera_index}"
        print(f"[CameraDetector:{self.lane}] [INIT] Initialised ({mode})")

    # ── Public API ────────────────────────────────────────────────────────

    def start(self):
        self._running = True
        target = self._sim_loop if self.simulation else self._cam_loop
        self._thread = threading.Thread(target=target, daemon=True,
                                        name=f"cam-{self.lane}")
        self._thread.start()
        print(f"[CameraDetector:{self.lane}] [START] Started")

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=3)
        print(f"[CameraDetector:{self.lane}] [STOP] Stopped")

    @property
    def ambulance_detected(self) -> bool:
        return self._detected

    # ── State management ──────────────────────────────────────────────────

    def _update_state(self, positive: bool):
        """Debounce frame results.

        Activation : requires CONFIRM_FRAMES consecutive positives.
        Deactivation: requires CLEAR_FRAMES  consecutive negatives (prevents flickering).
        """
        if positive:
            self._consec        += 1
            self._consec_clears  = 0   # any positive resets the clear streak
        else:
            self._consec_clears += 1
            if self._consec_clears >= CLEAR_FRAMES:
                self._consec = 0       # reset hit counter after sustained absence

        newly_det = self._consec >= CONFIRM_FRAMES
        if newly_det != self._detected:
            self._detected = newly_det
            self.callback(self.lane, self._detected)
            icon = "[AMBULANCE] SPOTTED" if self._detected else "[OK] Clear"
            print(f"[CameraDetector:{self.lane}] {icon}")

    def trigger_sim_ambulance(self, duration: float = None):
        """Force-start a simulated ambulance event on this lane.

        Used by the main system to correlate camera events with siren events
        so the full detection pipeline can be demonstrated end-to-end.
        """
        if not self.simulation or self._sim_active:
            return
        self._sim_active   = True
        self._sim_duration = duration if duration is not None else random.uniform(8, 15)
        self._sim_elapsed  = 0.0
        print(f"[CameraDetector:{self.lane}] [CAM] Ambulance triggered by siren "
              f"(duration={self._sim_duration:.1f}s)")

    # ── Live camera loop ──────────────────────────────────────────────────

    def _cam_loop(self):
        # Try the requested camera index first; fall back to 0 (default webcam)
        cap = cv2.VideoCapture(self.camera_index)
        if not cap.isOpened():
            if self.camera_index != 0:
                print(f"[CameraDetector:{self.lane}] [!] Camera #{self.camera_index} not found - "
                      "sharing camera 0 (single-webcam mode)")
                cap = cv2.VideoCapture(0)
            if not cap.isOpened():
                print(f"[CameraDetector:{self.lane}] [!] Cannot open any camera - "
                      "switching to simulation")
                self.simulation = True
                self._sim_loop()
                return
        try:
            while self._running:
                ret, frame = cap.read()
                if not ret:
                    time.sleep(0.1)
                    continue
                result = _analyse_frame(frame)
                self._update_state(result)
                time.sleep(0.1)        # ~10 fps analysis
        finally:
            cap.release()

    # ── Simulation loop ───────────────────────────────────────────────────

    def _sim_loop(self):
        fps    = 10
        dt     = 1.0 / fps
        while self._running:
            if not self._sim_active:
                if random.random() < self.sim_prob * dt:
                    self._sim_active   = True
                    self._sim_duration = random.uniform(6, 18)
                    self._sim_elapsed  = 0.0
                    print(f"[CameraDetector:{self.lane}] [CAM] Sim ambulance appearing "
                          f"(duration={self._sim_duration:.1f}s)")

            if self._sim_active:
                self._sim_elapsed += dt
                positive = True
                if self._sim_elapsed >= self._sim_duration:
                    self._sim_active = False
                    positive = False
                    print(f"[CameraDetector:{self.lane}] [CAM] Sim ambulance left")
            else:
                positive = False

            self._update_state(positive)
            time.sleep(dt)
