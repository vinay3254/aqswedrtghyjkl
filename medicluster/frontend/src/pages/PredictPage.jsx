import { useState, useEffect } from "react";
import { listClusterResults, predictRisk } from "../api/apiClient";

const TIER_STYLES = {
  Low:      { badge: "bg-emerald-100 text-emerald-800 border border-emerald-200", bar: "bg-emerald-500" },
  Moderate: { badge: "bg-yellow-100 text-yellow-800 border border-yellow-200",   bar: "bg-yellow-500" },
  High:     { badge: "bg-orange-100 text-orange-800 border border-orange-200",   bar: "bg-orange-500" },
  Critical: { badge: "bg-red-100 text-red-800 border border-red-200",            bar: "bg-red-600"    },
  Noise:    { badge: "bg-slate-100 text-slate-600 border border-slate-200",      bar: "bg-slate-400"  },
};

const VITALS_FIELDS = [
  { key: "age",             label: "Age",             unit: "yrs",   min: 0,   max: 120,  step: 1   },
  { key: "bmi",             label: "BMI",             unit: "kg/m²", min: 10,  max: 60,   step: 0.1 },
  { key: "systolic_bp",     label: "Systolic BP",     unit: "mmHg",  min: 60,  max: 250,  step: 1   },
  { key: "diastolic_bp",    label: "Diastolic BP",    unit: "mmHg",  min: 40,  max: 150,  step: 1   },
  { key: "glucose",         label: "Glucose",         unit: "mg/dL", min: 50,  max: 500,  step: 1   },
  { key: "hba1c",           label: "HbA1c",           unit: "%",     min: 3,   max: 15,   step: 0.1 },
  { key: "cholesterol",     label: "Cholesterol",     unit: "mg/dL", min: 100, max: 400,  step: 1   },
  { key: "hdl",             label: "HDL",             unit: "mg/dL", min: 10,  max: 150,  step: 1   },
  { key: "ldl",             label: "LDL",             unit: "mg/dL", min: 30,  max: 300,  step: 1   },
  { key: "triglycerides",   label: "Triglycerides",   unit: "mg/dL", min: 30,  max: 1000, step: 1   },
  { key: "heart_rate",      label: "Heart Rate",      unit: "bpm",   min: 30,  max: 200,  step: 1   },
  { key: "spo2",            label: "SpO2",            unit: "%",     min: 50,  max: 100,  step: 0.1 },
  { key: "num_medications", label: "Num Medications", unit: "",      min: 0,   max: 50,   step: 1   },
];

