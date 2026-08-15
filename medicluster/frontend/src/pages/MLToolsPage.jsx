import { useState } from "react";
import ApiKeysCard from "../components/ApiKeysCard";
import {
  analyzeNotes, calcMews, forecastVitals,
  getOptimalK, detectAnomalies, explainClusters,
  checkDrugInteractions, askPatients, reduceDimensions,
} from "../api/apiClient";

// ── tiny helpers ──────────────────────────────────────────────────────────────
const SAMPLE_PATIENTS = [
  { age: 65, blood_pressure: 160, heart_rate: 105, cholesterol: 260 },
  { age: 30, blood_pressure: 110, heart_rate: 68,  cholesterol: 170 },
  { age: 72, blood_pressure: 178, heart_rate: 112, cholesterol: 295 },
  { age: 45, blood_pressure: 125, heart_rate: 78,  cholesterol: 195 },
  { age: 58, blood_pressure: 148, heart_rate: 92,  cholesterol: 240 },
  { age: 28, blood_pressure: 108, heart_rate: 65,  cholesterol: 160 },
  { age: 80, blood_pressure: 185, heart_rate: 118, cholesterol: 310 },
  { age: 38, blood_pressure: 118, heart_rate: 72,  cholesterol: 185 },
  { age: 55, blood_pressure: 140, heart_rate: 88,  cholesterol: 220 },
  { age: 67, blood_pressure: 162, heart_rate: 98,  cholesterol: 255 },
];

function Card({ title, icon, badge, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <span className="text-lg">{icon}</span>
        <h2 className="font-semibold text-slate-800 text-sm flex-1">{title}</h2>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-mono">
            {badge}
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Result({ data, loading }) {
  if (loading) return <p className="text-xs text-slate-400 italic mt-3">⏳ Running…</p>;
  if (!data) return null;
  return (
    <pre className="mt-3 text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-auto max-h-64 text-green-700 whitespace-pre-wrap">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function Btn({ onClick, loading, children }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
    >
      {loading ? "Running…" : children}
    </button>
  );
}

function Field({ label, value, onChange, type = "text", rows }) {
  return (
    <div className="mt-3">
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      {rows ? (
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-xs border border-slate-200 rounded-lg p-2 resize-y font-mono"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-xs border border-slate-200 rounded-lg p-2"
        />
      )}
    </div>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function NLPNotes() {
  const [notes, setNotes] = useState(
    "Patient admitted with acute pneumonia. HR 115 bpm. On amoxicillin and furosemide. HbA1c was 8.2%. Condition deteriorating."
  );
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try { setResult(await analyzeNotes(notes)); }
    catch (e) { setResult({ error: e.message }); }
    setLoading(false);
  };

  return (
    <Card title="Clinical Notes Analyzer" icon="📝" badge="POST /analyze-notes">
      <Field label="Free-text doctor notes" value={notes} onChange={setNotes} rows={4} />
      <Btn onClick={run} loading={loading}>Analyze Notes →</Btn>
      {result && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Risk Tier", value: result.risk_tier, color: result.risk_tier === "Critical" ? "red" : result.risk_tier === "High" ? "orange" : "green" },
              { label: "Trajectory", value: result.trajectory },
              { label: "NLP Backend", value: result.nlp_backend },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-xs bg-slate-100 rounded-lg px-3 py-1.5">
                <span className="text-slate-500">{label}: </span>
                <span className={`font-bold ${color === "red" ? "text-red-600" : color === "orange" ? "text-orange-500" : "text-slate-800"}`}>{value}</span>
              </div>
            ))}
          </div>
          {result.drugs?.length > 0 && (
            <div className="text-xs"><span className="text-slate-500">Drugs: </span>{result.drugs.join(", ")}</div>
          )}
          {result.icd10_suggestions?.length > 0 && (
            <div className="text-xs"><span className="text-slate-500">ICD-10: </span>
              {result.icd10_suggestions.map(c => `${c.code} (${c.keyword})`).join(" · ")}
            </div>
          )}
          {result.lab_values?.length > 0 && (
            <div className="text-xs"><span className="text-slate-500">Labs: </span>
              {result.lab_values.map(l => `${l.marker} ${l.value}${l.unit}`).join(", ")}
            </div>
          )}
          {result.summary && (
            <div className="text-xs bg-blue-50 border border-blue-100 rounded-lg p-2 text-blue-800">{result.summary}</div>
          )}
        </div>
      )}
    </Card>
  );
}

