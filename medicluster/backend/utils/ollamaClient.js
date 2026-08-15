/**
 * backend/utils/ollamaClient.js
 *
 * Unified Ollama client used by every route that previously talked to Anthropic.
 *
 * Environment
 * -----------
 *   OLLAMA_MODE         "cloud" | "local" | "auto"
 *                      cloud  → Ollama Cloud only (no local daemon ever)
 *                      local  → local daemon only, ignore any cloud keys
 *                      auto   → use whichever is reachable (default)
 *   OLLAMA_URL          base URL for Ollama Cloud or local daemon
 *                       cloud  : https://ollama.com
 *                       local  : http://localhost:11434
 *   OLLAMA_API_KEY      single key (back-compat). Treated as a 1-entry pool.
 *   OLLAMA_API_KEYS     comma-separated list of keys. Each entry may be:
 *                         "key"
 *                         "label|key"          (label is logged for diagnostics)
 *                         "label|key|region"   (region = us / eu / ap, optional)
 *   OLLAMA_MODEL        default text model pin
 *   OLLAMA_VISION_MODEL default vision model pin
 *   OLLAMA_PREFERRED_FAMILIES   reorder priority (e.g. "minimax,gemma,qwen")
 *   OLLAMA_KEY_COOLDOWN_MS      how long to disable a key after a hard
 *                               failure (default 60_000)
 *
 * Public API
 * ----------
 *   chatText(prompt, opts)                  → {reply, model}
 *   chatVision({prompt, imageB64, ...})     → {reply, model, usedVision}
 *   listModels()                            → array of {name}
 *   messagesCreate({model, system, ...})    → Anthropic-shape adapter
 *
 * Multi-key behaviour
 * --------------------
 *   On every call the client iterates the configured key pool, trying each key
 *   until one succeeds. Soft failures (network / 5xx / model-not-found) move
 *   to the next candidate model on the same key. Hard failures (401 / 403 /
 *   429) flag the offending key as unhealthy for `OLLAMA_KEY_COOLDOWN_MS`,
 *   then continue with the next healthy key. If every key is unhealthy the
 *   client raises `OllamaUnavailableError`.
 */

const axios = require("axios");
const SystemConfig = require("../models/SystemConfig");

const DEFAULT_LOCAL_URL = "http://localhost:11434";
const DEFAULT_CLOUD_URL = "https://ollama.com";
const KEY_COOLDOWN_MS = Number(process.env.OLLAMA_KEY_COOLDOWN_MS || 60_000);

async function getDynamicConfig() {
  const defaults = {
    ollamaHost: process.env.OLLAMA_URL || "http://localhost:11434",
    ollamaKey: process.env.OLLAMA_API_KEY || "",
    agentRouterKey: process.env.AGENTROUTER_API_KEY || "",
    omniRouteKey: process.env.OMNIROUTE_API_KEY || ""
  };
  
  try {
    const configs = await SystemConfig.find({
      key: { $in: ["ollamaHost", "ollamaKey", "agentRouterKey", "omniRouteKey"] }
    });
    
    const configMap = configs.reduce((acc, cur) => {
      acc[cur.key] = cur.value;
      return acc;
    }, {});
    
    return {
      ollamaHost: configMap.ollamaHost || defaults.ollamaHost,
      ollamaKey: configMap.ollamaKey || defaults.ollamaKey,
      agentRouterKey: configMap.agentRouterKey || defaults.agentRouterKey,
      omniRouteKey: configMap.omniRouteKey || defaults.omniRouteKey
    };
  } catch (e) {
    console.error("Failed to load dynamic config from database:", e.message);
    return defaults;
  }
}

class OllamaUnavailableError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "OllamaUnavailableError";
    if (cause) this.cause = cause;
  }
}

// ── Key pool ──────────────────────────────────────────────────────────────────
// In-memory pool: { id, label, region, key, healthy, cooldownUntil, failures }
let _pool = null;
let _poolBuiltAt = 0;

