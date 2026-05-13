import { useState, useMemo, useEffect } from "react";
import UploadPanel        from "../components/UploadPanel";
import AlgorithmSelector  from "../components/AlgorithmSelector";
import ClusterScatterPlot from "../components/ClusterScatterPlot";
import RiskDonutChart     from "../components/RiskDonutChart";
import MetricsPanel       from "../components/MetricsPanel";
import PatientTable       from "../components/PatientTable";
import ComparisonPanel    from "../components/ComparisonPanel";
import DendrogramView     from "../components/DendrogramView";
import ChartErrorBoundary from "../components/ChartErrorBoundary";
import AIClusterInsights  from "../components/AIClusterInsights";
import { runClustering, detectAnomalies, explainClusters } from "../api/apiClient";
import { exportToPdf }    from "../utils/exportPdf";

const TABS = ["Scatter Plot", "Comparison", "Dendrogram", "Anomalies"];

const TIER_CLASS = {
  Low:      "badge-low",
  Moderate: "badge-moderate",
  High:     "badge-high",
  Critical: "badge-critical",
  Noise:    "badge-noise",
};

function PatientDetailModal({ patient, clusterProfiles, featureNames, onClose }) {
  const cluster = clusterProfiles?.find((cp) => cp.cluster_id === patient.cluster_id);
  const centroid = cluster?.centroid_features ?? {};
  const features = featureNames.filter((f) => patient[f] !== undefined && patient[f] !== null);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-4 border-b border-slate-100">
          <div>
            <p className="font-mono text-blue-700 font-bold text-sm">{patient.patient_id ?? "—"}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={TIER_CLASS[patient.risk_tier] ?? "badge-noise"}>{patient.risk_tier}</span>
              <span className="text-xs text-slate-400">Cluster {patient.cluster_id}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-600 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Feature Values</p>
          {features.map((f) => {
            const val = patient[f];
            const cVal = centroid[f];
            const diff = cVal !== undefined ? val - cVal : null;
            return (
              <div key={f} className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                <span className="text-slate-500 font-mono w-32 truncate">{f}</span>
                <div className="flex items-center gap-2">
                  {diff !== null && (
                    <span className={`text-xs font-mono ${Math.abs(diff) < 0.01 ? "text-slate-300" : diff > 0 ? "text-red-400" : "text-emerald-500"}`}>
                      {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                    </span>
                  )}
                  <span className="font-mono text-slate-800 font-semibold">
                    {typeof val === "number" ? val.toFixed(2) : String(val)}
                  </span>
                </div>
              </div>
            );
          })}
          {cluster && (
            <p className="text-xs text-slate-300 pt-2">
              Δ vs Cluster {patient.cluster_id} centroid · {cluster.size} patients
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AnomalyWatchlist({ patients, anomalies, featureNames, onPatientClick }) {
  if (!anomalies) {
    return (
      <div className="panel flex items-center justify-center h-40">
        <p className="text-xs text-slate-400">Anomaly detection runs automatically after clustering…</p>
      </div>
    );
  }
  const flags  = anomalies.anomaly_flags  ?? [];
  const scores = anomalies.anomaly_scores ?? [];
  const flagged = patients.filter((_, i) => flags[i] === -1 || flags[i] === 1);
  if (!flagged.length) {
    return (
      <div className="panel flex flex-col items-center justify-center h-40 gap-2">
        <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-xs text-slate-500">No anomalous patients detected.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-red-600 uppercase tracking-wide">
          {flagged.length} Anomalous Patient{flagged.length !== 1 ? "s" : ""} Detected
        </span>
        <span className="text-xs text-slate-400">— statistical outliers from Isolation Forest</span>
      </div>
      <div className="space-y-2">
        {flagged.map((p, i) => {
          const origIdx = patients.indexOf(p);
          const score   = scores[origIdx] ?? null;
          return (
            <div
              key={p.patient_id ?? i}
              onClick={() => onPatientClick(p)}
              className="panel border-red-200 bg-red-50/30 cursor-pointer hover:border-red-400 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <span className="font-mono text-sm font-bold text-slate-700">{p.patient_id ?? `Row ${origIdx}`}</span>
                  <span className={TIER_CLASS[p.risk_tier] ?? "badge-noise"}>{p.risk_tier}</span>
                </div>
                {score !== null && (
                  <span className="text-xs font-mono text-red-500 bg-red-100 px-2 py-0.5 rounded-full">
                    score: {score.toFixed(3)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {featureNames.slice(0, 6).map((f) => p[f] !== undefined && (
                  <span key={f} className="text-xs text-slate-500 font-mono">
                    {f}: <span className="text-slate-800 font-semibold">{typeof p[f] === "number" ? p[f].toFixed(1) : p[f]}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-600">No results yet</p>
        <p className="text-xs text-slate-400 mt-1">Upload a dataset and run clustering to see results here.</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [dataset,         setDataset]         = useState(null);
  const [result,          setResult]          = useState(null);
  const [allResults,      setAllResults]      = useState(null);
  const [error,           setError]           = useState(null);
  const [warnings,        setWarnings]        = useState([]);
  const [activeTab,       setActiveTab]       = useState(0);
  const [runKey,          setRunKey]          = useState(0);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [anomalies,       setAnomalies]       = useState(null);   // { anomaly_flags, anomaly_scores }
  const [shapData,        setShapData]        = useState(null);   // { feature_importances, shap_values }
  const [shapLoading,     setShapLoading]     = useState(false);

  const handleDatasetLoaded = (ds) => {
    setDataset(ds);
    setResult(null);
    setAllResults(null);
    setWarnings([]);
    setRunKey((k) => k + 1);
  };

  const handleRun = async (algorithm, params) => {
    if (!dataset) { setError("Upload a dataset first."); return; }
    setError(null);
    setWarnings([]);
    setAnomalies(null);
    setShapData(null);
    try {
      const inlineRows = dataset.datasetId === "__sample__" ? dataset.rawData : undefined;
      const res = await runClustering(dataset.datasetId, algorithm, params, inlineRows);
      setWarnings(collectWarnings(res));
      setRunKey((k) => k + 1);
      if (algorithm === "all") {
        setAllResults(res.all ?? {});
        setResult(null);
        setActiveTab(1);
      } else {
        setResult(res);
        setAllResults(null);
        setActiveTab(0);
        // auto-run anomaly detection in background
        if (res.patients?.length) {
          detectAnomalies(res.patients)
            .then((d) => setAnomalies(d))
            .catch(() => {});
        }
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Clustering failed");
    }
  };

  const loadShap = async () => {
    if (!result?.patients?.length || shapLoading) return;
    setShapLoading(true);
    try {
      const labels = result.patients.map((p) => p.cluster_id ?? 0);
      const data = await explainClusters(result.patients, labels);
      setShapData(data);
    } catch {
      // silently degrade
    } finally {
      setShapLoading(false);
    }
  };

  const activePatients   = result?.patients          ?? [];
  const activeMetrics    = result?.metrics           ?? {};
  const activeRiskDist   = result?.risk_distribution ?? {};
  const featureNames     = result?.feature_names     ?? [];
  const linkageMatrix    = result?.linkage_matrix    ?? [];
  const clusterProfiles  = result?.cluster_profiles  ?? [];
  const hasResults       = activePatients.length > 0 || allResults !== null;

  const featureImportance = useMemo(() => {
    if (!clusterProfiles.length || !featureNames.length) return [];
    const centroids = clusterProfiles.map((cp) => cp.centroid_features ?? {});
    const scored = featureNames.map((f) => {
      const vals = centroids.map((c) => Number(c[f]) || 0);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const std  = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
      return { feature: f, raw: std };
    });
    const maxRaw = Math.max(...scored.map((s) => s.raw), 1e-9);
    return scored
      .map(({ feature, raw }) => ({ feature, importance: raw / maxRaw }))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 8);
  }, [clusterProfiles, featureNames]);

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col overflow-hidden bg-slate-50">

      {/* ── Error / Warning banners ───────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 text-xs px-6 py-2.5 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </span>
          <button onClick={() => setError(null)} className="hover:text-red-900 p-0.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-700 text-xs px-6 py-2.5 flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            {warnings.map((w) => <p key={w}>{w}</p>)}
          </div>
          <button onClick={() => setWarnings([])} className="hover:text-amber-900 shrink-0 text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">

        {/* ── Left sidebar ─────────────────────────────────────────────── */}
        <aside className="w-64 min-w-[15rem] flex flex-col gap-3 p-3 border-r border-slate-200 overflow-y-auto bg-white">
          <UploadPanel onDatasetLoaded={handleDatasetLoaded} />
          <AlgorithmSelector onRun={handleRun} disabled={!dataset} dataset={dataset} />
        </aside>

        {/* ── Main area ────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Tab bar */}
          <div className="flex gap-0.5 px-4 pt-3 pb-0 border-b border-slate-200 bg-white items-center">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
                  activeTab === i
                    ? "text-blue-700 border-blue-600 bg-blue-50"
                    : "text-slate-400 border-transparent hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tab}
              </button>
            ))}
            {hasResults && (
              <button
                onClick={() => exportToPdf(
                  "dashboard-results",
                  `Clustering Report — ${result?.algorithm?.toUpperCase() ?? ""}`,
                  "medicluster-clustering"
                )}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors mb-0.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export PDF
              </button>
            )}
          </div>

          <div id="dashboard-results" className="flex-1 p-3 overflow-y-auto space-y-3">
            {!hasResults ? (
              <div className="h-72">
                <div className="panel h-full">
                  <EmptyState />
                </div>
              </div>
            ) : (
              <>
                {activeTab === 0 && (
                  <div className="h-[420px]">
                    <ChartErrorBoundary
                      title="Scatter plot"
                      resetKey={`${runKey}-${result?.algorithm ?? ""}-${activePatients.length}`}
                    >
                      <ClusterScatterPlot
                        patients={activePatients}
                        featureNames={featureNames}
                        onPatientClick={setSelectedPatient}
                      />
                    </ChartErrorBoundary>
                  </div>
                )}
                {activeTab === 1 && (
                  <ChartErrorBoundary
                    title="Algorithm comparison"
                    resetKey={`${runKey}-${Object.keys(allResults ?? {}).join("|")}`}
                  >
                    <ComparisonPanel allResults={allResults ?? {}} />
                  </ChartErrorBoundary>
                )}
                {activeTab === 2 && (
                  <ChartErrorBoundary
                    title="Dendrogram"
                    resetKey={`${runKey}-${linkageMatrix.length}-${activePatients.length}`}
                  >
                    <DendrogramView linkageMatrix={linkageMatrix} patients={activePatients} />
                  </ChartErrorBoundary>
                )}
                {activeTab === 3 && (
                  <AnomalyWatchlist
                    patients={activePatients}
                    anomalies={anomalies}
                    featureNames={featureNames}
                    onPatientClick={setSelectedPatient}
                  />
                )}
              </>
            )}

            {activePatients.length > 0 && <PatientTable patients={activePatients} />}

            {result && activePatients.length > 0 && (
              <AIClusterInsights result={result} />
            )}
          </div>
        </div>

        {/* ── Right panel ──────────────────────────────────────────────── */}
        <aside className="w-60 min-w-[14rem] flex flex-col gap-3 p-3 border-l border-slate-200 overflow-y-auto bg-white">
          <ChartErrorBoundary
            title="Risk distribution"
            resetKey={`${runKey}-${JSON.stringify(activeRiskDist)}`}
          >
            <RiskDonutChart riskDistribution={activeRiskDist} />
          </ChartErrorBoundary>

          <MetricsPanel metrics={activeMetrics} />

          {clusterProfiles.length > 0 && (
            <div className="panel space-y-2 fade-in">
              <p className="section-label">Cluster Profiles</p>
              {clusterProfiles.map((cp) => (
                <div key={cp.cluster_id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                  <div className="space-y-0.5">
                    <p className="text-slate-500 font-mono">Cluster {cp.cluster_id}</p>
                    <span className={TIER_CLASS[cp.risk_tier] ?? "badge-noise"}>{cp.risk_tier}</span>
                  </div>
                  <span className="font-mono text-slate-400">{cp.size} pts</span>
                </div>
              ))}
            </div>
          )}

          {featureImportance.length > 0 && (
            <div className="panel space-y-2 fade-in">
              <p className="section-label">Feature Importance</p>
              <p className="text-xs text-slate-400 -mt-1">What drives cluster separation</p>
              {featureImportance.map(({ feature, importance }) => (
                <div key={feature} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 font-mono truncate max-w-[110px]">{feature}</span>
                    <span className="text-slate-400">{Math.round(importance * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${importance * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SHAP Explainability Panel */}
          {result && activePatients.length > 0 && (
            <div className="panel space-y-2 fade-in">
              <div className="flex items-center justify-between">
                <p className="section-label mb-0">SHAP Explainability</p>
                {!shapData && (
                  <button
                    onClick={loadShap}
                    disabled={shapLoading}
                    className="text-xs text-violet-600 hover:text-violet-800 font-semibold disabled:opacity-50 flex items-center gap-1"
                  >
                    {shapLoading ? <><div className="spinner w-3 h-3" />Loading…</> : "Load"}
                  </button>
                )}
              </div>
              {!shapData && !shapLoading && (
                <p className="text-xs text-slate-400">Click Load to compute SHAP feature drivers.</p>
              )}
              {shapLoading && (
                <p className="text-xs text-slate-400 flex items-center gap-1.5"><div className="spinner w-3 h-3" />Computing SHAP values…</p>
              )}
              {shapData?.feature_importances && (
                <div className="space-y-1.5">
                  {Object.entries(shapData.feature_importances)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([feat, val]) => {
                      const max = Math.max(...Object.values(shapData.feature_importances));
                      const pct = max > 0 ? (val / max) * 100 : 0;
                      return (
                        <div key={feat} className="space-y-0.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600 font-mono truncate max-w-[110px]">{feat}</span>
                            <span className="text-violet-500 font-mono">{val.toFixed(3)}</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  <p className="text-xs text-slate-300 pt-1">Mean |SHAP| per feature</p>
                </div>
              )}
            </div>
          )}

          {!hasResults && (
            <div className="panel">
              <p className="section-label">Risk Distribution</p>
              <div className="space-y-2 mt-2">
                {["Low","Moderate","High","Critical"].map((t) => (
                  <div key={t} className="flex items-center justify-between text-xs">
                    <span className={TIER_CLASS[t]}>{t}</span>
                    <span className="text-slate-300 font-mono">—</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {selectedPatient && (
        <PatientDetailModal
          patient={selectedPatient}
          clusterProfiles={clusterProfiles}
          featureNames={featureNames}
          onClose={() => setSelectedPatient(null)}
        />
      )}
    </div>
  );
}

function collectWarnings(response) {
  const all = new Set(response?.warnings ?? []);
  for (const r of Object.values(response?.all ?? {}))
    for (const w of r?.warnings ?? []) all.add(w);
  return [...all];
}
