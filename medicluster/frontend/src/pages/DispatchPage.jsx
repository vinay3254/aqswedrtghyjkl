import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  listAmbulances, listHospitals, dispatchEmergency,
  getDispatchHistory, updateDispatchStatus, updateAmbulanceStatus,
  updateHospitalBeds, seedDispatch,
} from "../api/apiClient";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_STYLE = {
  CRITICAL: { bg: "bg-red-600",    text: "text-red-600",    light: "bg-red-50 border-red-300" },
  HIGH:     { bg: "bg-orange-500", text: "text-orange-600", light: "bg-orange-50 border-orange-300" },
  MEDIUM:   { bg: "bg-yellow-500", text: "text-yellow-700", light: "bg-yellow-50 border-yellow-300" },
  LOW:      { bg: "bg-emerald-500",text: "text-emerald-700",light: "bg-emerald-50 border-emerald-300" },
};

const AMB_STATUS_STYLE = {
  available: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700", label: "Available" },
  en_route:  { dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-700",     label: "En Route"  },
  at_scene:  { dot: "bg-red-500",     badge: "bg-red-100 text-red-700",          label: "At Scene"  },
};

const AMB_TYPE_COLOR = { BLS: "bg-blue-100 text-blue-700", ALS: "bg-purple-100 text-purple-700", ICU: "bg-red-100 text-red-700" };

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ── Status Board ──────────────────────────────────────────────────────────────

function AmbulanceBoard({ ambulances, onStatusChange }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Ambulances</p>
        <span className="text-xs text-emerald-600 font-semibold">
          {ambulances.filter((a) => a.status === "available").length} available
        </span>
      </div>
      <div className="divide-y divide-slate-50">
        {ambulances.map((amb) => {
          const s = AMB_STATUS_STYLE[amb.status] ?? AMB_STATUS_STYLE.available;
          return (
            <div key={amb.ambulanceId} className="px-4 py-2.5 flex items-center gap-2.5">
              <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot} ${amb.status === "available" ? "animate-pulse" : ""}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-700 font-mono">{amb.ambulanceId}</span>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${AMB_TYPE_COLOR[amb.type]}`}>{amb.type}</span>
                </div>
                <p className="text-xs text-slate-400 truncate">{amb.location?.description}</p>
              </div>
              <select
                value={amb.status}
                onChange={(e) => onStatusChange(amb.ambulanceId, e.target.value)}
                className="text-xs border border-slate-200 rounded px-1.5 py-1 text-slate-600 focus:outline-none"
              >
                <option value="available">Available</option>
                <option value="en_route">En Route</option>
                <option value="at_scene">At Scene</option>
              </select>
            </div>
          );
        })}
        {ambulances.length === 0 && (
          <p className="text-xs text-slate-400 p-4 text-center">No ambulances loaded</p>
        )}
      </div>
    </div>
  );
}

