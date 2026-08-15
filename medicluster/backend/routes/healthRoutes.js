/**
 * backend/routes/healthRoutes.js
 *
 * Diagnostic endpoints for the Ollama key pool — useful when you have multiple
 * cloud accounts and want to see which ones are healthy, parked, etc.
 *
 *   GET /api/health/ollama   → key pool snapshot (no key values returned)
 *   GET /api/health/ollama/pool → same data, raw shape (for dashboards)
 *
 * Never returns the actual key strings — only labels, regions, and health
 * state — so this endpoint is safe to expose without auth.
 */

const express = require("express");
const {
  getConfig,
  getMode,
  ollamaConfigured,
  getKeyPool,
  listModels,
} = require("../utils/ollamaClient");

const router = express.Router();

function _safeSnapshot() {
  const pool = getKeyPool();
  const cfg = getConfig();
  return {
    mode: getMode(),
    url: cfg.url,
    isLocal: cfg.isLocal,
    configured: ollamaConfigured(),
    poolSize: pool.length,
    keys: pool.map((k, i) => ({
      index: i,
      label: k.label,
      region: k.region || null,
      healthy: k.healthy && k.cooldownUntil <= Date.now(),
      cooldownUntil: k.cooldownUntil > Date.now() ? k.cooldownUntil : null,
      failures: k.failures,
      // NEVER echo the key itself — only a 6-char fingerprint for identification.
      fingerprint: k.key ? `${k.key.slice(0, 4)}…${k.key.slice(-4)}` : null,
    })),
  };
}

router.get("/ollama", async (_req, res) => {
  const snap = _safeSnapshot();
  // Cheap reachability probe — try /api/tags with the first healthy key.
  let reachable = false;
  let reachableError = null;
  try {
    const models = await listModels({ timeout: 1500 });
    reachable = Array.isArray(models);
  } catch (e) {
    reachableError = e.message;
  }
  res.json({ ...snap, reachable, reachableError });
});

router.get("/ollama/pool", (_req, res) => {
  res.json(_safeSnapshot());
});

module.exports = router;
