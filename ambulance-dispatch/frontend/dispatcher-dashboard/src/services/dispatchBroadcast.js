const CHANNEL_NAME = 'ambulance-dispatch';
const STORAGE_KEY = 'dispatch_latest_event';

class DispatchBroadcast {
  constructor() {
    this.channel = null;
    this.listeners = new Map();
    this._init();
  }

  _init() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      // Receive events from OTHER tabs
      this.channel.onmessage = (e) => {
        const { type, payload } = e.data || {};
        if (type) this._fire(type, payload);
      };
    }

    // Storage event fires in OTHER tabs when localStorage changes
    // — acts as a fallback and also lets late-opening tabs replay the last event
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const { type, payload } = JSON.parse(e.newValue);
          if (type) this._fire(type, payload);
        } catch {}
      }
    });
  }

  _fire(type, payload) {
    (this.listeners.get(type) || []).forEach(fn => fn(payload));
    (this.listeners.get('*') || []).forEach(fn => fn({ type, payload }));
  }

  /** Send a typed message — reaches same tab, other tabs, and late-opening tabs */
  send(type, payload = {}) {
    const msg = { type, payload, ts: Date.now() };
    // 1. Other tabs via BroadcastChannel
    this.channel?.postMessage(msg);
    // 2. Other tabs via localStorage storage event
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msg));
    // 3. Same tab — fire listeners directly (BroadcastChannel skips same tab)
    this._fire(type, payload);
  }

  /** Call on mount to replay last persisted event (catches late-opening driver tab) */
  replayLast(maxAgeMs = 60000) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const msg = JSON.parse(raw);
      if (Date.now() - msg.ts < maxAgeMs) {
        this._fire(msg.type, msg.payload);
      }
    } catch {}
  }

  on(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  off(type, handler) {
    if (!this.listeners.has(type)) return;
    this.listeners.set(type, this.listeners.get(type).filter(fn => fn !== handler));
  }

  destroy() { this.channel?.close(); }
}

export const dispatchBroadcast = new DispatchBroadcast();

export const DISPATCH_EVENTS = {
  SOS_CREATED:       'SOS_CREATED',
  INCIDENT_ASSIGNED: 'INCIDENT_ASSIGNED',
  INCIDENT_UPDATED:  'INCIDENT_UPDATED',
};