function _parseKeys() {
  // Returns array of {id, label, region, key}. Order is preserved (the user
  // decides the priority order in OLLAMA_API_KEYS).
  const out = [];
  const seen = new Set();

  const push = (raw, idx) => {
    if (!raw) return;
    const trimmed = String(raw).trim();
    if (!trimmed) return;
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    // Format: "label|key|region" or "label|key" or just "key"
    const parts = trimmed.split("|").map((s) => s.trim());
    let label = `key-${idx + 1}`;
    let key = trimmed;
    let region = "";
    if (parts.length >= 2) {
      [label, key, region] = [parts[0], parts[1], parts[2] || ""];
      if (!key) key = trimmed;
    }
    out.push({
      id: `k${idx}-${label}`,
      label,
      region: region || undefined,
      key,
    });
  };

  const multi = process.env.OLLAMA_API_KEYS || "";
  if (multi) {
    multi.split(",").forEach((raw, i) => push(raw, i));
  }

  const single = process.env.OLLAMA_API_KEY || "";
  if (single) push(single, out.length);

  return out;
}

function _getPool() {
  // Rebuild pool only when env changes (cheap process.env diff).
  const sig = [
    process.env.OLLAMA_API_KEY || "",
    process.env.OLLAMA_API_KEYS || "",
  ].join("\u0001");
  if (_pool && _poolBuiltAt === sig) return _pool;
  const keys = _parseKeys();
  _pool = keys.map((k) => ({
    ...k,
    healthy: true,
    cooldownUntil: 0,
    failures: 0,
  }));
  _poolBuiltAt = sig;
  return _pool;
}

function _resetPoolForTests() {
  _pool = null;
  _poolBuiltAt = 0;
}

function _isHealthy(entry) {
  return entry.healthy && entry.cooldownUntil <= Date.now();
}

function _markFailure(entry, hard = false) {
  entry.failures += 1;
  if (hard) {
    entry.healthy = false;
    entry.cooldownUntil = Date.now() + KEY_COOLDOWN_MS;
  }
}

function _markSuccess(entry) {
  entry.healthy = true;
  entry.cooldownUntil = 0;
  entry.failures = 0;
}

function _activeKeyEntries() {
  return _getPool().filter(_isHealthy);
}

function _allKeyEntries() {
  return _getPool();
}

// ── Mode / URL ────────────────────────────────────────────────────────────────
function getMode() {
  const m = (process.env.OLLAMA_MODE || "auto").toLowerCase();
  if (m === "cloud" || m === "local" || m === "auto") return m;
  return "auto";
}

