import { useState, useEffect, useRef, useCallback } from "react";
import {
  listClusterResults,
  analyzeNotes,
  predictRisk,
  generateClusterInsights,
  generateMedicationPlan,
  getPatientClusterHistory,
  checkDrugInteractions,
  aiChat,
} from "../api/apiClient";
import { exportToPdf } from "../utils/exportPdf";

// ── helper components ─────────────────────────────────────────────────────────

function Card({ id, title, icon, children }) {
  return (
    <div id={id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <span className="text-lg">{icon}</span>
        <h2 className="font-semibold text-slate-800 text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Btn({ onClick, disabled, loading, children, variant = "primary", className = "" }) {
  const base = "px-4 py-2 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    danger:  "bg-red-600 hover:bg-red-700 text-white",
    ghost:   "bg-slate-100 hover:bg-slate-200 text-slate-700",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading ? "Loading…" : children}
    </button>
  );
}

function ErrBanner({ msg, onDismiss }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
      <span className="shrink-0 mt-0.5">⚠️</span>
      <p className="flex-1">{msg}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 text-red-400 hover:text-red-600 font-bold">
          ✕
        </button>
      )}
    </div>
  );
}

function Skeleton({ rows = 3 }) {
  return (
    <div className="space-y-2 mt-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-slate-100 rounded-lg"
          style={{ width: `${65 + (i % 3) * 12}%` }}
        />
      ))}
    </div>
  );
}

// ── CRITICAL_KEYWORDS ─────────────────────────────────────────────────────────
const CRITICAL_KEYWORDS = [
  { kw: "chest pain",           note: "Requires immediate cardiac assessment" },
  { kw: "breathlessness",       note: "Assess airway and O₂ saturation immediately" },
  { kw: "unconsciousness",      note: "Check GCS — activate emergency protocol" },
  { kw: "syncope",              note: "Evaluate for cardiac arrhythmia or vasovagal cause" },
  { kw: "seizure",              note: "Protect airway, note duration, check glucose" },
  { kw: "stroke",               note: "FAST assessment — time-sensitive intervention" },
  { kw: "cardiac arrest",       note: "Initiate CPR — call emergency services" },
  { kw: "severe bleeding",      note: "Apply direct pressure — assess for haemorrhagic shock" },
  { kw: "anaphylaxis",          note: "Administer epinephrine — monitor airway" },
  { kw: "respiratory failure",  note: "Secure airway — prepare ventilatory support" },
  { kw: "altered mental status",note: "Evaluate glucose, O₂, BP — rule out sepsis" },
  { kw: "hypotension",          note: "Check for shock — IV access and fluid resuscitation" },
];

