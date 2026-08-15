const express = require("express");
const SystemConfig = require("../models/SystemConfig");
const router = express.Router();

const SETTING_KEYS = ["ollamaHost", "ollamaKey", "agentRouterKey", "omniRouteKey"];

function maskKey(val) {
  if (!val) return "";
  if (val.length <= 8) return "••••••••";
  return `${val.slice(0, 5)}••••${val.slice(-4)}`;
}

router.get("/keys", async (req, res) => {
  try {
    const configs = await SystemConfig.find({ key: { $in: SETTING_KEYS } });
    const configMap = configs.reduce((acc, cur) => {
      acc[cur.key] = cur.value;
      return acc;
    }, {});

    res.json({
      ollamaHost: configMap.ollamaHost || process.env.OLLAMA_HOST || "http://localhost:11434",
      hasOllamaKey: !!(configMap.ollamaKey || process.env.OLLAMA_API_KEY),
      hasAgentRouterKey: !!(configMap.agentRouterKey || process.env.AGENTROUTER_API_KEY),
      hasOmniRouteKey: !!(configMap.omniRouteKey || process.env.OMNIROUTE_API_KEY),
      ollamaKeyMasked: maskKey(configMap.ollamaKey || process.env.OLLAMA_API_KEY),
      agentRouterKeyMasked: maskKey(configMap.agentRouterKey || process.env.AGENTROUTER_API_KEY),
      omniRouteKeyMasked: maskKey(configMap.omniRouteKey || process.env.OMNIROUTE_API_KEY)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/keys", async (req, res) => {
  try {
    const updates = req.body;
    for (const key of SETTING_KEYS) {
      if (updates[key] !== undefined) {
        // Skip updates if user submitted the mask placeholder
        if (typeof updates[key] === "string" && updates[key].includes("••••")) {
          continue;
        }
        await SystemConfig.findOneAndUpdate(
          { key },
          { value: updates[key] },
          { upsert: true, new: true }
        );
      }
    }
    res.json({ status: "success", message: "API credentials saved successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