function _isLocalhostUrl(url) {
  return /(^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(url);
}

function _resolveUrl() {
  const env = (process.env.OLLAMA_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");
  if (getMode() === "cloud") return DEFAULT_CLOUD_URL;
  return DEFAULT_LOCAL_URL;
}

function getConfig() {
  const url = _resolveUrl();
  const defaultTextModel =
    process.env.OLLAMA_MODEL || process.env.OLLAMA_TEXT_MODEL || "";
  const defaultVisionModel =
    process.env.OLLAMA_VISION_MODEL || process.env.OLLAMA_MODEL || "";
  return {
    url,
    mode: getMode(),
    isLocal: _isLocalhostUrl(url),
    pool: _getPool(),
    activeKeys: _activeKeyEntries(),
    defaultTextModel,
    defaultVisionModel,
  };
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function authHeadersForKey(key) {
  if (!key) return {};
  return { Authorization: `Bearer ${key}` };
}

function authHeaders() {
  // Convenience: pick the first healthy key. Used by endpoints that don't need
  // multi-key rotation (e.g. listing models).
  const entry = _activeKeyEntries()[0];
  return authHeadersForKey(entry?.key);
}

function isPlaceholder(value) {
  if (!value) return true;
  const lower = value.toLowerCase();
  return (
    lower.startsWith("«redacted") ||
    lower.startsWith("sk-ant") ||
    lower.startsWith("***") ||
    lower === "change_me" ||
    lower.length < 6
  );
}

function ollamaConfigured() {
  const cfg = getConfig();
  if (getMode() === "cloud") {
    // Cloud mode requires at least one valid key.
    return cfg.pool.length > 0 && cfg.pool.some((k) => !isPlaceholder(k.key));
  }
  if (getMode() === "local") {
    return cfg.isLocal;
  }
  // auto: either a key or a local URL works.
  return (
    (cfg.pool.length > 0 && cfg.pool.some((k) => !isPlaceholder(k.key))) ||
    cfg.isLocal
  );
}

async function listModels({ timeout = 2000 } = {}) {
  const { url, activeKeys, isLocal } = getConfig();

  // Local daemon: try without auth first, then any configured key.
  if (isLocal) {
    try {
      const r = await axios.get(`${url}/api/tags`, { timeout });
      if (Array.isArray(r.data?.models)) return r.data.models;
    } catch {}
  }

  // Cloud / fallback: probe each active key once.
  for (const entry of activeKeys) {
    try {
      const r = await axios.get(`${url}/api/tags`, {
        headers: authHeadersForKey(entry.key),
        timeout,
      });
      if (Array.isArray(r.data?.models)) return r.data.models;
    } catch {
      _markFailure(entry, false);
    }
  }
  return [];
}

function looksLikeVisionModel(name = "") {
  const n = name.toLowerCase();
  // Strip trailing ":tag" so ":cloud", ":latest", ":27b" etc. don't confuse
  // the matcher (we still look at the base family + size hints).
  const base = n.split(":")[0];
  // Ollama tags use the form `name:<tag>` — a tag can include dashes
  // (e.g. `qwen3.5:397b-cloud`, `mistral-large-3:675b-cloud`,
  // `gemma4:31b-cloud`). Treat any tag containing `cloud` as a cloud tag.
  const tagPart = n.includes(":") ? n.slice(n.indexOf(":") + 1) : "";
  const isCloud = /\bcloud\b/.test(tagPart);

  // ── Hard exclusions ────────────────────────────────────────────────────────
  // Pure text-only / embedding / classification / coding-specialist models that
  // share family names with vision ones. Skip those even if a substring match
  // would otherwise hit.
  const isPureNonVision =
    /\bembed(?:ding)?(-text)?\b/.test(base) ||
    /\bindex[-_ ]?advisor\b/.test(base) ||
    /\bbert\b/.test(base) ||
    /laravel|php\d+|boost\b/.test(base) ||
    /mysql|sql[-_ ]advisor/.test(base);

  if (isPureNonVision) return false;

  // Substring hits — strong vision signals from well-known multimodal names.
  const substringHits =
    n.includes("llava") ||
    n.includes("vision") ||
    n.includes("multimodal") ||
    n.includes("-vl") ||
    /(^|\b)vl\d/.test(base) ||
    n.includes("minimax");        // minimax-m3 / m2.7 are multimodal per cloud catalog

  // Family + version patterns that imply vision capability on Ollama / Cloud.
  const patternHits =
    /^gemma[2-9]/.test(base) ||                  // gemma3+ and gemma4 are multimodal
    /^qwen(\d(\.\d+)?)?-vl/.test(base) ||        // qwen-vl, qwen2.5-vl, qwen3-vl
    /^qwen\d(\.\d+)?-vl/.test(base) ||
    /^qwen\d-vl/.test(base) ||
    /qwen\d(\.\d+)?-vl/.test(base) ||
    /^kimi(-k)?\d?-?vl/.test(base) ||            // kimi-vl / kimi-k-vl
    /(^|\/)kimi.*vl/.test(n) ||
    /^llama-?3(\.\d+)?-?vision/.test(base) ||    // llama-3.2-vision, llama3.2-vision
    /llama.*vision/.test(n) ||
    /^mistral.*vision/.test(base) ||
    /^pixtral/.test(base) ||                     // mistral's pixtral family
    /^nemotron.*vision/.test(base) ||
    /^nemotron-?\d-?vl/.test(base) ||
    /^deepseek.*vl/.test(base) ||
    /^deepseek-v\d/.test(base) ||                // deepseek-v4-flash (multimodal)
    /^glm-?\d?v/.test(base) ||                   // glm-4v / glm-5v / glm-5.1
    /^internvl/.test(base) ||
    /^molmo/.test(base) ||
    /^aria/.test(base) ||
    /^minimax-m\d/.test(base) ||                 // minimax-m3, minimax-m2.7, minimax-m4
    /^minimax-/.test(base) && /m\d/.test(base);

  if (substringHits || patternHits) return true;

  // Generational hint for "m3" / "m4" — minimax-m3 and similar are multimodal.
  if (/(^|\b)m[34]\b/.test(base)) {
    return true;
  }

  // Ollama Cloud heuristic — any well-known family exposed as ":cloud" on the
  // current catalog is multimodal. The catalog the user shared is full of
  // `*:cloud` entries from families that are all multimodal (gemma4, qwen3.5,
  // kimi-k2.6+, kimi-k3, mistral-large-3, glm-5, deepseek-v4, nemotron-3).
  // We treat these as vision-capable unless explicitly excluded above.
  if (isCloud) {
    const knownMultimodalCloudFamilies = [
      "gemma",          // gemma3, gemma4
      "qwen",           // qwen3.5, qwen3-vl, etc.
      "kimi",           // kimi-k2.6, kimi-k2.7, kimi-k3
      "mistral",        // mistral-large-3
      "minimax",        // minimax-m3, m2.7
      "glm",            // glm-5.1, glm-5.2
      "deepseek",       // deepseek-v4-flash
      "nemotron",       // nemotron-3-super / ultra
      "llama",          // llama3.2-vision, llama4
      "pixtral",
      "internvl",
      "aria",
      "molmo",
    ];
    return knownMultimodalCloudFamilies.some((fam) => base.includes(fam));
  }

  return false;
}

// ── Curated model catalogs ───────────────────────────────────────────────────
// Used when /api/tags returns empty (e.g. Ollama Cloud auth mode, transient
// /api/tags outage) or as a fallback ordering when the local daemon only has
// a subset. Names match those exposed by Ollama Cloud and Ollama's library.
const DEFAULT_VISION_CATALOG = [
  // Anthropic-style "best vision" picks — small to large
  "llama3.2-vision",
  "llava-llama3",
  "llava:13b",
  "llava:7b",
  // Gemma family — multimodal from gemma3 onward
  "gemma3:27b",
  "gemma3:12b",
  "gemma3:4b",
  "gemma4:31b",
  "gemma4:27b",
  // Qwen-VL family
  "qwen2.5-vl:7b",
  "qwen2.5-vl:32b",
  "qwen2.5-vl:72b",
  "qwen3-vl:8b",
  "qwen3-vl:32b",
  "qwen3-vl:235b",
  // Kimi-VL family
  "kimi-vl",
  "kimi-k2.7-vl",
  // Mistral / Pixtral
  "mistral-large-3",
  "pixtral:12b",
  "pixtral:24b",
  // NVIDIA Nemotron vision
  "nemotron-3-vl",
  // DeepSeek vision
  "deepseek-v4-flash",
  // GLM vision
  "glm-5.1",
  "glm-4v",
  // minimax (multimodal per cloud catalog)
  "minimax-m3",
  "minimax-m3:cloud",
  "minimax-m2.7",
  "minimax-m2.7:cloud",
  // InternVL / Molmo
  "internvl2:8b",
  "internvl2:26b",
  "molmo:7b",
];

const DEFAULT_TEXT_CATALOG = [
  "llama3.3",
  "llama3.1:70b",
  "llama3.1:8b",
  "qwen3:32b",
  "qwen3:8b",
  "gemma3:27b",
  "mistral-large-3",
  "nemotron-3-super",
  "nemotron-3-ultra",
  "deepseek-v3",
  "glm-5.2",
  "minimax-m2.7",
];

function preferredFamilies() {
  // Comma-separated list, e.g. "minimax,gemma,qwen" to reorder priority.
  const raw = (process.env.OLLAMA_PREFERRED_FAMILIES || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function rankByPreference(models, preferredFamilies) {
  if (!models.length || !preferredFamilies.length) return models;
  const buckets = preferredFamilies.map(() => []);
  const rest = [];
  for (const m of models) {
    const idx = preferredFamilies.findIndex((fam) =>
      String(m.name).toLowerCase().includes(fam),
    );
    if (idx >= 0) buckets[idx].push(m);
    else rest.push(m);
  }
  return [...buckets.flat(), ...rest];
}

function pickPreferred(models, { vision = false } = {}) {
  if (!models.length) return null;
  const lower = models.map((m) => ({ ...m, _n: m.name.toLowerCase() }));
  // Preferred families first
  const priority =
    lower.find((m) => m._n.includes("nemotron")) ||
    lower.find((m) => m._n.includes("minimax")) ||
    lower.find((m) => vision && looksLikeVisionModel(m.name)) ||
    lower.find((m) => !vision && !looksLikeVisionModel(m.name)) ||
    lower[0];
  return priority;
}

/**
 * Execute `request()` against Ollama, trying the candidate list on each active
 * key in the pool. Returns `{reply, model, key}` on success or throws
 * OllamaUnavailableError when every key × every model has been attempted.
 *
 * `request(keyEntry)` must return the parsed axios response (or throw). The
 * caller decides how to interpret the response — typically checking
 * `r.data?.response` for a non-empty string.
 */
async function _callWithKeyRotation({ candidates, buildPayload, request, label, url: customUrl, keys: customKeys }) {
  const cfg = getConfig();
  const url = customUrl || cfg.url;
  const rawKeys = customKeys || _activeKeyEntries();
  const keys = rawKeys.length ? rawKeys : (_isLocalhostUrl(url) ? [{ label: "local-daemon", key: "" }] : []);
  const lastErrors = [];

  if (!keys.length) {
    throw new OllamaUnavailableError(
      `No healthy Ollama API keys available (${label}). Check OLLAMA_API_KEYS / OLLAMA_API_KEY.`,
    );
  }

  for (const keyEntry of keys) {
    const headers = { ...authHeadersForKey(keyEntry.key), "Content-Type": "application/json" };
    for (const candidate of candidates) {
      const payload = buildPayload(candidate);
      try {
        const r = await request({ url, headers, payload, candidate, keyEntry });
        const reply = r?.data?.response;
        if (reply && typeof reply === "string" && reply.trim().length > 0) {
          _markSuccess(keyEntry);
          return {
            reply: reply.trim(),
            model: candidate.name,
            key: keyEntry.label,
            region: keyEntry.region,
          };
        }
        // Empty body — soft failure, try next candidate on the same key.
        lastErrors.push(new Error(`empty response from ${candidate.name} via ${keyEntry.label}`));
      } catch (err) {
        const status = err?.response?.status;
        const isHard = status === 401 || status === 403 || status === 429;
        lastErrors.push(err);
        if (isHard) {
          _markFailure(keyEntry, true);
          break; // move to next key
        }
        // Soft failure (network / 5xx / model-not-found): try the next
        // candidate on the same key.
      }
    }
  }

  throw new OllamaUnavailableError(
    `No Ollama model was able to fulfil the ${label} request (tried ${candidates.length} candidate(s) across ${keys.length} key(s)).`,
    lastErrors[lastErrors.length - 1],
  );
}

async function chatText(prompt, { system, model, maxTokens = 800, temperature } = {}) {
  const dynamicConfig = await getDynamicConfig();

  // 1. Try AgentRouter if configured
  if (dynamicConfig.agentRouterKey) {
    try {
      console.log("Routing text query via AgentRouter...");
      const response = await axios.post(
        "https://api.agentrouter.com/v1/chat/completions",
        {
          model: model || "meta-llama/llama-3.3-70b-instruct",
          messages: [
            ...(system ? [{ role: "system", content: system }] : []),
            { role: "user", content: prompt }
          ],
          max_tokens: maxTokens,
          temperature: temperature ?? 0.2
        },
        {
          headers: {
            Authorization: `Bearer ${dynamicConfig.agentRouterKey}`,
            "Content-Type": "application/json"
          },
          timeout: 20000
        }
      );
      const reply = response.data?.choices?.[0]?.message?.content;
      if (reply) {
        return { reply: reply.trim(), model: model || "agentrouter-default" };
      }
    } catch (err) {
      console.error("AgentRouter text query failed:", err.message);
    }
  }

  // 2. Try OmniRoute if configured
  if (dynamicConfig.omniRouteKey) {
    try {
      console.log("Routing text query via OmniRoute...");
      const response = await axios.post(
        "http://localhost:20128/v1/chat/completions",
        {
          model: model || "meta-llama/llama-3.3-70b-instruct",
          messages: [
            ...(system ? [{ role: "system", content: system }] : []),
            { role: "user", content: prompt }
          ],
          max_tokens: maxTokens,
          temperature: temperature ?? 0.2
        },
        {
          headers: {
            Authorization: `Bearer ${dynamicConfig.omniRouteKey}`,
            "Content-Type": "application/json"
          },
          timeout: 20000
        }
      );
      const reply = response.data?.choices?.[0]?.message?.content;
      if (reply) {
        return { reply: reply.trim(), model: model || "omniroute-default" };
      }
    } catch (err) {
      console.error("OmniRoute text query failed:", err.message);
    }
  }

  const { defaultTextModel, mode } = getConfig();
  const prefs = preferredFamilies();
  let candidates = [];

  if (model) {
    candidates = [{ name: model }];
  } else if (defaultTextModel) {
    candidates = [{ name: defaultTextModel }];
  } else if (mode === "cloud") {
    // Cloud-only mode: never probe a local daemon; go straight to the curated
    // text catalog so model pulls happen against Ollama Cloud.
    candidates = DEFAULT_TEXT_CATALOG.map((name) => ({ name }));
  } else {
    const models = await listModels();
    if (models.length) {
      const ordered = models
          .filter((m) => !looksLikeVisionModel(m.name))
          .concat(models.filter((m) => looksLikeVisionModel(m.name)));
      const textFirst = rankByPreference(
        ordered.length ? ordered : models,
        prefs,
      );
      candidates = textFirst;
    } else {
      candidates = DEFAULT_TEXT_CATALOG.map((name) => ({ name }));
    }
  }

  // Override Ollama key & host if specified in settings
  const customKeys = dynamicConfig.ollamaKey 
    ? [{ label: "db-ollama-key", key: dynamicConfig.ollamaKey, region: undefined }]
    : null;

  return _callWithKeyRotation({
    candidates,
    label: "text",
    url: dynamicConfig.ollamaHost,
    keys: customKeys,
    buildPayload: (candidate) => {
      const payload = {
        model: candidate.name,
        prompt,
        stream: false,
      };
      if (system) payload.system = system;
      if (maxTokens) payload.options = { num_predict: maxTokens };
      if (typeof temperature === "number") payload.options = { ...payload.options, temperature };
      return payload;
    },
    request: ({ url, headers, payload }) =>
      axios.post(`${url}/api/generate`, payload, { headers, timeout: 20_000 }),
  });
}

/**
 * Vision-capable chat. Pass `imageB64` (raw base64, no data: prefix) plus
 * mediaType so the candidate picker can prioritise vision models.
 */
async function chatVision({
  prompt,
  system,
  imageB64,
  mediaType,
  model,
  maxTokens = 1024,
  temperature,
}) {
  const dynamicConfig = await getDynamicConfig();

  // 1. Try AgentRouter if configured
  if (dynamicConfig.agentRouterKey) {
    try {
      console.log("Routing vision query via AgentRouter...");
      const response = await axios.post(
        "https://api.agentrouter.com/v1/chat/completions",
        {
          model: model || "meta-llama/llama-3.2-90b-vision-instruct",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `${system ? system + "\n\n" : ""}User: ${prompt}`.trim() },
                ...(imageB64 ? [{
                  type: "image_url",
                  image_url: {
                    url: `data:${mediaType || "image/jpeg"};base64,${imageB64}`
                  }
                }] : [])
              ]
            }
          ],
          max_tokens: maxTokens,
          temperature: temperature ?? 0.2
        },
        {
          headers: {
            Authorization: `Bearer ${dynamicConfig.agentRouterKey}`,
            "Content-Type": "application/json"
          },
          timeout: 20000
        }
      );
      const reply = response.data?.choices?.[0]?.message?.content;
      if (reply) {
        return {
          reply: reply.trim(),
          model: model || "agentrouter-vision-default",
          usedVision: Boolean(imageB64),
          mediaType: mediaType || null
        };
      }
    } catch (err) {
      console.error("AgentRouter vision failed:", err.message);
    }
  }

  // 2. Try OmniRoute if configured
  if (dynamicConfig.omniRouteKey) {
    try {
      console.log("Routing vision query via OmniRoute...");
      const response = await axios.post(
        "http://localhost:20128/v1/chat/completions",
        {
          model: model || "meta-llama/llama-3.2-90b-vision-instruct",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `${system ? system + "\n\n" : ""}User: ${prompt}`.trim() },
                ...(imageB64 ? [{
                  type: "image_url",
                  image_url: {
                    url: `data:${mediaType || "image/jpeg"};base64,${imageB64}`
                  }
                }] : [])
              ]
            }
          ],
          max_tokens: maxTokens,
          temperature: temperature ?? 0.2
        },
        {
          headers: {
            Authorization: `Bearer ${dynamicConfig.omniRouteKey}`,
            "Content-Type": "application/json"
          },
          timeout: 20000
        }
      );
      const reply = response.data?.choices?.[0]?.message?.content;
      if (reply) {
        return {
          reply: reply.trim(),
          model: model || "omniroute-vision-default",
          usedVision: Boolean(imageB64),
          mediaType: mediaType || null
        };
      }
    } catch (err) {
      console.error("OmniRoute vision failed:", err.message);
    }
  }

  const { defaultVisionModel, mode } = getConfig();

  let candidates = [];
  if (model) {
    candidates = [{ name: model }];
  } else if (defaultVisionModel) {
    candidates = [{ name: defaultVisionModel }];
  } else if (mode === "cloud") {
    candidates = DEFAULT_VISION_CATALOG.map((name) => ({ name }));
  } else {
    const models = await listModels();
    if (models.length) {
      const visionFirst = models.filter((m) => looksLikeVisionModel(m.name));
      const textFirst = models.filter((m) => !looksLikeVisionModel(m.name));
      const ranked = rankByPreference(
        [...visionFirst, ...textFirst],
        preferredFamilies(),
      );
      candidates = ranked.length ? ranked : models;
      if (candidates.length === 0) candidates = models;
    } else {
      candidates = DEFAULT_VISION_CATALOG.map((name) => ({ name }));
    }
  }

  // Only keep minimax and gemma4 candidates since they are vision models
  candidates = candidates.filter((c) => {
    const name = c.name.toLowerCase();
    return name.includes("minimax") || name.includes("gemma4");
  });

  // Ensure minimax is first, and gemma4 is mapped to gemma4:31b-cloud
  const finalCandidates = [];
  const minimaxPart = candidates.filter((c) => c.name.toLowerCase().includes("minimax"));
  const gemmaPart = candidates.filter((c) => c.name.toLowerCase().includes("gemma4"));

  minimaxPart.forEach((c) => finalCandidates.push({ name: c.name }));
  gemmaPart.forEach((c) => {
    if (c.name === "gemma4:cloud") {
      finalCandidates.push({ name: "gemma4:31b-cloud" });
    } else {
      finalCandidates.push({ name: c.name });
    }
  });

  if (finalCandidates.length === 0) {
    candidates = [{ name: "minimax-m3:cloud" }, { name: "gemma4:31b-cloud" }];
  } else {
    // Deduplicate and set candidates
    const seenNames = new Set();
    candidates = finalCandidates.filter((c) => {
      if (seenNames.has(c.name)) return false;
      seenNames.add(c.name);
      return true;
    });
  }

  // Override Ollama key & host if specified in settings
  const customKeys = dynamicConfig.ollamaKey 
    ? [{ label: "db-ollama-key", key: dynamicConfig.ollamaKey, region: undefined }]
    : null;

  const result = await _callWithKeyRotation({
    candidates,
    label: "vision",
    url: dynamicConfig.ollamaHost,
    keys: customKeys,
    buildPayload: (candidate) => {
      const supportsVision = looksLikeVisionModel(candidate.name);
      const payload = {
        model: candidate.name,
        prompt: supportsVision
          ? `${system ? system + "\n\n" : ""}User: ${prompt}`.trim()
          : `${system ? system + "\n\n" : ""}[System note: a medical image was uploaded but the selected model (${candidate.name}) is text-only; respond using any context you have.]\n\nUser: ${prompt}`,
        stream: false,
      };
      if (supportsVision && imageB64) {
        payload.images = [imageB64];
      }
      if (maxTokens) payload.options = { num_predict: maxTokens };
      if (typeof temperature === "number") payload.options = { ...payload.options, temperature };
      return payload;
    },
    request: ({ url, headers, payload, candidate }) => {
      return axios.post(`${url}/api/generate`, payload, {
        headers,
        timeout: 20_000,
      });
    },
  });

  // Re-derive usedVision for the caller (mirrors the prior contract).
  return {
    ...result,
    usedVision: Boolean(looksLikeVisionModel(result.model) && imageB64),
    mediaType: mediaType || null,
  };
}

