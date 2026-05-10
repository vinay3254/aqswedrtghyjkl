/**
 * dispatchBroadcast.js
 * Cross-tab messaging between dispatcher dashboard and driver interface
 * using the BroadcastChannel API (works on same origin, no server needed).
 */

const CHANNEL_NAME = 'ambulance-dispatch';

class DispatchBroadcast {
  constructor() {
    this.channel = null;
    this.listeners = new Map();
    this._init();
  }

  _init() {
    if (typeof BroadcastChannel === 'undefined') return; // SSR safety
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = (e) => {
      const { type, payload } = e.data || {};
      if (!type) return;
      const handlers = this.listeners.get(type) || [];
      handlers.forEach(fn => fn(payload));
      // wildcard listeners
      const all = this.listeners.get('*') || [];
      all.forEach(fn => fn({ type, payload }));
    };
  }

  /** Send a typed message to all other tabs */
  send(type, payload = {}) {
    if (!this.channel) return;
    this.channel.postMessage({ type, payload });
  }

  /** Listen for a specific message type (or '*' for all) */
  on(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  off(type, handler) {
    if (!this.listeners.has(type)) return;
    const updated = this.listeners.get(type).filter(fn => fn !== handler);
    this.listeners.set(type, updated);
  }

  destroy() {
    this.channel?.close();
  }
}

export const dispatchBroadcast = new DispatchBroadcast();

/** Message types */
export const DISPATCH_EVENTS = {
  SOS_CREATED:        'SOS_CREATED',        // new SOS incident → notify driver
  INCIDENT_ASSIGNED:  'INCIDENT_ASSIGNED',  // ambulance assigned to incident
  INCIDENT_UPDATED:   'INCIDENT_UPDATED',   // status change
};
