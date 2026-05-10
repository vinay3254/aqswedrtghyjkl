"""
audio_detector.py
-----------------
Listens to microphone input and detects ambulance siren sounds.
Uses FFT-based frequency analysis to spot the oscillating 700-1800 Hz
sweep pattern typical of emergency vehicle sirens.

In SIMULATION mode (no microphone / PyAudio not installed) it generates
synthetic siren waveforms so the whole pipeline can be demoed anywhere.
"""

import numpy as np
import threading
import time
import random

# ── Try importing sounddevice (optional – falls back to simulation) ─────────
try:
    import sounddevice as sd
    SOUNDDEVICE_AVAILABLE = True
except ImportError:
    SOUNDDEVICE_AVAILABLE = False

# Legacy alias so the rest of the module needs no changes
PYAUDIO_AVAILABLE = SOUNDDEVICE_AVAILABLE

# ── Try importing scipy for a proper bandpass filter (optional) ───────────
try:
    from scipy.signal import butter, sosfilt
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False


# ─────────────────────────────────────────────────────────────────────────────
#  Constants
# ─────────────────────────────────────────────────────────────────────────────
SAMPLE_RATE   = 44100   # Hz
CHUNK         = 1024    # samples per buffer read
SIREN_LOW     = 700     # Hz  – lower bound of siren sweep
SIREN_HIGH    = 1800    # Hz  – upper bound of siren sweep
ENERGY_THRESH = 0.20    # Require 20% of energy in siren band (stricter)
CONFIRM_HITS  = 5       # Require 5 consecutive hits (was 3)
CLEAR_HITS    = 8       # Require 8 misses to clear (was 5)
MIN_AMPLITUDE = 0.001   # Require louder sounds (was 0.00001)


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _bandpass_filter(data: np.ndarray, lowcut: float, highcut: float,
                     fs: int, order: int = 4) -> np.ndarray:
    """Apply a Butterworth bandpass filter (uses scipy if available)."""
    if SCIPY_AVAILABLE:
        sos = butter(order, [lowcut, highcut], btype='band',
                     fs=fs, output='sos')
        return sosfilt(sos, data)
    # Fallback: crude FFT mask
    freqs = np.fft.rfftfreq(len(data), d=1.0 / fs)
    spectrum = np.fft.rfft(data)
    mask = (freqs >= lowcut) & (freqs <= highcut)
    spectrum[~mask] = 0
    return np.fft.irfft(spectrum, n=len(data))


def _relative_band_energy(data: np.ndarray, lowcut: float, highcut: float,
                           fs: int) -> float:
    """Fraction of total signal energy that lies in [lowcut, highcut]."""
    freqs = np.fft.rfftfreq(len(data), d=1.0 / fs)
    power = np.abs(np.fft.rfft(data)) ** 2
    total = power.sum()
    if total < 1e-10:
        return 0.0
    band  = power[(freqs >= lowcut) & (freqs <= highcut)].sum()
    return float(band / total)


def _generate_siren_chunk(t_offset: float, fs: int = SAMPLE_RATE,
                           n: int = CHUNK) -> np.ndarray:
    """Synthesise one chunk of an oscillating siren tone for simulation."""
    t = np.linspace(t_offset, t_offset + n / fs, n, endpoint=False)
    # Frequency sweeps between SIREN_LOW and SIREN_HIGH at ~2 Hz rate
    freq = SIREN_LOW + (SIREN_HIGH - SIREN_LOW) * \
           (0.5 + 0.5 * np.sin(2 * np.pi * 2.0 * t))
    phase = np.cumsum(2 * np.pi * freq / fs)
    wave  = 0.6 * np.sin(phase)
    noise = 0.05 * np.random.randn(n)
    return (wave + noise).astype(np.float32)


# ─────────────────────────────────────────────────────────────────────────────
#  Main class
# ─────────────────────────────────────────────────────────────────────────────

