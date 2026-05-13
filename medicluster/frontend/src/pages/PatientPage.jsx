import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { listPatientMedia, getMediaFileUrl, getPatientClusterHistory, calcMews, analyzeNotes } from "../api/apiClient";

const TIER_BADGE = {
  Low:      "bg-emerald-100 text-emerald-800 border border-emerald-200",
  Moderate: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  High:     "bg-orange-100 text-orange-800 border border-orange-200",
  Critical: "bg-red-100 text-red-800 border border-red-200",
  Noise:    "bg-slate-100 text-slate-600 border border-slate-200",
};

function tierBadgeClass(tier) {
  return TIER_BADGE[tier] ?? TIER_BADGE.Noise;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function PatientSearch({ initialValue, onSearch }) {
  const [value, setValue] = useState(initialValue || "");
  function handleSubmit(e) {
    e.preventDefault();
    const id = value.trim();
    if (id) onSearch(id);
  }
  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter patient ID…"
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
      />
      <button type="submit" className="btn-primary text-sm py-1.5 px-4">
        View Patient
      </button>
    </form>
  );
}

function MediaCard({ file }) {
  const isImage = file.contentType?.startsWith("image/");
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {isImage ? (
        <img
          src={getMediaFileUrl(file.fileId)}
          alt={file.filename}
          className="w-full h-32 object-cover bg-slate-100"
          onError={(e) => { e.target.style.display = "none"; }}
        />
      ) : (
        <div className="w-full h-32 bg-slate-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      )}
      <div className="p-2">
        <p className="text-xs font-mono text-slate-600 truncate">{file.filename}</p>
        <p className="text-xs text-slate-400">{formatDate(file.uploadedAt)}</p>
        <a
          href={getMediaFileUrl(file.fileId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline"
        >
          View
        </a>
      </div>
    </div>
  );
}

function ClusterHistoryTable({ history }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        Not found in any clustering run.
      </div>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-100">
          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Algorithm</th>
          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Risk Tier</th>
          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cluster ID</th>
          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
        </tr>
      </thead>
      <tbody>
        {history.map((row, i) => (
          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
            <td className="py-2 px-3 font-mono text-slate-700 uppercase text-xs">{row.algorithm}</td>
            <td className="py-2 px-3">
              {row.risk_tier ? (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tierBadgeClass(row.risk_tier)}`}>
                  {row.risk_tier}
                </span>
              ) : <span className="text-slate-300">—</span>}
            </td>
            <td className="py-2 px-3 font-mono text-slate-600">
              {row.cluster_id !== null ? `Cluster ${row.cluster_id}` : "—"}
            </td>
            <td className="py-2 px-3 text-slate-400 text-xs">{formatDate(row.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── MEWS Score Calculator ───────────────────────────────────────── */
const MEWS_FIELDS = [
  { key: "respiratory_rate", label: "Resp. Rate", unit: "/min", placeholder: "e.g. 18" },
  { key: "heart_rate",       label: "Heart Rate",  unit: "bpm",  placeholder: "e.g. 72" },
  { key: "systolic_bp",      label: "Systolic BP", unit: "mmHg", placeholder: "e.g. 120" },
  { key: "temperature",      label: "Temperature", unit: "°C",   placeholder: "e.g. 37.2" },
  { key: "consciousness",    label: "AVPU",        unit: "",     placeholder: "A/V/P/U" },
  { key: "urine_output",     label: "Urine Output",unit: "ml/hr",placeholder: "e.g. 50" },
];

const MEWS_COLOR = (score) => {
  if (score >= 5) return { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",    label: "Critical — escalate immediately" };
  if (score >= 3) return { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", label: "High — close monitoring required" };
  if (score >= 2) return { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  label: "Moderate — increase observation" };
  return              { bg: "bg-emerald-50", text: "text-emerald-700",border: "border-emerald-200",label: "Normal — routine monitoring" };
};

function MewsCalculator() {
  const [vitals,  setVitals]  = useState({});
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  async function handleCalc() {
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await calcMews(vitals);
      setResult(data);
    } catch {
      setError("MEWS calculation failed. Ensure ML engine is running.");
    } finally {
      setLoading(false);
    }
  }

  const cfg = result ? MEWS_COLOR(result.mews_score ?? 0) : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm font-semibold text-slate-700">MEWS Score Calculator</p>
        <span className="ml-auto text-xs text-slate-400">Modified Early Warning Score</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {MEWS_FIELDS.map(({ key, label, unit, placeholder }) => (
          <div key={key}>
            <label className="text-xs text-slate-500 block mb-1">{label}{unit && <span className="text-slate-400 ml-1">({unit})</span>}</label>
            <input
              type="text"
              value={vitals[key] ?? ""}
              onChange={e => setVitals(v => ({ ...v, [key]: e.target.value }))}
              placeholder={placeholder}
              className="input-field text-xs py-1.5"
            />
          </div>
        ))}
      </div>

      <button onClick={handleCalc} disabled={loading} className="btn-primary w-full text-sm py-2 mb-3">
        {loading ? <><div className="spinner w-3.5 h-3.5" />Calculating…</> : "Calculate MEWS Score"}
      </button>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {result && cfg && (
        <div className={`rounded-lg border ${cfg.border} ${cfg.bg} px-4 py-3 space-y-2 fade-in`}>
          <div className="flex items-center gap-3">
            <span className={`font-mono font-bold text-3xl ${cfg.text}`}>{result.mews_score}</span>
            <div>
              <p className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</p>
              <p className="text-xs text-slate-500">out of max 14 points</p>
            </div>
          </div>
          {result.breakdown && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-current/10">
              {Object.entries(result.breakdown).map(([k, v]) => (
                <span key={k} className="text-xs font-mono bg-white/60 border border-current/15 px-2 py-0.5 rounded">
                  {k.replace(/_/g," ")}: <strong>{v}</strong>
                </span>
              ))}
            </div>
          )}
          {result.recommendation && (
            <p className="text-xs text-slate-600 italic">{result.recommendation}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Clinical Notes NLP Analyzer ─────────────────────────────────── */
function NotesAnalyzer() {
  const [notes,   setNotes]   = useState("");
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  async function handleAnalyze() {
    if (!notes.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await analyzeNotes(notes);
      setResult(data);
    } catch {
      setError("Notes analysis failed. Ensure ML engine is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm font-semibold text-slate-700">Clinical Notes Analyzer</p>
        <span className="ml-auto text-xs text-slate-400">NER · ICD-10 · AI Summary</span>
      </div>

      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={5}
        placeholder="Paste clinical notes, e.g.: Patient presents with shortness of breath, HR 110, SpO2 94%. Crackles at left base. History of hypertension."
        className="input-field text-xs resize-none"
      />

      <button onClick={handleAnalyze} disabled={loading || !notes.trim()} className="btn-primary w-full text-sm py-2">
        {loading ? <><div className="spinner w-3.5 h-3.5" />Analysing…</> : "Analyse Notes"}
      </button>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {result && (
        <div className="space-y-3 fade-in">
          {/* AI Summary */}
          {result.summary && (
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
              <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-1.5">AI Summary</p>
              <p className="text-xs text-violet-900 leading-relaxed">{result.summary}</p>
            </div>
          )}

          {/* Entities */}
          {result.entities?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Extracted Entities</p>
              <div className="flex flex-wrap gap-1.5">
                {result.entities.map((e, i) => (
                  <span key={i} className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    e.type === "CONDITION" ? "bg-red-50 text-red-700 border-red-200" :
                    e.type === "SYMPTOM"   ? "bg-orange-50 text-orange-700 border-orange-200" :
                    e.type === "MEDICATION"? "bg-blue-50 text-blue-700 border-blue-200" :
                    e.type === "VITAL"     ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    "bg-slate-100 text-slate-600 border-slate-200"
                  }`}>
                    {e.text} <span className="opacity-50 font-normal">{e.type}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ICD-10 codes */}
          {result.icd10_codes?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">ICD-10 Suggestions</p>
              <div className="space-y-1">
                {result.icd10_codes.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">{c.code}</span>
                    <span className="text-slate-600">{c.description}</span>
                    {c.confidence && <span className="ml-auto text-slate-400">{(c.confidence * 100).toFixed(0)}%</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trajectory */}
          {result.trajectory && (
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              result.trajectory === "deteriorating" ? "bg-red-50 border-red-200 text-red-700" :
              result.trajectory === "improving"     ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
              "bg-amber-50 border-amber-200 text-amber-700"
            }`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={result.trajectory === "improving" ? "M13 7l5 5-5 5M6 7l5 5-5 5" : "M11 17l-5-5 5-5m6 10l-5-5 5-5"} />
              </svg>
              Clinical trajectory: {result.trajectory}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PatientPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [media, setMedia] = useState([]);
  const [clusterHistory, setClusterHistory] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [loadingCluster, setLoadingCluster] = useState(false);

  const loadPatient = useCallback((id) => {
    if (!id) return;
    setLoadingMedia(true);
    setLoadingCluster(true);
    setMedia([]);
    setClusterHistory([]);

    listPatientMedia(id)
      .then(setMedia)
      .catch(() => setMedia([]))
      .finally(() => setLoadingMedia(false));

    getPatientClusterHistory(id)
      .then(setClusterHistory)
      .catch(() => setClusterHistory([]))
      .finally(() => setLoadingCluster(false));
  }, []);

  useEffect(() => {
    if (patientId) loadPatient(patientId);
  }, [patientId, loadPatient]);

  function handleSearch(id) {
    navigate(`/patient/${id}`);
  }

  const mostRecentCluster = clusterHistory[0];
  const overallRisk = mostRecentCluster?.risk_tier ?? null;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 p-6">
      <div className="max-w-screen-xl mx-auto space-y-6">

        {/* Search bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-slate-900">Patient Overview</h1>
          <PatientSearch initialValue={patientId} onSearch={handleSearch} />
        </div>

        {!patientId ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">Enter a patient ID above to view their profile.</p>
          </div>
        ) : (
          <>
            {/* Patient header */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center gap-6 flex-wrap">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-2xl font-bold text-slate-900 truncate">{patientId}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {overallRisk ? (
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${tierBadgeClass(overallRisk)}`}>
                      {overallRisk} Risk
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">Unanalyzed</span>
                  )}
                  {mostRecentCluster && (
                    <span className="text-xs text-slate-400">
                      Last clustered {formatDate(mostRecentCluster.createdAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-slate-400">{media.length} image{media.length !== 1 ? "s" : ""} uploaded</p>
                <p className="text-xs text-slate-400">{clusterHistory.length} clustering run{clusterHistory.length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {/* MEWS + Notes row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MewsCalculator />
              <NotesAnalyzer />
            </div>

            {/* Imaging section */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-4">Uploaded Images &amp; Documents</p>
              {loadingMedia ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : media.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No images uploaded for this patient.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {media.map((file) => (
                    <MediaCard key={file.fileId} file={file} />
                  ))}
                </div>
              )}
            </div>

            {/* Clustering history section */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-4">Clustering History</p>
              {loadingCluster ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : (
                <ClusterHistoryTable history={clusterHistory} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
