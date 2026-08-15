import os
import re
import requests
import logging
import time

logger = logging.getLogger(__name__)

# ── Multi-key pool (mirrors backend/utils/ollamaClient.js) ────────────────────
# OLLAMA_MODE: "cloud" | "local" | "auto"
# OLLAMA_URL : defaults to https://ollama.com in cloud mode, localhost daemon
#              in local/auto.
# OLLAMA_API_KEYS : comma-separated list, each entry is "label|key|region" or
#                   "label|key" or just "key". Tried in order; on 401/403/429
#                   the offending key is parked for OLLAMA_KEY_COOLDOWN_MS.
KEY_COOLDOWN_MS = int(os.getenv("OLLAMA_KEY_COOLDOWN_MS", "60000"))


def _resolve_mode():
    return (os.getenv("OLLAMA_MODE", "auto").lower() or "auto")


def _default_url():
    return (
        "https://ollama.com"
        if _resolve_mode() == "cloud"
        else "http://localhost:11434"
    )


OLLAMA_URL = os.getenv("OLLAMA_URL", _default_url()).rstrip("/")


def _parse_keys():
    """Returns [{label, key, region}, ...] preserving user-specified order."""
    out, seen = [], set()

    def push(raw, idx):
        raw = (raw or "").strip()
        if not raw or raw in seen:
            return
        seen.add(raw)
        parts = [p.strip() for p in raw.split("|")]
        if len(parts) >= 2:
            label, key, region = parts[0], parts[1], parts[2] if len(parts) > 2 else ""
        else:
            label, key, region = f"key-{idx + 1}", raw, ""
        if not key:
            key = raw
        out.append({"label": label, "key": key, "region": region or None})

    multi = os.getenv("OLLAMA_API_KEYS", "")
    if multi:
        for i, raw in enumerate(multi.split(",")):
            push(raw, i)
    single = os.getenv("OLLAMA_API_KEY", "")
    if single:
        push(single, len(out))
    return out


# Live key pool: {label, key, region, healthy, cooldown_until, failures}
_KEY_POOL = []


def _refresh_pool():
    """Rebuild the pool if the underlying env changed."""
    sig = (os.getenv("OLLAMA_API_KEY", ""), os.getenv("OLLAMA_API_KEYS", ""))
    if not _KEY_POOL or _KEY_POOL[0].get("_sig") != sig:
        keys = _parse_keys()
        _KEY_POOL.clear()
        for k in keys:
            _KEY_POOL.append({
                "label": k["label"],
                "key": k["key"],
                "region": k.get("region"),
                "healthy": True,
                "cooldown_until": 0,
                "failures": 0,
                "_sig": sig,
            })


def _healthy_keys():
    _refresh_pool()
    now = time.time() * 1000
    return [k for k in _KEY_POOL if k["healthy"] and k["cooldown_until"] <= now]


def _mark_failure(entry, hard: bool = False):
    entry["failures"] += 1
    if hard:
        entry["healthy"] = False
        entry["cooldown_until"] = time.time() * 1000 + KEY_COOLDOWN_MS


def _mark_success(entry):
    entry["healthy"] = True
    entry["cooldown_until"] = 0
    entry["failures"] = 0


# Headers for the *first* healthy key (used for one-shot endpoints like /api/tags).
def _ollama_headers():
    keys = _healthy_keys()
    if keys:
        return {"Authorization": f"Bearer {keys[0]['key']}"}
    return {}


def _headers_for(entry):
    if entry and entry.get("key"):
        return {"Authorization": f"Bearer {entry['key']}"}
    return {}


def _is_vision_model(name: str) -> bool:
    """Mirror the JS looksLikeVisionModel() heuristic — see ollamaClient.js.

    The Python helper is only used for the chatbot (text-only flow), but the
    auto-detect still picks the best model from /api/tags so we keep parity.
    """
    n = (name or "").lower()
    base = n.split(":")[0]
    tag = n[n.index(":") + 1:] if ":" in n else ""
    is_cloud = "cloud" in tag.split("-") or tag == "cloud"

    # Hard exclusions
    if any(k in base for k in ("embed-text", "embedding", "index-advisor",
                                 "bert", "laravel", "php", "boost", "mysql",
                                 "sql-advisor")):
        return False

    # Strong vision signals
    if any(s in n for s in ("llava", "vision", "multimodal", "-vl", "minimax")):
        return True
    import re
    if re.search(r"(^|\b)vl\d", base):
        return True

    # Family + version patterns
    vision_patterns = (
        r"^gemma[2-9]",
        r"^qwen(\d(\.\d+)?)?-vl",
        r"^qwen\d(\.\d+)?-vl",
        r"^qwen\d-vl",
        r"^kimi(-k)?\d?-?vl",
        r"^llama-?3(\.\d+)?-?vision",
        r"^mistral.*vision",
        r"^pixtral",
        r"^nemotron.*vision",
        r"^nemotron-?\d-?vl",
        r"^deepseek.*vl",
        r"^deepseek-v\d",
        r"^glm-?\d?v",
        r"^internvl",
        r"^molmo",
        r"^aria",
        r"^minimax-m\d",
        r"(^|\b)m[34]\b",
    )
    if any(re.search(p, base) for p in vision_patterns):
        return True

    # Cloud heuristic for known multimodal families
    if is_cloud:
        return any(fam in base for fam in (
            "gemma", "qwen", "kimi", "mistral", "minimax", "glm",
            "deepseek", "nemotron", "llama", "pixtral", "internvl",
            "aria", "molmo",
        ))

    return False


