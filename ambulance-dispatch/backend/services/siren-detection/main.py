"""
main.py
-------
Ambulance Emergency Detection System - Main Entry Point

Ties together:
  - SirenDetector   : audio-based siren detection
  - AmbulanceDetector : camera-based ECNALUBMA / visual detection (4 lanes)
  - TrafficController : smart traffic light management

Run modes:
  python main.py            # full simulation (no hardware needed)
  python main.py --live     # attempt real mic + camera
  python main.py --demo     # fast demo with frequent ambulance events
"""

import argparse
import time
import os
import sys
import threading
import random

IS_TTY = bool(getattr(sys.stdout, "isatty", lambda: False)())

# Prefer reconfiguring the existing streams so Windows terminals keep
# working, while captured output remains stable in non-interactive shells.
for stream_name in ("stdout", "stderr"):
    stream = getattr(sys, stream_name, None)
    if hasattr(stream, "reconfigure"):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

# ── Colorama for coloured terminal output (graceful fallback) ─────────────
try:
    if IS_TTY:
        from colorama import just_fix_windows_console, Fore, Style, Back
        just_fix_windows_console()
        COLORS = True
    else:
        raise ImportError
except ImportError:
    COLORS = False
    class Fore:
        RED = GREEN = YELLOW = CYAN = WHITE = MAGENTA = RESET = ""
    class Style:
        BRIGHT = RESET_ALL = DIM = ""
    class Back:
        RED = GREEN = YELLOW = BLUE = BLACK = RESET = ""

from audio_detector    import SirenDetector
from camera_detector   import AmbulanceDetector
from traffic_controller import TrafficController, LANES


# ─────────────────────────────────────────────────────────────────────────────
#  Display helpers
# ─────────────────────────────────────────────────────────────────────────────

LIGHT_ICONS = {
    "RED"   : f"{Fore.RED    }🔴 RED   {Style.RESET_ALL}",
    "YELLOW": f"{Fore.YELLOW }🟡 YELLOW{Style.RESET_ALL}",
    "GREEN" : f"{Fore.GREEN  }🟢 GREEN {Style.RESET_ALL}",
}

def _clear():
    if IS_TTY:
        os.system("cls" if os.name == "nt" else "clear")

def _header(text: str):
    w = 60
    print(f"{Style.BRIGHT}{Fore.CYAN}{'─'*w}")
    print(f"  {text}")
    print(f"{'─'*w}{Style.RESET_ALL}")


# ─────────────────────────────────────────────────────────────────────────────
#  Core system
# ─────────────────────────────────────────────────────────────────────────────