function riskTierStyle(tier) {
  return TIER_STYLES[tier] ?? TIER_STYLES.Noise;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function PredictPage() {
  const [clusterResults, setClusterResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [selectedResultId, setSelectedResultId] = useState("");
  const [vitals, setVitals] = useState({});
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    listClusterResults()
      .then((data) => {
        setClusterResults(data);
        if (data.length > 0) setSelectedResultId(data[0]._id);
      })
      .catch(() => setClusterResults([]))
      .finally(() => setLoadingResults(false));
  }, []);

  function handleVitalChange(key, value) {
    setVitals((prev) => ({ ...prev, [key]: value === "" ? undefined : Number(value) }));
  }

  async function handlePredict(e) {
    e.preventDefault();
    if (!selectedResultId) { setError("Select a cluster result first."); return; }
    const filled = Object.fromEntries(
      Object.entries(vitals).filter(([, v]) => v !== undefined && !isNaN(v))
    );
    if (Object.keys(filled).length === 0) { setError("Enter at least one vital value."); return; }
    setPredicting(true);
    setError(null);
    setPrediction(null);
    try {
      const result = await predictRisk(selectedResultId, filled);
      setPrediction(result);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Prediction failed");
    } finally {
      setPredicting(false);
    }
  }

  const tierStyle = prediction ? riskTierStyle(prediction.risk_tier) : null;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 p-6">
      <div className="max-w-screen-xl mx-auto">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Risk Prediction</h1>
        <p className="text-sm text-slate-500 mb-6">
          Enter patient vitals to predict their risk tier based on a saved clustering result.
        </p>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700 ml-4">✕</button>
          </div>
        )}

        <div className="flex gap-6">
          {/* Left: form */}
          <div className="w-80 shrink-0 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Cluster Result</p>
              {loadingResults ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : clusterResults.length === 0 ? (
                <p className="text-sm text-slate-400">No saved results — run clustering first on the Dashboard.</p>
              ) : (
                <select
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedResultId}
                  onChange={(e) => setSelectedResultId(e.target.value)}
                >
                  {clusterResults.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.algorithm.toUpperCase()} — {formatDate(r.createdAt)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <form onSubmit={handlePredict} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Patient Vitals</p>
              {VITALS_FIELDS.map(({ key, label, unit, min, max, step }) => (
                <div key={key}>
                  <label className="text-xs text-slate-500 block mb-0.5">
                    {label}{unit ? ` (${unit})` : ""}
                  </label>
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    placeholder="—"
                    value={vitals[key] ?? ""}
                    onChange={(e) => handleVitalChange(key, e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={predicting || clusterResults.length === 0}
                className="w-full mt-2 btn-primary text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {predicting ? "Predicting…" : "Predict Risk"}
              </button>
            </form>
          </div>

          {/* Right: result panel */}
          <div className="flex-1">
            {!prediction ? (
              <div className="bg-white rounded-xl border border-slate-200 h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500">Fill in vitals and click Predict Risk</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Risk tier + confidence */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center gap-4 mb-4 flex-wrap">
                    <span className={`text-lg font-bold px-4 py-2 rounded-xl ${tierStyle.badge}`}>
                      {prediction.risk_tier}
                    </span>
                    <div>
                      <p className="text-xs text-slate-400">Algorithm</p>
                      <p className="text-sm font-semibold text-slate-700 uppercase">{prediction.algorithm}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Nearest Cluster</p>
                      <p className="text-sm font-semibold text-slate-700">Cluster {prediction.cluster_id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Cluster Size</p>
                      <p className="text-sm font-semibold text-slate-700">{prediction.cluster_profile?.size ?? "—"} patients</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Confidence</span>
                      <span>{Math.round(prediction.confidence * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${tierStyle.bar}`}
                        style={{ width: `${prediction.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Feature deviations */}
                {prediction.feature_deviations?.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                      Top Feature Deviations from Centroid
                    </p>
                    <div className="space-y-3">
                      {prediction.feature_deviations.map(({ feature, patient_value, centroid_value, deviation }) => (
                        <div key={feature} className="text-xs">
                          <div className="flex justify-between mb-0.5">
                            <span className="font-mono text-slate-600">{feature}</span>
                            <span className={deviation > 0 ? "text-red-500" : "text-blue-500"}>
                              {deviation > 0 ? "+" : ""}{deviation.toFixed(1)}
                              <span className="text-slate-400 ml-1">
                                (you: {patient_value.toFixed(1)} | centroid: {centroid_value.toFixed(1)})
                              </span>
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${deviation > 0 ? "bg-red-400" : "bg-blue-400"}`}
                              style={{ width: `${Math.min(100, (Math.abs(deviation) / Math.max(Math.abs(centroid_value), 1)) * 50)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All distances */}
                {prediction.all_distances?.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                      Distance to All Clusters
                    </p>
                    <div className="space-y-2">
                      {prediction.all_distances.map(({ cluster_id, risk_tier, distance }) => {
                        const maxDist = Math.max(...prediction.all_distances.map((d) => d.distance ?? 0), 1);
                        const isNearest = cluster_id === prediction.cluster_id;
                        return (
                          <div key={cluster_id} className="text-xs">
                            <div className="flex justify-between mb-0.5">
                              <span className="font-mono text-slate-600">
                                Cluster {cluster_id}
                                {isNearest && <span className="ml-1 text-blue-500 font-semibold">★ nearest</span>}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${riskTierStyle(risk_tier).badge}`}>
                                  {risk_tier}
                                </span>
                                <span className="text-slate-400 font-mono">{distance !== null ? distance.toFixed(1) : "—"}</span>
                              </div>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full ${isNearest ? "bg-blue-500" : "bg-slate-300"}`}
                                style={{ width: `${distance !== null ? (distance / maxDist) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