def get_ollama_model() -> str:
    """Auto-detect the first available model, prioritizing vision-capable models.

    Tries each healthy key in turn (multi-key rotation). If /api/tags fails for
    every key (e.g. all are unhealthy), falls back to the curated defaults.
    """
    _refresh_pool()
    keys = _healthy_keys() or list(_KEY_POOL)  # try unhealthy too as last resort

    for entry in keys:
        try:
            response = requests.get(
                f"{OLLAMA_URL}/api/tags",
                headers=_headers_for(entry),
                timeout=2,
            )
            if response.status_code == 200:
                _mark_success(entry)
                models = response.json().get("models", [])
                vision_models = [m for m in models if _is_vision_model(m["name"])]
                text_models = [m for m in models if not _is_vision_model(m["name"])]
                for pattern in ["minimax", "gemma", "qwen", "kimi", "mistral", "nemotron"]:
                    found = next((m for m in vision_models if pattern in m["name"].lower()), None)
                    if found:
                        return found["name"]
                if vision_models:
                    return vision_models[0]["name"]
                for pattern in ["nemotron", "minimax", "llama", "qwen"]:
                    found = next((m for m in text_models if pattern in m["name"].lower()), None)
                    if found:
                        return found["name"]
                if text_models:
                    return text_models[0]["name"]
                if models:
                    return models[0]["name"]
            _mark_failure(entry, hard=response.status_code in (401, 403, 429))
        except Exception:
            continue

    # Curated fallback when /api/tags fails on every key.
    for default in ("minimax-m3:cloud", "gemma3:27b", "llama3.1:8b", "llama3"):
        return default
    return "llama3"

def _read_nvidia_key():
    nvidia_key = os.getenv("NVIDIA_API_KEY")
    if nvidia_key:
        return nvidia_key
    env_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "backend", ".env"
    )
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        if k.strip() == "NVIDIA_API_KEY":
                            return v.strip().strip('"').strip("'")
        except OSError:
            pass
    return None

def query_nvidia_nim(prompt: str, system_prompt: str = None) -> str:
    """Send a prompt to NVIDIA NIM Vision/LLM API if key is available."""
    nvidia_key = _read_nvidia_key()
    if not nvidia_key or not nvidia_key.startswith("nvapi-"):
        return None

    try:
        url = "https://integrate.api.nvidia.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {nvidia_key}",
            "Content-Type": "application/json"
        }
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": "writer/palmyra-med-70b",
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 1024
        }
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        if response.status_code == 200:
            return response.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.warning(f"NVIDIA NIM query failed: {e}")
    return None

def _call_with_key_rotation(payload: dict, timeout: int = 30):
    """Try the Ollama /api/generate endpoint across the configured key pool.

    On a soft failure (network, 5xx, model-not-found) we move to the next model
    on the same key. On a hard failure (401/403/429) we park the key for
    KEY_COOLDOWN_MS and move to the next key. Returns the parsed JSON or None.
    """
    _refresh_pool()
    keys = _healthy_keys() or list(_KEY_POOL)
    last_errors = []
    for entry in keys:
        try:
            response = requests.post(
                f"{OLLAMA_URL}/api/generate",
                json=payload,
                headers={**_headers_for(entry), "Content-Type": "application/json"},
                timeout=timeout,
            )
            if response.status_code == 200:
                _mark_success(entry)
                return response.json(), entry
            _mark_failure(entry, hard=response.status_code in (401, 403, 429))
            last_errors.append(Exception(f"HTTP {response.status_code} via {entry['label']}"))
        except Exception as e:
            last_errors.append(e)
            continue
    if last_errors:
        logger.warning(f"All Ollama keys failed: {last_errors[-1]}")
    return None, None


def query_ollama(prompt: str, system_prompt: None = None) -> str:
    """
    Send a prompt to NVIDIA NIM (if key exists) or Ollama for text generation.
    Returns the response string, or None if both are unavailable.

    Multi-key behaviour: tries every configured key in OLLAMA_API_KEYS (in
    order), with hard failures parking the offending key for the cooldown
    window and rotating to the next.
    """
    # 1. Try NVIDIA NIM first (single-key path, kept for back-compat).
    nvidia_reply = query_nvidia_nim(prompt, system_prompt)
    if nvidia_reply:
        return nvidia_reply

    # 2. Ollama (local or cloud) — pick a model and rotate keys until one works.
    model = get_ollama_model()
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }
    if system_prompt:
        payload["system"] = system_prompt

    data, entry = _call_with_key_rotation(payload, timeout=30)
    if data and isinstance(data, dict):
        return data.get("response", "").strip()
    return None