function DrugInteractions() {
  const [meds, setMeds] = useState("warfarin, aspirin, furosemide, digoxin");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try { setResult(await checkDrugInteractions(meds.split(",").map(s => s.trim()).filter(Boolean))); }
    catch (e) { setResult({ error: e.message }); }
    setLoading(false);
  };

  return (
    <Card title="Drug Interaction Checker" icon="💊" badge="POST /drug-interactions">
      <Field label="Medications (comma-separated)" value={meds} onChange={setMeds} />
      <Btn onClick={run} loading={loading}>Check Interactions →</Btn>
      {result && (
        <div className="mt-3 space-y-2">
          <p className={`text-xs font-semibold ${result.has_major_interaction ? "text-red-600" : "text-green-600"}`}>
            {result.summary}
          </p>
          {result.interactions?.map((i, idx) => (
            <div key={idx} className={`text-xs rounded-lg p-2 border ${i.severity === "major" ? "bg-red-50 border-red-200 text-red-700" : "bg-yellow-50 border-yellow-200 text-yellow-700"}`}>
              <strong>[{i.severity.toUpperCase()}]</strong> {i.drugs.join(" + ")}: {i.effect}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function MewsScore() {
  const [vals, setVals] = useState({ systolic_bp: 82, heart_rate: 118, respiratory_rate: 26, temperature: 38.9, consciousness: 1 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setVals(p => ({ ...p, [k]: +v }));
  const run = async () => {
    setLoading(true);
    try { setResult(await calcMews(vals)); }
    catch (e) { setResult({ error: e.message }); }
    setLoading(false);
  };

  const alertColor = { low: "green", moderate: "yellow", high: "orange", critical: "red" };
  const col = alertColor[result?.alert_level] || "slate";

  return (
    <Card title="MEWS Score Calculator" icon="🚨" badge="POST /mews">
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(vals).map(([k, v]) => (
          <Field key={k} label={k.replace(/_/g, " ")} value={v} onChange={val => set(k, val)} type="number" />
        ))}
      </div>
      <Btn onClick={run} loading={loading}>Calculate MEWS →</Btn>
      {result && !result.error && (
        <div className={`mt-3 rounded-xl p-3 border ${col === "red" ? "bg-red-50 border-red-300" : col === "orange" ? "bg-orange-50 border-orange-300" : "bg-green-50 border-green-300"}`}>
          <p className="text-2xl font-black text-slate-800">Score: {result.mews_score}</p>
          <p className={`text-sm font-bold uppercase mt-1 ${col === "red" ? "text-red-600" : col === "orange" ? "text-orange-600" : "text-green-600"}`}>{result.alert_level}</p>
          <p className="text-xs text-slate-600 mt-1">{result.recommendation}</p>
        </div>
      )}
    </Card>
  );
}

function VitalForecast() {
  const [hr, setHr] = useState("70, 72, 75, 78, 82, 86");
  const [bp, setBp] = useState("120, 118, 115, 112, 108");
  const [steps, setSteps] = useState("3");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      setResult(await forecastVitals({
        heart_rate: hr.split(",").map(Number),
        systolic_bp: bp.split(",").map(Number),
      }, +steps, "auto"));
    } catch (e) { setResult({ error: e.message }); }
    setLoading(false);
  };

  return (
    <Card title="Vital Signs Forecasting" icon="📈" badge="POST /forecast-vitals">
      <Field label="Heart Rate history (comma-separated readings)" value={hr} onChange={setHr} />
      <Field label="Systolic BP history" value={bp} onChange={setBp} />
      <Field label="Steps to forecast" value={steps} onChange={setSteps} type="number" />
      <Btn onClick={run} loading={loading}>Forecast →</Btn>
      {result && !result.error && (
        <div className="mt-3 space-y-2">
          {Object.entries(result.forecasts || {}).map(([vital, fc]) => (
            <div key={vital} className="text-xs bg-slate-50 rounded-lg p-2 border border-slate-200">
              <p className="font-semibold text-slate-700 capitalize">{vital.replace(/_/g, " ")}</p>
              <p className="text-blue-600">Next {steps}: {fc.forecasts?.join(" → ")}</p>
              <p className="text-slate-400">Method: {fc.method}</p>
            </div>
          ))}
          {result.mews_latest && (
            <div className="text-xs text-slate-600">
              MEWS: <strong>{result.mews_latest.mews_score}</strong> ({result.mews_latest.alert_level}) · Deterioration risk: <strong>{result.deterioration_risk}</strong>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function OptimalK() {
  const [kMin, setKMin] = useState("2");
  const [kMax, setKMax] = useState("8");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try { setResult(await getOptimalK(SAMPLE_PATIENTS)); }
    catch (e) { setResult({ error: e.message }); }
    setLoading(false);
  };

  return (
    <Card title="Optimal-K Selector" icon="🔢" badge="POST /optimal-k">
      <p className="text-xs text-slate-400">Uses built-in sample patient data. Sweeps K={kMin}–{kMax} and recommends best cluster count.</p>
      <div className="flex gap-3 mt-3">
        <Field label="K min" value={kMin} onChange={setKMin} type="number" />
        <Field label="K max" value={kMax} onChange={setKMax} type="number" />
      </div>
      <Btn onClick={run} loading={loading}>Find Best K →</Btn>
      {result && !result.error && (
        <div className="mt-3">
          <div className="flex gap-3 flex-wrap">
            {[
              { label: "Recommended K", value: result.recommended_k, highlight: true },
              { label: "Elbow K", value: result.elbow_k },
              { label: "Silhouette K", value: result.silhouette_k },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={`text-xs rounded-lg px-3 py-2 border ${highlight ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                <p className="opacity-70">{label}</p>
                <p className="text-xl font-black">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">{result.rationale}</p>
        </div>
      )}
    </Card>
  );
}

function AnomalyDetection() {
  const [contam, setContam] = useState("0.1");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const data = [...SAMPLE_PATIENTS, { age: 200, blood_pressure: 999, heart_rate: 300, cholesterol: 900 }];

  const run = async () => {
    setLoading(true);
    try { setResult(await detectAnomalies(data, +contam)); }
    catch (e) { setResult({ error: e.message }); }
    setLoading(false);
  };

  return (
    <Card title="Anomaly Detection" icon="⚠️" badge="POST /detect-anomalies">
      <p className="text-xs text-slate-400">Uses sample data with 1 extreme outlier injected (age=200, BP=999). Isolation Forest flags it.</p>
      <Field label="Contamination (expected anomaly %" value={contam} onChange={setContam} type="number" />
      <Btn onClick={run} loading={loading}>Detect Anomalies →</Btn>
      {result && !result.error && (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-semibold text-slate-700">{result.anomaly_count} anomal{result.anomaly_count === 1 ? "y" : "ies"} detected</p>
          {result.feature_contributions?.slice(0, 3).map((fc, i) => (
            <div key={i} className="text-xs bg-orange-50 border border-orange-200 rounded-lg p-2">
              <p className="font-semibold text-orange-700">Patient #{fc.patient_index} (score: {fc.anomaly_score})</p>
              {fc.top_deviations?.slice(0, 3).map(d => (
                <p key={d.feature} className="text-orange-600">{d.feature}: z={d.z_score}</p>
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ShapExplain() {
  const [algo, setAlgo] = useState("kmeans");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try { setResult(await explainClusters(SAMPLE_PATIENTS, [])); }
    catch (e) { setResult({ error: e.message }); }
    setLoading(false);
  };

  return (
    <Card title="SHAP Feature Importance" icon="🔬" badge="POST /explain">
      <p className="text-xs text-slate-400">Shows which features drive cluster assignments most. Uses sample patient data.</p>
      <Btn onClick={run} loading={loading}>Compute SHAP →</Btn>
      {result && !result.error && (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-semibold text-slate-600 mb-2">Global Feature Importance</p>
          {result.global_importance?.slice(0, 6).map((f, i) => {
            const max = result.global_importance[0]?.mean_abs_shap || 1;
            const pct = Math.round((f.mean_abs_shap / max) * 100);
            return (
              <div key={f.feature} className="flex items-center gap-2 text-xs">
                <span className="w-28 text-slate-600 truncate">{f.feature}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-12 text-right text-slate-500">{f.mean_abs_shap.toFixed(4)}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function PatientChatbot() {
  const [query, setQuery] = useState("Which High Risk patients have age over 60?");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const CHAT_PATIENTS = [
    { patient_id: "P001", cluster_id: 0, risk_tier: "High",     age: 65, heart_rate: 110 },
    { patient_id: "P002", cluster_id: 1, risk_tier: "Low",      age: 35, heart_rate: 72 },
    { patient_id: "P003", cluster_id: 0, risk_tier: "High",     age: 72, heart_rate: 105 },
    { patient_id: "P004", cluster_id: 2, risk_tier: "Critical", age: 80, heart_rate: 120 },
    { patient_id: "P005", cluster_id: 1, risk_tier: "Low",      age: 28, heart_rate: 68 },
  ];

  const run = async () => {
    setLoading(true);
    try { setResult(await askPatients(query, CHAT_PATIENTS)); }
    catch (e) { setResult({ error: e.message }); }
    setLoading(false);
  };

  return (
    <Card title="Patient Q&A Chatbot" icon="🤖" badge="POST /ask">
      <Field label='Ask a question (e.g. "Which High Risk patients?")'
        value={query} onChange={setQuery} />
      <Btn onClick={run} loading={loading}>Ask →</Btn>
      {result && !result.error && (
        <div className="mt-3 space-y-2">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800">{result.answer}</div>
          {result.matched_patients?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Matched {result.matched_count} patient(s):</p>
              {result.matched_patients.slice(0, 5).map(p => (
                <div key={p.patient_id} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 mb-1 flex gap-3">
                  <span className="font-mono text-slate-600">{p.patient_id}</span>
                  <span className={`font-semibold ${p.risk_tier === "Critical" ? "text-red-600" : p.risk_tier === "High" ? "text-orange-500" : "text-green-600"}`}>{p.risk_tier}</span>
                  <span className="text-slate-400">Age {p.age}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MLToolsPage() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-lg">🧠</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">ML & NLP Tools</h1>
            <p className="text-xs text-slate-400">Clinical notes analysis · MEWS scoring · Vital forecasting · Anomaly detection · SHAP · Chatbot</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-slate-400">ML Engine live on :8080</span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-5">
        <ApiKeysCard />
        <NLPNotes />
        <DrugInteractions />
        <MewsScore />
        <VitalForecast />
        <OptimalK />
        <AnomalyDetection />
        <ShapExplain />
        <PatientChatbot />
      </div>
    </div>
  );
}