class AmbulanceEmergencySystem:
    """
    Orchestrates all subsystems and renders a live terminal dashboard.
    """

    def __init__(self, simulation=True, demo_mode=False):
        self.simulation = simulation
        self.demo_mode  = demo_mode

        # Tune probabilities for demo mode (events fire faster)
        siren_prob = 0.6 if demo_mode else 0.15
        amb_prob   = 0.4 if demo_mode else 0.10

        # ── Traffic controller ────────────────────────────────────────
        self.tc = TrafficController(
            green_duration  = 5.0 if demo_mode else 10.0,
            yellow_duration = 1.5 if demo_mode else 2.0,
        )

        # ── Audio detector ────────────────────────────────────────────
        self.siren_det = SirenDetector(
            callback               = self._on_siren,
            simulation             = simulation,
            sim_siren_probability  = siren_prob,
        )

        # ── Camera detectors (one per lane) ───────────────────────────
        self.cam_dets = []
        for idx, lane in enumerate(LANES):
            det = AmbulanceDetector(
                camera_index              = idx,
                lane                      = lane,
                callback                  = self._on_ambulance,
                simulation                = simulation,
                sim_ambulance_probability = amb_prob,
            )
            self.cam_dets.append(det)

        # ── State ─────────────────────────────────────────────────────
        self._siren_active  = False
        self._event_log     = []          # last 6 events
        self._running       = False

    # ── Callbacks ─────────────────────────────────────────────────────────

    def _on_siren(self, detected: bool):
        self._siren_active = detected
        self.tc.set_siren(detected)
        if detected:
            msg = "🚨 SIREN DETECTED"
            # In simulation: coordinate a camera event on an idle lane so the full
            # detection pipeline (siren → camera → traffic response) always fires.
            if self.simulation:
                idle = [d for d in self.cam_dets if not d._sim_active]
                if idle:
                    chosen = random.choice(idle)
                    chosen.trigger_sim_ambulance()
        else:
            msg = "🔇 Siren gone"
        self._log(msg)

    def _on_ambulance(self, lane: str, detected: bool):
        self.tc.set_ambulance(lane, detected)
        if detected:
            msg = f"🚑 AMBULANCE on {lane} – forcing GREEN"
        else:
            msg = f"✅ {lane} cleared"
        self._log(msg)

    def _log(self, msg: str):
        ts = time.strftime("%H:%M:%S")
        self._event_log.append(f"[{ts}] {msg}")
        if len(self._event_log) > 8:
            self._event_log.pop(0)

    # ── Dashboard ─────────────────────────────────────────────────────────

    def _render(self):
        _clear()
        _header("🚑  AMBULANCE EMERGENCY DETECTION SYSTEM  🚦")

        state = self.tc.get_state()
        em    = any(s["ambulance_here"] for s in state.values())

        # ── Intersection grid ─────────────────────────────────────────
        print(f"\n  {'LANE':<10} {'LIGHT':<20} {'AMBULANCE':<15} {'SIREN'}")
        print(f"  {'────':<10} {'─────':<20} {'─────────':<15} {'─────'}")

        for lane, info in state.items():
            light_str = LIGHT_ICONS.get(info["light"], info["light"])
            amb_str   = f"{Fore.RED}🚑 YES{Style.RESET_ALL}" if info["ambulance_here"] \
                        else f"{Style.DIM}--{Style.RESET_ALL}"
            sir_str   = f"{Fore.YELLOW}🔊 YES{Style.RESET_ALL}" if self._siren_active \
                        else f"{Style.DIM}--{Style.RESET_ALL}"
            print(f"  {lane:<10} {light_str:<30} {amb_str:<25} {sir_str}")

        # ── Emergency banner ──────────────────────────────────────────
        print()
        if em:
            # Show whichever lane currently holds the GREEN light as right-of-way
            green_lane = next(
                (l for l, s in state.items() if s["light"] == "GREEN"), None
            )
            em_lane = green_lane or next(l for l, s in state.items() if s["ambulance_here"])
            print(f"  {Back.RED}{Fore.WHITE}{Style.BRIGHT}"
                  f"  ⚡ EMERGENCY ACTIVE — {em_lane} has RIGHT OF WAY  "
                  f"{Style.RESET_ALL}")
        else:
            print(f"  {Style.DIM}  No emergency active — normal rotation{Style.RESET_ALL}")

        # ── Intersection ASCII art ─────────────────────────────────────
        print()
        n = state["NORTH"]["light"][0]   # R/Y/G
        s = state["SOUTH"]["light"][0]
        e = state["EAST"]["light"][0]
        w = state["WEST"]["light"][0]

        def _lc(x):
            colors = {"R": Fore.RED, "Y": Fore.YELLOW, "G": Fore.GREEN}
            return f"{colors.get(x,'')}{x}{Style.RESET_ALL}"

        print(f"           {_lc(n)}-NORTH")
        print(f"           |")
        print(f"  {_lc(w)}-WEST ──[INTERSECTION]── EAST-{_lc(e)}")
        print(f"           |")
        print(f"           {_lc(s)}-SOUTH")

        # ── Event log ─────────────────────────────────────────────────
        print()
        _header("📋  Event Log")
        for entry in self._event_log[-6:]:
            print(f"  {entry}")

        # ── Footer ────────────────────────────────────────────────────
        mode = "SIMULATION" if self.simulation else "LIVE"
        demo = " [DEMO MODE]" if self.demo_mode else ""
        print(f"\n  Mode: {Style.BRIGHT}{mode}{demo}{Style.RESET_ALL}   "
              f"Press Ctrl+C to quit")

    # ── Lifecycle ─────────────────────────────────────────────────────────

    def start(self):
        self._running = True
        print("\n[System] Starting all subsystems …")

        self.tc.start()
        self.siren_det.start()
        for det in self.cam_dets:
            det.start()

        self._log("System started")
        print("[System] ✅ All subsystems running\n")
        time.sleep(1)

        try:
            while self._running:
                self._render()
                time.sleep(3.0)  # Slower refresh so user can read the display
        except KeyboardInterrupt:
            print("\n[System] Ctrl+C received – shutting down …")
        finally:
            self.stop()

    def stop(self):
        self._running = False
        self.siren_det.stop()
        for det in self.cam_dets:
            det.stop()
        self.tc.stop()
        print("[System] 🛑 Shutdown complete")


# ─────────────────────────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Ambulance Emergency Detection System"
    )
    parser.add_argument("--live", action="store_true",
                        help="Use real microphone and camera (needs PyAudio + OpenCV)")
    parser.add_argument("--demo", action="store_true",
                        help="Fast demo: ambulance events fire frequently")
    args = parser.parse_args()

    simulation = not args.live

    print(f"""
╔══════════════════════════════════════════════════════════╗
║      🚑  AMBULANCE EMERGENCY DETECTION SYSTEM  🚦        ║
╠══════════════════════════════════════════════════════════╣
║  Audio  : siren frequency sweep detection (FFT)          ║
║  Vision : ECNALUBMA text + color detection               ║
║  Action : force GREEN light on ambulance lane            ║
╚══════════════════════════════════════════════════════════╝

  Mode      : {'LIVE' if not simulation else 'SIMULATION'}
  Demo mode : {'ON (fast events)' if args.demo else 'OFF'}
""")

    system = AmbulanceEmergencySystem(simulation=simulation, demo_mode=args.demo)
    system.start()


if __name__ == "__main__":
    main()
