import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getIncidentPatients, addIncidentPatient, updatePatient, addPatientVitals,
  scoreTriage, voiceToTriage, allocateHospital, listHospitals, listAmbulances,
  getDispatchHistory,
} from "../api/apiClient";

// ── Constants ─────────────────────────────────────────────────────────────────

const TRIAGE_COLS = [
  { key: "RED",    label: "IMMEDIATE",  sub: "RED",    bg: "bg-red-600",    light: "bg-red-50 border-red-200",    text: "text-red-700",    badge: "bg-red-100 text-red-800 border border-red-200" },
  { key: "YELLOW", label: "DELAYED",   sub: "YELLOW", bg: "bg-yellow-400", light: "bg-yellow-50 border-yellow-200", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-800 border border-yellow-200" },
  { key: "GREEN",  label: "MINOR",     sub: "GREEN",  bg: "bg-emerald-500",light: "bg-emerald-50 border-emerald-200",text: "text-emerald-700",badge: "bg-emerald-100 text-emerald-800 border border-emerald-200" },
  { key: "BLACK",  label: "EXPECTANT", sub: "BLACK",  bg: "bg-slate-800",  light: "bg-slate-100 border-slate-300", text: "text-slate-700",   badge: "bg-slate-200 text-slate-700 border border-slate-300" },
  { key: "UNSET",  label: "UNTRIAGED", sub: "",       bg: "bg-slate-400",  light: "bg-slate-50 border-slate-200",  text: "text-slate-500",   badge: "bg-slate-100 text-slate-500 border border-slate-200" },
];

const TRANSPORT_STYLES = {
  waiting:    "bg-slate-100 text-slate-500",
  loading:    "bg-amber-100 text-amber-700",
  en_route:   "bg-blue-100 text-blue-700",
  arrived:    "bg-purple-100 text-purple-700",
  handed_off: "bg-emerald-100 text-emerald-700",
};

const PATHWAY_ICONS = {
  trauma:     { icon: "⚡", color: "bg-red-100 text-red-700" },
  stroke:     { icon: "🧠", color: "bg-purple-100 text-purple-700" },
  stemi:      { icon: "❤️", color: "bg-red-100 text-red-700" },
  cardiac:    { icon: "💓", color: "bg-red-100 text-red-700" },
  pediatric:  { icon: "👶", color: "bg-blue-100 text-blue-700" },
  burn:       { icon: "🔥", color: "bg-orange-100 text-orange-700" },
  psychiatric:{ icon: "🧩", color: "bg-indigo-100 text-indigo-700" },
  hazmat:     { icon: "☢️",  color: "bg-yellow-100 text-yellow-800" },
  maternity:  { icon: "🤰", color: "bg-pink-100 text-pink-700" },
  infectious: { icon: "🦠", color: "bg-amber-100 text-amber-700" },
};

function pathwayBadge(flag) {
  const p = PATHWAY_ICONS[flag] ?? { icon: "🏷️", color: "bg-slate-100 text-slate-500" };
  return (
    <span key={flag} title={flag} className={`text-xs px-1.5 py-0.5 rounded font-semibold ${p.color}`}>
      {p.icon} {flag}
    </span>
  );
}

const AVPU_OPTS = ["A", "V", "P", "U"];
const TRANSPORT_OPTS = ["waiting", "loading", "en_route", "arrived", "handed_off"];

// ── Patient Card ──────────────────────────────────────────────────────────────

function PatientCard({ patient, hospitals, ambulances, onUpdate, onAddVitals, col }) {
  const [expanded,    setExpanded]    = useState(false);
  const [editVitals,  setEditVitals]  = useState(false);
  const [vitalsForm,  setVitalsForm]  = useState({});
  const [allocating,  setAllocating]  = useState(false);

  async function handleAllocate() {
    setAllocating(true);
    try {
      const res = await allocateHospital(patient.triage_category, patient.pathway_flags);
      if (res.primary) {
        await onUpdate(patient._id, {
          destination_hospital_id:   res.primary.hospitalId,
          destination_hospital_name: res.primary.name,
          bed_type: res.suggested_bed_type,
        });
      }
    } finally { setAllocating(false); }
  }

  async function handleVitalsSubmit(e) {
    e.preventDefault();
    const filled = Object.fromEntries(
      Object.entries(vitalsForm).filter(([, v]) => v !== "" && v !== undefined)
    );
    if (Object.keys(filled).length === 0) return;
    await onAddVitals(patient._id, filled);
    setEditVitals(false);
    setVitalsForm({});
  }

  const v = patient.vitals;

  return (
    <div className={`rounded-xl border-2 p-3 space-y-2 ${col.light} transition-all`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-xs font-bold text-slate-700">{patient.patient_tag}</span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${col.badge}`}>{patient.triage_category}</span>
            {patient.triage_score > 0 && (
              <span className="text-xs text-slate-400">score: {patient.triage_score}</span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-800 mt-0.5">
            {patient.name !== "Unknown" ? patient.name : "Unknown Patient"}
            {patient.age && <span className="text-slate-400 font-normal ml-1">· {patient.age}y {patient.gender}</span>}
          </p>
        </div>
        <button onClick={() => setExpanded((x) => !x)}
          className="text-slate-400 hover:text-slate-700 p-0.5 shrink-0">
          <svg className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Pathway flags */}
      {patient.pathway_flags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {patient.pathway_flags.map((f) => pathwayBadge(f))}
        </div>
      )}

      {/* Quick vitals strip */}
      {v && (
        <div className="grid grid-cols-4 gap-1 text-xs text-center">
          {[
            { label: "RR",   val: v.respiratory_rate, unit: "/min", warn: v.respiratory_rate > 30 || v.respiratory_rate < 8 },
            { label: "SpO2", val: v.spo2,             unit: "%",    warn: v.spo2 < 94 },
            { label: "SBP",  val: v.systolic_bp,      unit: "mmHg", warn: v.systolic_bp < 90 },
            { label: "HR",   val: v.heart_rate,       unit: "bpm",  warn: v.heart_rate > 120 || v.heart_rate < 50 },
          ].map(({ label, val, unit, warn }) => (
            <div key={label} className={`rounded px-1 py-1 ${warn ? "bg-red-100" : "bg-white/70"}`}>
              <p className="font-bold text-slate-700">{val ?? "—"}<span className="font-normal text-slate-400 text-xs"> {unit}</span></p>
              <p className="text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      )}
      {v?.avpu && (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400">AVPU:</span>
          {AVPU_OPTS.map((a) => (
            <span key={a} className={`font-bold px-1.5 py-0.5 rounded ${v.avpu === a ? (a === "A" ? "bg-emerald-200 text-emerald-800" : a === "V" ? "bg-yellow-200 text-yellow-800" : a === "P" ? "bg-orange-200 text-orange-800" : "bg-slate-700 text-white") : "text-slate-300"}`}>{a}</span>
          ))}
          {v.gcs && <span className="text-slate-400 ml-1">GCS {v.gcs}</span>}
        </div>
      )}

      {/* Triage issues */}
      {patient.triage_issues?.length > 0 && (
        <div className="space-y-0.5">
          {patient.triage_issues.map((issue, i) => (
            <p key={i} className={`text-xs ${col.text}`}>↑ {issue}</p>
          ))}
        </div>
      )}

      {/* Transport + allocation */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <select
          value={patient.transport_status}
          onChange={(e) => onUpdate(patient._id, { transport_status: e.target.value })}
          className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 focus:outline-none cursor-pointer ${TRANSPORT_STYLES[patient.transport_status] ?? TRANSPORT_STYLES.waiting}`}
        >
          {TRANSPORT_OPTS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        {patient.destination_hospital_name && (
          <span className="text-xs text-slate-600 bg-white/70 px-1.5 py-0.5 rounded">
            → {patient.destination_hospital_name}
            {patient.bed_type && <span className="text-slate-400 ml-1">({patient.bed_type})</span>}
          </span>
        )}
        {!patient.destination_hospital_name && (
          <button onClick={handleAllocate} disabled={allocating}
            className="text-xs px-2 py-0.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-50">
            {allocating ? "…" : "Auto-allocate →"}
          </button>
        )}
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="space-y-3 pt-2 border-t border-slate-200">
          {/* Ambulance assign */}
          <div>
            <p className="text-xs text-slate-400 mb-1">Assigned Ambulance</p>
            <select
              value={patient.assigned_ambulance_id ?? ""}
              onChange={(e) => onUpdate(patient._id, { assigned_ambulance_id: e.target.value || null })}
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
            >
              <option value="">— None —</option>
              {ambulances.map((a) => (
                <option key={a.ambulanceId} value={a.ambulanceId}>{a.ambulanceId} · {a.type} · {a.status}</option>
              ))}
            </select>
          </div>

          {/* Hospital assign */}
          <div>
            <p className="text-xs text-slate-400 mb-1">Destination Hospital</p>
            <select
              value={patient.destination_hospital_id ?? ""}
              onChange={(e) => {
                const h = hospitals.find((x) => x.hospitalId === e.target.value);
                onUpdate(patient._id, {
                  destination_hospital_id: e.target.value || null,
                  destination_hospital_name: h?.name ?? null,
                });
              }}
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
            >
              <option value="">— None —</option>
              {hospitals.map((h) => (
                <option key={h.hospitalId} value={h.hospitalId}>
                  {h.name} · L{h.trauma_level} · {h.available_beds} beds
                </option>
              ))}
            </select>
          </div>

          {/* Manual triage override */}
          <div>
            <p className="text-xs text-slate-400 mb-1">Override Category</p>
            <div className="flex gap-1">
              {["RED","YELLOW","GREEN","BLACK"].map((c) => (
                <button key={c} onClick={() => onUpdate(patient._id, { triage_category: c })}
                  className={`text-xs px-2 py-1 rounded font-bold border transition-colors ${patient.triage_category === c ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Update vitals button */}
          <button onClick={() => setEditVitals((x) => !x)}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors w-full">
            {editVitals ? "Cancel vitals" : "Update vitals →"}
          </button>

          {editVitals && (
            <form onSubmit={handleVitalsSubmit} className="space-y-2 bg-white rounded-lg p-3 border border-slate-200">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "respiratory_rate", label: "RR (/min)", type: "number" },
                  { key: "spo2",             label: "SpO2 (%)",  type: "number" },
                  { key: "systolic_bp",      label: "SBP (mmHg)",type: "number" },
                  { key: "heart_rate",       label: "HR (bpm)",  type: "number" },
                  { key: "gcs",              label: "GCS",       type: "number" },
                  { key: "temperature",      label: "Temp (°C)", type: "number" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs text-slate-400 block mb-0.5">{label}</label>
                    <input type="number" step="any"
                      value={vitalsForm[key] ?? ""}
                      onChange={(e) => setVitalsForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-0.5">AVPU</label>
                <div className="flex gap-1">
                  {AVPU_OPTS.map((a) => (
                    <button key={a} type="button"
                      onClick={() => setVitalsForm((f) => ({ ...f, avpu: a }))}
                      className={`text-xs px-2 py-1 rounded font-bold border ${vitalsForm.avpu === a ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-500"}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full text-xs bg-blue-600 text-white py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                Save & Re-score
              </button>
            </form>
          )}

          {/* Voice notes */}
          {patient.voice_triage_notes && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
              <p className="text-xs font-bold text-blue-600 mb-0.5">AI Triage Notes</p>
              <p className="text-xs text-blue-900 leading-relaxed">{patient.voice_triage_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Patient Form ──────────────────────────────────────────────────────────

function AddPatientForm({ incidentId, onAdded }) {
  const [tab, setTab] = useState("vitals"); // vitals | voice
  const [form, setForm] = useState({ name: "", age: "", gender: "Unknown", sector: "A" });
  const [vitals, setVitals] = useState({});
  const [voiceText, setVoiceText] = useState("");
  const [pathwayFlags, setPathwayFlags] = useState([]);
  const [voiceResult, setVoiceResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);

  function toggleFlag(f) {
    setPathwayFlags((p) => p.includes(f) ? p.filter((x) => x !== f) : [...p, f]);
  }

  async function handleVoiceProcess() {
    if (!voiceText.trim()) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await voiceToTriage(voiceText, incidentId);
      setVoiceResult(res);
      if (res.age) setForm((f) => ({ ...f, age: String(res.age) }));
      if (res.gender && res.gender !== "Unknown") setForm((f) => ({ ...f, gender: res.gender }));
      if (res.vitals) setVitals(Object.fromEntries(Object.entries(res.vitals).filter(([, v]) => v !== null)));
      if (res.pathway_flags?.length) setPathwayFlags(res.pathway_flags);
    } catch (err) {
      setError(err?.response?.data?.error || "Voice processing failed");
    } finally { setProcessing(false); }
  }

  async function handleAdd() {
    setSaving(true);
    setError(null);
    try {
      const age = form.age ? Number(form.age) : undefined;
      const filledVitals = Object.fromEntries(Object.entries(vitals).filter(([, v]) => v !== "" && v !== undefined && v !== null));
      const created = await addIncidentPatient(incidentId, {
        name:   form.name || undefined,
        age,
        gender: form.gender,
        sector: form.sector,
        vitals: Object.keys(filledVitals).length > 0 ? filledVitals : undefined,
        pathway_flags: pathwayFlags,
        voice_triage_notes: voiceResult?.triage_summary ?? voiceText.trim().slice(0, 300) ?? undefined,
      });
      onAdded(created);
      setForm({ name: "", age: "", gender: "Unknown", sector: "A" });
      setVitals({}); setVoiceText(""); setVoiceResult(null); setPathwayFlags([]);
      setOpen(false);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to add patient");
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <button onClick={() => setOpen((x) => !x)}
        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700">
        <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Patient
        <svg className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          {/* Demographics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="text-xs text-slate-400 block mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Unknown"
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Age</label>
              <input type="number" value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                placeholder="—"
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Sector</label>
              <select value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none bg-white">
                {["A","B","C","D","E"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Tab: vitals vs voice */}
          <div className="flex gap-1 border-b border-slate-200">
            {["vitals","voice"].map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`text-xs font-semibold px-3 py-1.5 border-b-2 -mb-px transition-colors capitalize ${tab === t ? "border-blue-500 text-blue-700" : "border-transparent text-slate-400 hover:text-slate-700"}`}>
                {t === "voice" ? "🎤 Voice-to-Triage" : "📋 Vitals"}
              </button>
            ))}
          </div>

          {tab === "vitals" && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "respiratory_rate", label: "RR (/min)" },
                { key: "spo2",             label: "SpO2 (%)"  },
                { key: "systolic_bp",      label: "SBP (mmHg)"},
                { key: "heart_rate",       label: "HR (bpm)"  },
                { key: "gcs",              label: "GCS (3-15)" },
                { key: "temperature",      label: "Temp (°C)"  },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-slate-400 block mb-0.5">{label}</label>
                  <input type="number" step="any"
                    value={vitals[key] ?? ""}
                    onChange={(e) => setVitals((v) => ({ ...v, [key]: e.target.value }))}
                    placeholder="—"
                    className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div className="col-span-3">
                <label className="text-xs text-slate-400 block mb-1">AVPU</label>
                <div className="flex gap-1.5">
                  {AVPU_OPTS.map((a) => (
                    <button key={a} type="button" onClick={() => setVitals((v) => ({ ...v, avpu: v.avpu === a ? undefined : a }))}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-colors ${vitals.avpu === a ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-3">
                <label className="text-xs text-slate-400 block mb-0.5">Injury / Notes</label>
                <input value={vitals.injury_description ?? ""}
                  onChange={(e) => setVitals((v) => ({ ...v, injury_description: e.target.value }))}
                  placeholder="e.g. penetrating chest trauma, suspected pneumothorax"
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}

          {tab === "voice" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Dispatcher notes / call transcript</label>
                <textarea rows={4} value={voiceText} onChange={(e) => setVoiceText(e.target.value)}
                  placeholder="Paste call transcript or crew notes here…&#10;e.g. 'Male, approx 45 years, found unresponsive at scene, GCS 6, RR 8, SpO2 88%, BP 80/50, suspected major trauma from MVC'"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={handleVoiceProcess} disabled={processing || !voiceText.trim()}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {processing ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing…</> : "🤖 AI Triage Analysis"}
              </button>

              {voiceResult && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-700">ARIA suggests:</span>
                    {voiceResult.suggested_category && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        voiceResult.suggested_category === "RED" ? "bg-red-100 text-red-700" :
                        voiceResult.suggested_category === "YELLOW" ? "bg-yellow-100 text-yellow-800" :
                        voiceResult.suggested_category === "GREEN" ? "bg-emerald-100 text-emerald-700" :
                        "bg-slate-200 text-slate-700"
                      }`}>{voiceResult.suggested_category}</span>
                    )}
                    {voiceResult.local_score && (
                      <span className="text-xs text-slate-500">Vitals score: {voiceResult.local_score.score}</span>
                    )}
                  </div>
                  {voiceResult.triage_summary && (
                    <p className="text-xs text-indigo-900 leading-relaxed">{voiceResult.triage_summary}</p>
                  )}
                  {voiceResult.pathway_flags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {voiceResult.pathway_flags.map((f) => pathwayBadge(f))}
                    </div>
                  )}
                  <p className="text-xs text-indigo-600 italic">Vitals and flags auto-filled. Review before saving.</p>
                </div>
              )}
            </div>
          )}

          {/* Pathway flags */}
          <div>
            <p className="text-xs text-slate-400 mb-1.5">Pathway Flags</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(PATHWAY_ICONS).map((f) => (
                <button key={f} type="button" onClick={() => toggleFlag(f)}
                  className={`text-xs px-2 py-1 rounded-lg border font-semibold transition-colors ${
                    pathwayFlags.includes(f) ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}>
                  {PATHWAY_ICONS[f].icon} {f}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleAdd} disabled={saving}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
            {saving ? "Adding…" : "Add to MCI Board"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MCIBoardPage() {
  const { incidentId: urlIncidentId } = useParams();
  const navigate = useNavigate();

  const [incidentId,  setIncidentId]  = useState(urlIncidentId ?? "");
  const [patients,    setPatients]    = useState([]);
  const [hospitals,   setHospitals]   = useState([]);
  const [ambulances,  setAmbulances]  = useState([]);
  const [incidents,   setIncidents]   = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);

  const loadPatients = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const [pts, hosps, ambs] = await Promise.all([
        getIncidentPatients(id),
        listHospitals(),
        listAmbulances(),
      ]);
      setPatients(pts);
      setHospitals(hosps);
      setAmbulances(ambs);
    } catch {
      setError("Failed to load incident patients");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    getDispatchHistory().then(setIncidents).catch(() => {});
  }, []);

  useEffect(() => {
    if (urlIncidentId) {
      setIncidentId(urlIncidentId);
      loadPatients(urlIncidentId);
    }
  }, [urlIncidentId, loadPatients]);

  function handleIncidentSelect(id) {
    navigate(`/mci/${id}`);
  }

  function handleAdded(patient) {
    setPatients((prev) => [...prev, patient]);
  }

  async function handleUpdate(patientId, patch) {
    try {
      const updated = await updatePatient(patientId, patch);
      setPatients((prev) => prev.map((p) => p._id === updated._id ? updated : p));
    } catch {
      setError("Update failed");
    }
  }

  async function handleAddVitals(patientId, vitals) {
    try {
      const updated = await addPatientVitals(patientId, vitals);
      setPatients((prev) => prev.map((p) => p._id === updated._id ? updated : p));
    } catch {
      setError("Vitals update failed");
    }
  }

  // Stats
  const counts = {};
  for (const col of TRIAGE_COLS) {
    counts[col.key] = patients.filter((p) => p.triage_category === col.key).length;
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50">

      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-4">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-lg">🚑</div>
            <div>
              <p className="font-bold text-white tracking-wide">MCI Patient Board</p>
              <p className="text-xs text-slate-400">Mass-Casualty Incident Triage · Powered by ARIA</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={incidentId}
              onChange={(e) => handleIncidentSelect(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none"
            >
              <option value="">— Select Incident —</option>
              {incidents.map((d) => (
                <option key={d.dispatch_id} value={d.dispatch_id}>
                  {d.dispatch_id} · {d.emergency?.caller_location?.slice(0, 30)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {incidentId && patients.length > 0 && (
        <div className="bg-white border-b border-slate-200 px-6 py-2">
          <div className="max-w-screen-2xl mx-auto flex items-center gap-6 flex-wrap">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">
              Total: {patients.length}
            </span>
            {TRIAGE_COLS.filter((c) => c.key !== "UNSET").map((col) => (
              <div key={col.key} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-full ${col.bg}`} />
                <span className="text-xs font-bold text-slate-700">{counts[col.key] ?? 0}</span>
                <span className="text-xs text-slate-400">{col.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-6 max-w-screen-2xl mx-auto">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-700">✕</button>
          </div>
        )}

        {!incidentId ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-3xl">🚑</div>
            <p className="text-slate-600 font-semibold mb-1">Select an incident from the dropdown above</p>
            <p className="text-sm text-slate-400">Or <a href="/dispatch" className="text-blue-500 hover:underline">create a new dispatch</a> on the ARIA Dispatch page first.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Add patient */}
            <AddPatientForm incidentId={incidentId} onAdded={handleAdded} />

            {loading ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">Loading patients…</div>
            ) : (
              /* Kanban board */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {TRIAGE_COLS.filter((c) => c.key !== "UNSET" || counts.UNSET > 0).map((col) => {
                  const colPatients = patients.filter((p) => p.triage_category === col.key);
                  return (
                    <div key={col.key} className="space-y-3">
                      {/* Column header */}
                      <div className={`rounded-xl px-4 py-2.5 ${col.bg} text-white flex items-center justify-between`}>
                        <div>
                          <p className="font-bold text-sm">{col.label}</p>
                          <p className="text-xs opacity-80">{col.sub}</p>
                        </div>
                        <span className="text-2xl font-black opacity-90">{colPatients.length}</span>
                      </div>

                      {/* Patient cards */}
                      {colPatients.length === 0 ? (
                        <div className={`rounded-xl border-2 border-dashed p-4 text-center text-xs ${col.text} opacity-50`}>
                          No patients
                        </div>
                      ) : (
                        colPatients.map((p) => (
                          <PatientCard
                            key={p._id}
                            patient={p}
                            col={col}
                            hospitals={hospitals}
                            ambulances={ambulances}
                            onUpdate={handleUpdate}
                            onAddVitals={handleAddVitals}
                          />
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