class SirenDetector:
    """
    Detects ambulance sirens from live microphone input or simulation.

    Parameters
    ----------
    callback : callable(bool)
        Called with True when a siren is detected, False when it stops.
    simulation : bool
        Force simulation mode even if PyAudio is available.
    sim_siren_probability : float
        In simulation, probability of a siren event starting each second.
    """

    def __init__(self, callback=None, simulation=False,
                 sim_siren_probability=0.3):
        self.callback            = callback or (lambda detected: None)
        self.simulation          = simulation or not SOUNDDEVICE_AVAILABLE
        self.sim_siren_prob      = sim_siren_probability

        self._running            = False
        self._thread             = None
        self._detected           = False
        self._consec_hits        = 0
        self._consec_misses      = 0        # separate counter for clearing detection
        self._sim_t              = 0.0      # simulated time offset
        self._sim_siren_active   = False
        self._sim_siren_duration = 0.0
        self._sim_siren_elapsed  = 0.0

        if self.simulation:
            print("[SirenDetector] [!] sounddevice not available - running in SIMULATION mode")
        else:
            mic_name = sd.query_devices(kind='input')['name']
            print(f"[SirenDetector] [MIC] Microphone mode active -> {mic_name}")

    # ── Public API ────────────────────────────────────────────────────────

    def start(self):
        """Start the detector in a background thread."""
        self._running = True
        target = self._sim_loop if self.simulation else self._mic_loop
        self._thread = threading.Thread(target=target, daemon=True)
        self._thread.start()
        print("[SirenDetector] >  Detection started")

    def stop(self):
        """Stop the detector."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=3)
        print("[SirenDetector] []  Detection stopped")

    @property
    def siren_detected(self) -> bool:
        return self._detected

    # ── Core analysis ─────────────────────────────────────────────────────

    def _analyse_chunk(self, chunk: np.ndarray) -> bool:
        """Return True if this audio chunk contains siren characteristics."""
        # Check 1: Absolute amplitude (filter out silence/very quiet sounds)
        amplitude = np.abs(chunk).max()

        # Check 2: Relative energy in siren frequency band
        energy = _relative_band_energy(chunk, SIREN_LOW, SIREN_HIGH, SAMPLE_RATE)

        # Debug: print levels every 60 chunks (about once every 3 seconds - easier to read)
        if not hasattr(self, '_debug_counter'):
            self._debug_counter = 0
        self._debug_counter += 1
        if self._debug_counter % 60 == 0:
            status = "PASS" if (amplitude >= MIN_AMPLITUDE and energy > ENERGY_THRESH) else "FAIL"
            print(f"[DEBUG] [{status}] Amplitude: {amplitude:.4f} (need >{MIN_AMPLITUDE}) | Energy: {energy:.4f} (need >{ENERGY_THRESH})")

        if amplitude < MIN_AMPLITUDE:
            return False

        return energy > ENERGY_THRESH

    def _update_state(self, hit: bool):
        """Debounce hits and fire the callback on state changes.

        Activation : requires CONFIRM_HITS  consecutive hits  (strict onset).
        Deactivation: requires CLEAR_HITS   consecutive misses (prevents flickering).
        """
        if hit:
            self._consec_hits  += 1
            self._consec_misses = 0          # any hit resets the miss streak
            # Only log at key thresholds to avoid terminal spam
            if self._consec_hits <= CONFIRM_HITS or self._consec_hits % 20 == 0:
                print(f"[DEBUG] Hit detected! Consecutive hits: {self._consec_hits}/{CONFIRM_HITS}")
        else:
            self._consec_misses += 1
            # Only reset hit counter after a sustained run of misses
            if self._consec_misses >= CLEAR_HITS:
                self._consec_hits = 0

        newly_detected = self._consec_hits >= CONFIRM_HITS
        if newly_detected != self._detected:
            self._detected = newly_detected
            self.callback(self._detected)
            status = "[ALERT] SIREN DETECTED" if self._detected else "[OK] Siren gone"
            print(f"[SirenDetector] {status}")

    # ── Microphone loop ───────────────────────────────────────────────────

    def _mic_loop(self):
        try:
            print("[SirenDetector] [DEBUG] Opening microphone stream...")
            with sd.InputStream(samplerate=SAMPLE_RATE,
                                channels=1,
                                dtype='float32',
                                blocksize=CHUNK) as stream:
                print("[SirenDetector] [DEBUG] Stream opened, entering read loop...")
                frame_count = 0
                while self._running:
                    frame_count += 1
                    if frame_count % 60 == 0:
                        print(f"[SirenDetector] [DEBUG] Frame {frame_count}... still running")
                    data, overflowed = stream.read(CHUNK)
                    if data is None or len(data) == 0:
                        print("[SirenDetector] [WARNING] No data from stream!")
                        break
                    chunk = data[:, 0]          # mono – take channel 0
                    hit   = self._analyse_chunk(chunk)
                    self._update_state(hit)
                print(f"[SirenDetector] [DEBUG] Mic loop exited normally after {frame_count} frames")
        except Exception as e:
            print(f"[SirenDetector] [ERROR] Microphone loop crashed: {e}")
            import traceback
            traceback.print_exc()

    # ── Simulation loop ───────────────────────────────────────────────────

    def _sim_loop(self):
        dt = CHUNK / SAMPLE_RATE          # seconds per chunk
        while self._running:
            # Decide whether a siren event should start
            if not self._sim_siren_active:
                if random.random() < self.sim_siren_prob * dt:
                    self._sim_siren_active   = True
                    self._sim_siren_duration = random.uniform(5, 15)
                    self._sim_siren_elapsed  = 0.0
                    print(f"[SirenDetector] [SIREN] Sim siren starting "
                          f"(duration={self._sim_siren_duration:.1f}s)")

            if self._sim_siren_active:
                chunk = _generate_siren_chunk(self._sim_t)
                self._sim_siren_elapsed += dt
                if self._sim_siren_elapsed >= self._sim_siren_duration:
                    self._sim_siren_active = False
                    print("[SirenDetector] [END] Sim siren ending")
            else:
                # Background noise
                chunk = (0.02 * np.random.randn(CHUNK)).astype(np.float32)

            self._sim_t += dt
            hit = self._analyse_chunk(chunk)
            self._update_state(hit)
            time.sleep(dt)          # real-time pacing