/**
 * Anthropic-compatible adapter so route files can drop their SDK usage with
 * minimal diff. Returns { content: [{text}] } to mimic messages.create().
 */
async function messagesCreate({ model, system, messages, max_tokens = 800 }) {
  // Flatten the messages array into a single prompt + optional image.
  let prompt = "";
  let imageB64 = null;
  let mediaType = null;
  for (const m of messages || []) {
    if (typeof m.content === "string") {
      prompt += `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}\n`;
    } else if (Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type === "text") {
          prompt += `${m.role === "assistant" ? "Assistant" : "User"}: ${block.text}\n`;
        } else if (block.type === "image" && block.source?.type === "base64") {
          imageB64 = block.source.data;
          mediaType = block.source.media_type || mediaType;
        }
      }
    }
  }
  if (imageB64) {
    const { reply, model: used } = await chatVision({
      prompt: prompt.trim(),
      system,
      imageB64,
      mediaType,
      model,
      maxTokens: max_tokens,
    });
    return { content: [{ text: reply }], model: used };
  }
  const { reply, model: used } = await chatText(prompt.trim(), {
    system,
    model,
    maxTokens: max_tokens,
  });
  return { content: [{ text: reply }], model: used };
}

module.exports = {
  OllamaUnavailableError,
  getConfig,
  getMode,
  ollamaConfigured,
  isPlaceholder,
  listModels,
  pickPreferred,
  looksLikeVisionModel,
  preferredFamilies,
  rankByPreference,
  DEFAULT_VISION_CATALOG,
  DEFAULT_TEXT_CATALOG,
  // Multi-key pool diagnostics (used by /api/health endpoints and tests).
  getKeyPool: _allKeyEntries,
  resetKeyPool: _resetPoolForTests,
  authHeadersForKey,
  chatText,
  chatVision,
  messagesCreate,
};
