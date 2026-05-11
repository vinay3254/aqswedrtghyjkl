const logger = require('../utils/logger');

const store = new Map();

const get = async (key) => {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expires && Date.now() > entry.expires) { store.delete(key); return null; }
  return entry.value;
};

const set = async (key, value, ttl = 3600) => {
  store.set(key, { value, expires: ttl ? Date.now() + ttl * 1000 : null });
  return true;
};

const del = async (key) => { store.delete(key); return true; };

const exists = async (key) => {
  const entry = store.get(key);
  if (!entry) return false;
  if (entry.expires && Date.now() > entry.expires) { store.delete(key); return false; }
  return true;
};

const healthCheck = async () => ({ healthy: true, response: 'OK', size: store.size });

module.exports = { get, set, del, exists, healthCheck };
