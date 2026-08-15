import React, { useState, useEffect } from "react";
import axios from "axios";

export default function ApiKeysCard() {
  const [keys, setKeys] = useState({
    ollamaHost: "http://localhost:11434",
    ollamaKey: "",
    agentRouterKey: "",
    omniRouteKey: ""
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/settings/keys");
      setKeys({
        ollamaHost: res.data.ollamaHost,
        ollamaKey: res.data.ollamaKeyMasked || "",
        agentRouterKey: res.data.agentRouterKeyMasked || "",
        omniRouteKey: res.data.omniRouteKeyMasked || ""
      });
    } catch (e) {
      console.error("Failed to fetch keys:", e);
    }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await axios.post("/api/settings/keys", keys);
      setMessage({ type: "success", text: "Keys updated successfully!" });
      fetchKeys();
    } catch (e) {
      setMessage({ type: "error", text: "Failed to update keys." });
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden md:col-span-2">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <span className="text-lg">🔑</span>
        <h2 className="font-semibold text-slate-800 text-sm flex-1">Chatbot API Keys Manager</h2>
      </div>
      <form onSubmit={handleSave} className="p-5 space-y-4">
        {message && (
          <div className={`p-3 rounded-lg text-xs font-semibold ${
            message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}>
            {message.text}
          </div>
        )}
        {loading ? (
          <p className="text-xs text-slate-400 italic">Loading credentials...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Ollama Host URL</label>
              <input
                type="text"
                value={keys.ollamaHost}
                onChange={(e) => setKeys({ ...keys, ollamaHost: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Ollama API Key (Optional)</label>
              <input
                type="password"
                value={keys.ollamaKey}
                onChange={(e) => setKeys({ ...keys, ollamaKey: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="Enter Ollama API key"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">AgentRouter API Key</label>
              <input
                type="password"
                value={keys.agentRouterKey}
                onChange={(e) => setKeys({ ...keys, agentRouterKey: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="Enter AgentRouter key"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">OmniRoute API Key</label>
              <input
                type="password"
                value={keys.omniRouteKey}
                onChange={(e) => setKeys({ ...keys, omniRouteKey: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="Enter OmniRoute key"
              />
            </div>
          </div>
        )}
        <button
          type="submit"
          disabled={saving || loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
