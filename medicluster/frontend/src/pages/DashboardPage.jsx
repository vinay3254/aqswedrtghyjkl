import { useState } from "react";
import UploadPanel        from "../components/UploadPanel";
import AlgorithmSelector  from "../components/AlgorithmSelector";
import ClusterScatterPlot from "../components/ClusterScatterPlot";
import RiskDonutChart     from "../components/RiskDonutChart";
import MetricsPanel       from "../components/MetricsPanel";
import PatientTable       from "../components/PatientTable";
import ComparisonPanel    from "../components/ComparisonPanel";
import DendrogramView     from "../components/DendrogramView";
import ChartErrorBoundary from "../components/ChartErrorBoundary";
import { runClustering }  from "../api/apiClient";

const TABS = ["Scatter Plot", "Comparison", "Dendrogram"];

const TIER_CLASS = {
  Low:      "badge-low",
  Moderate: "badge-moderate",
  High:     "badge-high",
  Critical: "badge-critical",
  Noise:    "badge-noise",
};

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
  const [dataset,    setDataset]    = useState(null);
  const [result,     setResult]     = useState(null);
  const [allResults, setAllResults] = useState(null);
  const [error,      setError]      = useState(null);
  const [warnings,   setWarnings]   = useState([]);
  const [activeTab,  setActiveTab]  = useState(0);
  const [runKey,     setRunKey]     = useState(0);

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
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Clustering failed");
    }
  };

  const activePatients = result?.patients          ?? [];
  const activeMetrics  = result?.metrics           ?? {};
  const activeRiskDist = result?.risk_distribution ?? {};
  const featureNames   = result?.feature_names     ?? [];
  const linkageMatrix  = result?.linkage_matrix    ?? [];
  const hasResults     = activePatients.length > 0 || allResults !== null;

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
          <AlgorithmSelector onRun={handleRun} disabled={!dataset} />
        </aside>

        {/* ── Main area ────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Tab bar */}
          <div className="flex gap-0.5 px-4 pt-3 pb-0 border-b border-slate-200 bg-white">
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
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3">
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
                      <ClusterScatterPlot patients={activePatients} featureNames={featureNames} />
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
              </>
            )}

            {activePatients.length > 0 && <PatientTable patients={activePatients} />}
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

          {result?.cluster_profiles?.length > 0 && (
            <div className="panel space-y-2 fade-in">
              <p className="section-label">Cluster Profiles</p>
              {result.cluster_profiles.map((cp) => (
                <div key={cp.cluster_id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                  <div className="space-y-0.5">
                    <p className="text-slate-500 font-mono">Cluster {cp.cluster_id}</p>
                    <span className={TIER_CLASS[cp.risk_tier] ?? "badge-noise"}>
                      {cp.risk_tier}
                    </span>
                  </div>
                  <span className="font-mono text-slate-400">{cp.size} pts</span>
                </div>
              ))}
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
    </div>
  );
}

function collectWarnings(response) {
  const all = new Set(response?.warnings ?? []);
  for (const r of Object.values(response?.all ?? {}))
    for (const w of r?.warnings ?? []) all.add(w);
  return [...all];
}