// ── main component ────────────────────────────────────────────────────────────
export default function ClinicalAIPage() {
  // header
  const [patientId, setPatientId]             = useState("P-001");
  const [committedPatientId, setCommittedPatientId] = useState("P-001");
  const [clusterResults, setClusterResults]   = useState([]);
  const [selectedResultId, setSelectedResultId] = useState("");
  const [resultsLoading, setResultsLoading]   = useState(false);

  // input zone
  const [notes, setNotes]               = useState("");
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle|uploading|done|error
  const [uploadError, setUploadError]   = useState("");
  const fileInputRef                    = useRef(null);
  const notesRef                        = useRef(notes);

  // alerts (client-side)
  const [alerts, setAlerts] = useState([]);

  // NLP / clinical summary
  const [nlpResult, setNlpResult]         = useState(null);
  const [nlpLoading, setNlpLoading]       = useState(false);
  const [nlpError, setNlpError]           = useState("");
  const [drugInteractions, setDrugInteractions] = useState(null);
  const nlpTimerRef                       = useRef(null);

  // risk prediction
  const [vitals, setVitals] = useState({
    age: "", blood_pressure: "", heart_rate: "", cholesterol: "", bmi: "", glucose: "",
  });
  const [predResult, setPredResult]     = useState(null);
  const [predInsights, setPredInsights] = useState("");
  const [predLoading, setPredLoading]   = useState(false);
  const [predError, setPredError]       = useState("");

  // care plan
  const [carePlan, setCarePlan]           = useState(null);
  const [carePlanLoading, setCarePlanLoading] = useState(false);
  const [carePlanError, setCarePlanError] = useState("");

  // patient history
  const [history, setHistory]             = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError]   = useState("");

  // ── load cluster results on mount ──────────────────────────────────────────
  useEffect(() => {
    setResultsLoading(true);
    listClusterResults()
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setClusterResults(arr);
        if (arr.length > 0) setSelectedResultId(arr[0]._id ?? arr[0].id ?? "");
      })
      .catch((e) => console.error("Failed to load cluster results:", e))
      .finally(() => setResultsLoading(false));
  }, []);

  // ── load patient history when patientId changes ─────────────────────────────
  useEffect(() => {
    if (!committedPatientId.trim()) return;
    setHistoryLoading(true);
    setHistoryError("");
    getPatientClusterHistory(committedPatientId.trim())
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch((e) => setHistoryError(e?.response?.data?.error ?? e.message))
      .finally(() => setHistoryLoading(false));
  }, [committedPatientId]);

  // cleanup NLP debounce timer on unmount
  useEffect(() => {
    return () => clearTimeout(nlpTimerRef.current);
  }, []);

  useEffect(() => { notesRef.current = notes; }, [notes]);

  // ── critical keyword scan (instant, client-side) ────────────────────────────
  const scanKeywords = useCallback((text) => {
    const lower = text.toLowerCase();
    setAlerts(CRITICAL_KEYWORDS.filter(({ kw }) => lower.includes(kw)));
  }, []);

  // ── debounced NLP call ──────────────────────────────────────────────────────
  const runNlp = useCallback((text) => {
    setNlpLoading(true);
    setNlpError("");
    analyzeNotes(text)
      .then((data) => {
        setNlpResult(data);
        const meds = (data?.entities ?? [])
          .filter((e) => e.type === "medication")
          .map((e) => e.label);
        if (meds.length >= 2) {
          checkDrugInteractions(meds)
            .then(setDrugInteractions)
            .catch(() => {});
        }
      })
      .catch((e) => setNlpError(e?.response?.data?.error ?? e.message))
      .finally(() => setNlpLoading(false));
  }, []);

  const handleNotesChange = useCallback((text) => {
    setNotes(text);
    scanKeywords(text);
    clearTimeout(nlpTimerRef.current);
    if (text.length >= 30) {
      nlpTimerRef.current = setTimeout(() => runNlp(text), 800);
    } else {
      setNlpResult(null);
      setDrugInteractions(null);
    }
  }, [scanKeywords, runNlp]);

  // ── file upload ─────────────────────────────────────────────────────────────
  const handleFile = useCallback((file) => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setUploadError("Only JPEG, PNG, WebP, or GIF images are supported.");
      setUploadStatus("error");
      return;
    }
    setUploadStatus("uploading");
    setUploadError("");
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(",")[1];
      try {
        const res = await aiChat(
          base64,
          file.type,
          [],
          "Extract all clinical observations, diagnoses, medications, and vitals from this document as plain text."
        );
        const extracted = res?.reply ?? res?.content ?? res?.message ?? "";
        handleNotesChange(notesRef.current ? `${notesRef.current}\n\n${extracted}` : extracted);
        setUploadStatus("done");
      } catch (err) {
        setUploadError(err?.response?.data?.error ?? err.message);
        setUploadStatus("error");
      }
    };
    reader.readAsDataURL(file);
  }, [handleNotesChange]);

  // ── run prediction ──────────────────────────────────────────────────────────
  const runPrediction = useCallback(async () => {
    if (!selectedResultId) return;
    setPredLoading(true);
    setPredError("");
    setPredResult(null);
    setPredInsights("");
    setCarePlan(null);
    try {
      const vitalValues = Object.fromEntries(
        Object.entries(vitals)
          .filter(([, v]) => v !== "")
          .map(([k, v]) => [k, parseFloat(v)])
      );
      const pred = await predictRisk(selectedResultId, vitalValues);
      setPredResult(pred);

      const [insights] = await Promise.allSettled([
        generateClusterInsights({
          resultId: selectedResultId,
          cluster_id: pred.cluster_id ?? pred.cluster,
          risk_tier: pred.risk_tier,
          vitals: vitalValues,
        }),
      ]);
      if (insights.status === "fulfilled") {
        setPredInsights(insights.value?.insights ?? insights.value?.summary ?? "");
      }

      setCarePlanLoading(true);
      generateMedicationPlan(committedPatientId.trim(), notes)
        .then(setCarePlan)
        .catch((e) => setCarePlanError(e?.response?.data?.error ?? e.message))
        .finally(() => setCarePlanLoading(false));
    } catch (e) {
      setPredError(e?.response?.data?.error ?? e.message);
    } finally {
      setPredLoading(false);
    }
  }, [selectedResultId, vitals, committedPatientId, notes]);

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🧠 Clinical AI</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Intelligent clinical note analysis &amp; risk prediction
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Patient ID</label>
            <input
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              onBlur={() => setCommittedPatientId(patientId)}
              onKeyDown={(e) => e.key === "Enter" && setCommittedPatientId(patientId)}
              placeholder="e.g. P-001"
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-28 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Cluster Model</label>
            <select
              value={selectedResultId}
              onChange={(e) => setSelectedResultId(e.target.value)}
              disabled={resultsLoading}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {resultsLoading && <option>Loading models…</option>}
              {!resultsLoading && clusterResults.length === 0 && (
                <option value="">No models — run clustering first</option>
              )}
              {clusterResults.map((r) => (
                <option key={r._id ?? r.id} value={r._id ?? r.id}>
                  {(r.algorithm ?? "unknown").toUpperCase()} —{" "}
                  {new Date(r.createdAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Input Zone + Critical Alerts (two-column) ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Zone */}
        <Card icon="📝" title="Clinical Notes">
          <textarea
            rows={8}
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Paste doctor notes, discharge summaries, or prescriptions here…"
            className="w-full text-sm border border-slate-200 rounded-xl p-3 resize-y font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-400">{notes.length} chars</span>
            <Btn variant="ghost" onClick={() => handleNotesChange("")} disabled={!notes}>
              Clear
            </Btn>
          </div>

          {/* File upload */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
            {uploadStatus === "idle" && (
              <p className="text-xs text-slate-500">
                📎 Drop or click to upload prescription / report image (JPEG, PNG, WebP)
              </p>
            )}
            {uploadStatus === "uploading" && (
              <p className="text-xs text-blue-600 animate-pulse">⏳ Extracting text from image…</p>
            )}
            {uploadStatus === "done" && (
              <p className="text-xs text-green-600">✅ Text extracted and added to notes</p>
            )}
            {uploadStatus === "error" && (
              <p className="text-xs text-red-600">❌ {uploadError}</p>
            )}
          </div>
        </Card>

        {/* Critical Alerts */}
        <Card icon="⚠️" title="Critical Alerts">
          {notes.length === 0 && (
            <p className="text-xs text-slate-400 italic">Start typing notes to scan for critical keywords…</p>
          )}
          {notes.length > 0 && alerts.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
              <span>✅</span>
              <p className="text-xs text-green-700 font-medium">No critical keywords detected</p>
            </div>
          )}
          <div className="space-y-2">
            {alerts.map(({ kw, note }) => (
              <div
                key={kw}
                className="flex items-start gap-2 p-3 bg-red-50 border border-red-300 rounded-xl"
              >
                <span className="text-red-500 shrink-0 mt-0.5">🚨</span>
                <div>
                  <p className="text-xs font-bold text-red-700 uppercase tracking-wide">{kw}</p>
                  <p className="text-xs text-red-600 mt-0.5">{note}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Clinical Summary ─────────────────────────────────────────── */}
      <Card icon="📋" title="Clinical Summary">
        {notes.length < 30 && !nlpResult && (
          <p className="text-xs text-slate-400 italic">
            Enter at least 30 characters of notes to trigger NLP analysis…
          </p>
        )}
        {nlpLoading && <Skeleton rows={5} />}
        <ErrBanner msg={nlpError} onDismiss={() => setNlpError("")} />

        {nlpResult && !nlpLoading && (
          <div className="space-y-5">
            {/* Entities table */}
            {nlpResult.entities?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Extracted Entities
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-2 text-slate-500 font-medium">Entity</th>
                        <th className="text-left px-3 py-2 text-slate-500 font-medium">Type</th>
                        <th className="text-left px-3 py-2 text-slate-500 font-medium">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nlpResult.entities.map((e, i) => (
                        <tr
                          key={i}
                          className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
                        >
                          <td className="px-3 py-2 font-medium text-slate-800">{e.label ?? e.text}</td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                              {e.type}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {e.confidence != null ? `${Math.round(e.confidence * 100)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ICD-10 codes */}
            {nlpResult.icdCodes?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  ICD-10 Codes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {nlpResult.icdCodes.map((c, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-xs font-mono"
                      title={c.label ?? ""}
                    >
                      {c.code ?? c} {c.label ? `— ${c.label}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Trajectory */}
            {nlpResult.trajectory && (
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Clinical Trajectory
                </h3>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    nlpResult.trajectory === "worsening"
                      ? "bg-red-100 text-red-700 border border-red-200"
                      : nlpResult.trajectory === "improving"
                      ? "bg-teal-100 text-teal-700 border border-teal-200"
                      : "bg-green-100 text-green-700 border border-green-200"
                  }`}
                >
                  {nlpResult.trajectory.charAt(0).toUpperCase() + nlpResult.trajectory.slice(1)}
                </span>
              </div>
            )}

            {/* AI Summary */}
            {nlpResult.summary && (
              <div>
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  AI Summary
                </h3>
                <blockquote className="border-l-4 border-blue-300 pl-4 italic text-sm text-slate-700 bg-blue-50 py-3 pr-3 rounded-r-xl">
                  {nlpResult.summary}
                </blockquote>
              </div>
            )}

            {/* Drug interactions */}
            {drugInteractions && (
              <div>
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Drug Interaction Check
                </h3>
                {(drugInteractions.interactions ?? []).length === 0 ? (
                  <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    ✅ No known interactions detected between extracted medications.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(drugInteractions.interactions ?? [drugInteractions]).map((d, i) => (
                      <div
                        key={i}
                        className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800"
                      >
                        <p className="font-semibold">{d.drugs?.join(" + ") ?? d.pair}</p>
                        <p className="mt-0.5">{d.description ?? d.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Risk Prediction ──────────────────────────────────────────── */}
      <Card icon="🎯" title="Risk Prediction">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {[
            { key: "age",            label: "Age",          unit: "yrs"  },
            { key: "blood_pressure", label: "Sys. BP",      unit: "mmHg" },
            { key: "heart_rate",     label: "Heart Rate",   unit: "bpm"  },
            { key: "cholesterol",    label: "Cholesterol",  unit: "mg/dL"},
            { key: "bmi",            label: "BMI",          unit: ""     },
            { key: "glucose",        label: "Glucose",      unit: "mg/dL"},
          ].map(({ key, label, unit }) => (
            <div key={key}>
              <label className="block text-xs text-slate-500 mb-1">
                {label} {unit && <span className="text-slate-400">({unit})</span>}
              </label>
              <input
                type="number"
                value={vitals[key]}
                onChange={(e) =>
                  setVitals((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder="—"
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          ))}
        </div>

        <Btn
          onClick={runPrediction}
          loading={predLoading}
          disabled={!selectedResultId || notes.length < 30}
        >
          🔮 Run Prediction
        </Btn>
        {!selectedResultId && (
          <p className="text-xs text-amber-600 mt-2">
            Select a cluster model above to enable prediction.
          </p>
        )}

        <ErrBanner msg={predError} onDismiss={() => setPredError("")} />

        {predResult && !predLoading && (
          <div className="mt-5 space-y-4">
            {/* Risk tier + confidence */}
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Risk Tier</p>
                <span
                  className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide ${
                    predResult.risk_tier === "CRITICAL"
                      ? "bg-red-600 text-white animate-pulse"
                      : predResult.risk_tier === "HIGH"
                      ? "bg-red-100 text-red-700 border border-red-300"
                      : predResult.risk_tier === "MEDIUM"
                      ? "bg-amber-100 text-amber-700 border border-amber-300"
                      : "bg-green-100 text-green-700 border border-green-300"
                  }`}
                >
                  {predResult.risk_tier ?? "Unknown"}
                </span>
              </div>
              {predResult.confidence != null && (
                <div className="flex-1 min-w-[160px]">
                  <p className="text-xs text-slate-500 mb-1">
                    Confidence — {Math.round(predResult.confidence * 100)}%
                  </p>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-700"
                      style={{ width: `${Math.round(predResult.confidence * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {predResult.cluster_id != null && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Cluster</p>
                  <span className="text-sm font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                    #{predResult.cluster_id ?? predResult.cluster}
                  </span>
                </div>
              )}
            </div>

            {/* AI insights */}
            {predInsights && (
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  AI Cluster Insights
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {predInsights}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Care Plan ────────────────────────────────────────────────── */}
      {(carePlanLoading || carePlan) && (
        <Card id="care-plan-panel" icon="💊" title="Personalized Care Plan">
          {carePlanLoading && <Skeleton rows={6} />}
          <ErrBanner msg={carePlanError} onDismiss={() => setCarePlanError("")} />
          {carePlan && !carePlanLoading && (
            <div className="space-y-4">
              {/* Medication reminders table */}
              {(carePlan.reminders ?? []).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                    Medications
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-3 py-2 text-slate-500 font-medium">Drug</th>
                          <th className="text-left px-3 py-2 text-slate-500 font-medium">Dose</th>
                          <th className="text-left px-3 py-2 text-slate-500 font-medium">Frequency</th>
                          <th className="text-left px-3 py-2 text-slate-500 font-medium">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {carePlan.reminders.map((r, i) => (
                          <tr
                            key={i}
                            className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
                          >
                            <td className="px-3 py-2 font-medium text-slate-800">
                              {r.medication_name ?? r.drug}
                            </td>
                            <td className="px-3 py-2 text-slate-600">{r.dosage ?? r.dose ?? "—"}</td>
                            <td className="px-3 py-2 text-slate-600">{r.frequency ?? "—"}</td>
                            <td className="px-3 py-2 text-slate-600">{r.time_of_day ?? r.time ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Full plan narrative */}
              {carePlan.rawPlan && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                    Care Plan
                  </h3>
                  <pre className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-auto max-h-64 text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {carePlan.rawPlan}
                  </pre>
                </div>
              )}

              <Btn
                variant="ghost"
                onClick={() =>
                  exportToPdf(
                    "care-plan-panel",
                    "Personalized Care Plan",
                    `care-plan-${patientId}`
                  )
                }
              >
                📄 Download PDF
              </Btn>
            </div>
          )}
        </Card>
      )}

      {/* ── Patient History Timeline ─────────────────────────────────── */}
      <Card icon="📅" title="Patient History Timeline">
        {historyLoading && <Skeleton rows={4} />}
        <ErrBanner msg={historyError} onDismiss={() => setHistoryError("")} />

        {!historyLoading && !historyError && history.length === 0 && (
          <p className="text-xs text-slate-400 italic">No history found for patient {committedPatientId}.</p>
        )}

        {!historyLoading && !historyError && history.length > 0 && (
          <div className="relative pl-6 space-y-4">
            {/* vertical connector line */}
            <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-slate-200" />

            {history.map((entry, i) => (
              <div key={entry.resultId ?? i} className="relative flex gap-4">
                {/* dot */}
                <div
                  className={`absolute -left-4 mt-1 w-3 h-3 rounded-full border-2 border-white ${
                    entry.risk_tier === "CRITICAL" ? "bg-red-600" :
                    entry.risk_tier === "HIGH"     ? "bg-red-400" :
                    entry.risk_tier === "MEDIUM"   ? "bg-amber-400" :
                                                      "bg-green-400"
                  }`}
                />
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {i === 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-medium">
                        Most Recent
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        entry.risk_tier === "CRITICAL" ? "bg-red-100 text-red-700" :
                        entry.risk_tier === "HIGH"     ? "bg-red-50 text-red-600" :
                        entry.risk_tier === "MEDIUM"   ? "bg-amber-50 text-amber-700" :
                                                          "bg-green-50 text-green-700"
                      }`}
                    >
                      {entry.risk_tier ?? "Unknown"}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                      {(entry.algorithm ?? "kmeans").toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">
                    Cluster <span className="font-mono font-semibold">#{entry.cluster_id}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(entry.createdAt).toLocaleDateString(undefined, {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

    </div>
  );
}