function HospitalBoard({ hospitals, onBedsChange }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Hospitals</p>
      </div>
      <div className="divide-y divide-slate-50">
        {hospitals.map((h) => {
          const bedColor = h.available_beds === 0 ? "text-red-600" : h.available_beds <= 3 ? "text-amber-600" : "text-emerald-600";
          return (
            <div key={h.hospitalId} className="px-4 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 leading-tight">{h.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-400 font-mono">L{h.trauma_level}</span>
                    {h.specialty.slice(0, 2).map((s) => (
                      <span key={s} className="text-xs bg-slate-100 text-slate-500 px-1 rounded">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onBedsChange(h.hospitalId, Math.max(0, h.available_beds - 1))}
                    className="w-5 h-5 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 text-xs flex items-center justify-center">−</button>
                  <span className={`text-xs font-bold w-6 text-center ${bedColor}`}>{h.available_beds}</span>
                  <button onClick={() => onBedsChange(h.hospitalId, h.available_beds + 1)}
                    className="w-5 h-5 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 text-xs flex items-center justify-center">+</button>
                  <span className="text-xs text-slate-400 ml-0.5">beds</span>
                </div>
              </div>
            </div>
          );
        })}
        {hospitals.length === 0 && (
          <p className="text-xs text-slate-400 p-4 text-center">No hospitals loaded</p>
        )}
      </div>
    </div>
  );
}

// ── ARIA Response display ─────────────────────────────────────────────────────

function ARIAResponse({ response, dispatchId, onResolve, onCancel }) {
  if (!response) return null;
  const sev = SEVERITY_STYLE[response.severity] ?? SEVERITY_STYLE.LOW;

  return (
    <div className={`rounded-xl border-2 p-5 space-y-4 ${sev.light}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`text-white text-sm font-bold px-3 py-1.5 rounded-lg ${sev.bg}`}>
            {response.severity}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Dispatch ID</p>
            <p className="font-mono text-sm font-bold text-slate-800">{response.dispatch_id}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Unit Required</p>
            <p className="font-semibold text-sm text-slate-700">{response.ambulance_type_required}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onResolve}
            className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold">
            Mark Resolved
          </button>
          <button onClick={onCancel}
            className="text-xs px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            Cancel
          </button>
        </div>
      </div>

      {/* Dispatched unit */}
      {response.dispatched_ambulance && (
        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Dispatched Unit</p>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-xs text-slate-400">Ambulance</p>
              <p className="font-mono font-bold text-slate-800">{response.dispatched_ambulance.id}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">ETA to Scene</p>
              <p className="font-bold text-slate-800">{response.dispatched_ambulance.eta_minutes} min</p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-400">Route</p>
              <p className="text-sm text-slate-700">{response.dispatched_ambulance.route_summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Hospital allocation */}
      {response.hospital_allocation && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Primary Hospital", data: response.hospital_allocation.primary, accent: "border-red-300 bg-red-50" },
            { label: "Backup Hospital",  data: response.hospital_allocation.backup,  accent: "border-slate-200 bg-slate-50" },
          ].map(({ label, data, accent }) => data && (
            <div key={label} className={`rounded-lg p-3 border ${accent}`}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
              <p className="font-semibold text-slate-800 text-sm">{data.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">ETA from scene: <span className="font-semibold">{data.eta_from_scene_minutes} min</span></p>
              <p className="text-xs text-slate-500 mt-0.5 italic">{data.reason}</p>
            </div>
          ))}
        </div>
      )}

      {/* Pre-alerts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {response.pre_alert_paramedic && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">To Paramedic Crew</p>
            <p className="text-xs text-purple-900 leading-relaxed">{response.pre_alert_paramedic}</p>
          </div>
        )}
        {response.pre_alert_hospital && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">To Hospital ER</p>
            <p className="text-xs text-blue-900 leading-relaxed">{response.pre_alert_hospital}</p>
          </div>
        )}
      </div>

      {/* Alerts */}
      {response.alerts?.length > 0 && (
        <div className="space-y-1.5">
          {response.alerts.map((alert, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-amber-800">{alert}</span>
            </div>
          ))}
        </div>
      )}

      {/* Dispatcher notes */}
      {response.dispatcher_notes && (
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Dispatcher Notes</p>
          <p className="text-sm text-slate-700 leading-relaxed">{response.dispatcher_notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Dispatch History ──────────────────────────────────────────────────────────

function HistoryPanel({ history, onStatusChange }) {
  const [open, setOpen] = useState(false);
  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
      >
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
          Dispatch History ({history.length})
        </p>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-50">
          {history.map((d) => {
            const sev = d.aria_response?.severity;
            const s = SEVERITY_STYLE[sev] ?? SEVERITY_STYLE.LOW;
            const statusColor = d.status === "active" ? "text-blue-600" : d.status === "resolved" ? "text-emerald-600" : "text-slate-400";
            return (
              <div key={d.dispatch_id} className="px-4 py-3 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${s.bg}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-700">{d.dispatch_id}</span>
                    {sev && <span className={`text-xs font-semibold ${s.text}`}>{sev}</span>}
                    <span className={`text-xs font-semibold capitalize ${statusColor}`}>{d.status}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{d.emergency?.reported_condition}</p>
                  <p className="text-xs text-slate-400">{d.emergency?.caller_location} · {timeAgo(d.createdAt)}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Link to={`/mci/${d.dispatch_id}`}
                    className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                    MCI Board
                  </Link>
                  {d.status === "active" && (
                    <>
                      <button onClick={() => onStatusChange(d.dispatch_id, "resolved")}
                        className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
                        Resolve
                      </button>
                      <button onClick={() => onStatusChange(d.dispatch_id, "cancelled")}
                        className="text-xs px-2 py-1 text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DispatchPage() {
  const [ambulances,    setAmbulances]    = useState([]);
  const [hospitals,     setHospitals]     = useState([]);
  const [history,       setHistory]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [dispatching,   setDispatching]   = useState(false);
  const [error,         setError]         = useState(null);
  const [ariaResult,    setAriaResult]    = useState(null);
  const [activeDispatchId, setActiveDispatchId] = useState(null);

  // Form state
  const [location,   setLocation]   = useState("");
  const [condition,  setCondition]  = useState("");
  const [severity,   setSeverity]   = useState(7);
  const [casualties, setCasualties] = useState(1);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ambs, hosps, hist] = await Promise.all([
        listAmbulances(),
        listHospitals(),
        getDispatchHistory(),
      ]);
      setAmbulances(ambs);
      setHospitals(hosps);
      setHistory(hist);
    } catch {
      // silence — seed prompt will appear if empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleSeed() {
    try {
      await seedDispatch();
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.error || "Seed failed");
    }
  }

  async function handleDispatch(e) {
    e.preventDefault();
    if (!location.trim() || !condition.trim()) {
      setError("Location and condition are required.");
      return;
    }
    setError(null);
    setAriaResult(null);
    setDispatching(true);
    try {
      const res = await dispatchEmergency({
        caller_location: location.trim(),
        reported_condition: condition.trim(),
        severity_score: severity,
        casualties,
      });
      setAriaResult(res.aria_response);
      setActiveDispatchId(res.dispatch_id);
      setHistory((prev) => [{
        dispatch_id: res.dispatch_id,
        emergency: { caller_location: location, reported_condition: condition, severity_score: severity, casualties },
        aria_response: res.aria_response,
        status: "active",
        createdAt: new Date().toISOString(),
      }, ...prev]);
      // Refresh ambulance status (one was set to en_route)
      const ambs = await listAmbulances();
      setAmbulances(ambs);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Dispatch failed");
    } finally {
      setDispatching(false);
    }
  }

  async function handleAmbStatusChange(ambulanceId, status) {
    try {
      const updated = await updateAmbulanceStatus(ambulanceId, status);
      setAmbulances((prev) => prev.map((a) => a.ambulanceId === ambulanceId ? { ...a, status: updated.status } : a));
    } catch {
      setError("Failed to update ambulance status");
    }
  }

  async function handleBedsChange(hospitalId, beds) {
    try {
      const updated = await updateHospitalBeds(hospitalId, beds);
      setHospitals((prev) => prev.map((h) => h.hospitalId === hospitalId ? { ...h, available_beds: updated.available_beds } : h));
    } catch {
      setError("Failed to update bed count");
    }
  }

  async function handleDispatchStatus(dispatchId, status) {
    try {
      await updateDispatchStatus(dispatchId, status);
      setHistory((prev) => prev.map((d) => d.dispatch_id === dispatchId ? { ...d, status } : d));
      if (dispatchId === activeDispatchId) setAriaResult(null);
    } catch {
      setError("Failed to update dispatch status");
    }
  }

  const sevLabel = severity >= 9 ? "CRITICAL" : severity >= 7 ? "HIGH" : severity >= 4 ? "MEDIUM" : "LOW";
  const sevColor = severity >= 9 ? "text-red-600" : severity >= 7 ? "text-orange-600" : severity >= 4 ? "text-yellow-600" : "text-emerald-600";

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50">

      {/* ARIA Console Header */}
      <div className="bg-white border-b border-slate-200 text-slate-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-slate-800 text-base tracking-wide">ARIA</p>
            <p className="text-xs text-slate-500">Automated Response & Intelligence Agent · Ambulance Dispatch</p>
          </div>
          <div className="flex items-center gap-1.5 ml-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-600 font-semibold">ONLINE</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{ambulances.filter((a) => a.status === "available").length} units available</span>
          <span>·</span>
          <span>{history.filter((d) => d.status === "active").length} active dispatches</span>
          {(ambulances.length === 0 || hospitals.length === 0) && (
            <button onClick={handleSeed}
              className="ml-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-lg transition-colors font-semibold border border-slate-200">
              Load Demo Data
            </button>
          )}
        </div>
      </div>

      <div className="p-6 max-w-screen-2xl mx-auto">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700 ml-4">✕</button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_280px] gap-5">

          {/* ── Left: Emergency form ── */}
          <div className="space-y-4">
            <form onSubmit={handleDispatch} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                </div>
                <p className="text-sm font-bold text-slate-800">New Emergency</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Caller Location *</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Koramangala 5th Block, Bangalore"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Reported Condition *</label>
                <textarea
                  rows={3}
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  placeholder="e.g. 52-year-old male, chest pain, unresponsive, suspected cardiac arrest"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-500">Severity Score</label>
                  <span className={`text-xs font-bold ${sevColor}`}>{severity}/10 — {sevLabel}</span>
                </div>
                <input
                  type="range" min={1} max={10} value={severity}
                  onChange={(e) => setSeverity(Number(e.target.value))}
                  className="w-full accent-red-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                  <span>Low</span><span>Critical</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Casualties</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n} type="button"
                      onClick={() => setCasualties(n)}
                      className={`w-9 h-9 rounded-lg text-sm font-bold border transition-colors ${
                        casualties === n
                          ? "bg-red-600 text-white border-red-600"
                          : "border-slate-200 text-slate-600 hover:border-red-400"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCasualties((c) => c + 1)}
                    className="w-9 h-9 rounded-lg text-sm font-bold border border-slate-200 text-slate-400 hover:border-red-400 hover:text-red-600 transition-colors"
                  >
                    {casualties > 5 ? casualties : "+"}
                  </button>
                </div>
                {casualties > 5 && (
                  <input type="number" min={1} value={casualties}
                    onChange={(e) => setCasualties(Math.max(1, Number(e.target.value)))}
                    className="mt-2 w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                )}
                {casualties > 1 && (
                  <p className="text-xs text-amber-600 mt-1 font-semibold">⚠ MCI protocol will be activated</p>
                )}
              </div>

              <button
                type="submit"
                disabled={dispatching || ambulances.length === 0}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {dispatching ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ARIA Processing…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Dispatch Emergency
                  </>
                )}
              </button>

              {ambulances.length === 0 && (
                <p className="text-xs text-slate-400 text-center">Click "Load Demo Data" above to populate ambulances and hospitals.</p>
              )}
            </form>
          </div>

          {/* ── Center: ARIA Response ── */}
          <div className="space-y-4">
            {dispatching && (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-red-500 rounded-full animate-spin mx-auto" />
                <p className="text-slate-800 font-bold">ARIA is processing the emergency…</p>
                <p className="text-slate-500 text-sm">Analyzing conditions · Selecting unit · Allocating hospital</p>
              </div>
            )}

            {!dispatching && ariaResult && (
              <ARIAResponse
                response={ariaResult}
                dispatchId={activeDispatchId}
                onResolve={() => handleDispatchStatus(activeDispatchId, "resolved")}
                onCancel={() => handleDispatchStatus(activeDispatchId, "cancelled")}
              />
            )}

            {!dispatching && !ariaResult && (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-slate-500 font-medium">Awaiting emergency input</p>
                <p className="text-slate-400 text-sm mt-1">Fill the form and click Dispatch Emergency to activate ARIA.</p>
              </div>
            )}

            <HistoryPanel history={history} onStatusChange={handleDispatchStatus} />
          </div>

          {/* ── Right: Status Board ── */}
          <div className="space-y-4">
            {loading ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400 text-sm">Loading…</div>
            ) : (
              <>
                <AmbulanceBoard ambulances={ambulances} onStatusChange={handleAmbStatusChange} />
                <HospitalBoard hospitals={hospitals} onBedsChange={handleBedsChange} />
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
