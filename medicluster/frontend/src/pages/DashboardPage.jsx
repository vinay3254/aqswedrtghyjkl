import React, { useState } from "react";
import UploadPanel       from "../components/UploadPanel";
import AlgorithmSelector from "../components/AlgorithmSelector";
import ClusterScatterPlot from "../components/ClusterScatterPlot";
import RiskDonutChart    from "../components/RiskDonutChart";
import MetricsPanel      from "../components/MetricsPanel";
import PatientTable      from "../components/PatientTable";
import ComparisonPanel   from "../components/ComparisonPanel";
import DendrogramView    from "../components/DendrogramView";
import { runClustering } from "../api/apiClient";
import sampleData        from "../data/sample_patients.json";

const TABS = ["Scatter Plot", "Comparison", "Dendrogram"];

export default function DashboardPage() {
  const [dataset,    setDataset]    = useState(null);
  const [result,     setResult]     = useState(null);
  const [allResults, setAllResults] = useState(null);
  const [error,      setError]      = useState(null);
  const [activeTab,  setActiveTab]  = useState(0);

  const handleDatasetLoaded = (ds) => {
    setDataset(ds);
    setResult(null);
    setAllResults(null);
  };

  const handleRun = async (algorithm, params) => {
    if (!dataset) { setError("Please upload a dataset first."); return; }
    setError(null);

    try {
      let res;
      if (dataset.datasetId === "__sample__") {
        // Offline mode: call ML engine directly via backend (pass raw data inline)
        // We forward as datasetId "__sample__" — backend handles this
        // Alternatively, call with raw data directly; for demo use sample data
        res = await runClustering(dataset.datasetId, algorithm, params);
      } else {
        res = await runClustering(dataset.datasetId, algorithm, params);
      }

      if (algorithm === "all") {
        setAllResults(res.all ?? {});
        setResult(null);
        setActiveTab(1);  // switch to comparison tab
      } else {
        setResult(res);
        setAllResults(null);
        setActiveTab(0);
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || "Clustering failed";
      setError(msg);
    }
  };

  const activePatients   = result?.patients     ?? [];
  const activeMetrics    = result?.metrics       ?? {};
  const activeRiskDist   = result?.risk_distribution ?? {};
  const featureNames     = result?.feature_names ?? [];
  const linkageMatrix    = result?.linkage_matrix ?? [];

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col overflow-hidden">
      {/* Error banner */}
      {error && (
        <div className="bg-red-900/30 border-b border-red-800 text-red-400 text-xs px-6 py-2 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="hover:text-red-200">✕</button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* ── Left sidebar ─────────────────────────────────────────────── */}
        <aside className="w-64 min-w-[14rem] flex flex-col gap-3 p-3 border-r border-navy-700 overflow-y-auto bg-navy-900">
          <UploadPanel onDatasetLoaded={handleDatasetLoaded} />
          <AlgorithmSelector
            onRun={handleRun}
            disabled={!dataset}
          />
        </aside>

        {/* ── Center main area ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex gap-1 px-4 pt-3 border-b border-navy-700 bg-navy-900">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${
                  activeTab === i
                    ? "text-teal-400 border-b-2 border-teal-500 -mb-px"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {activeTab === 0 && (
              <div className="h-[420px]">
                <ClusterScatterPlot patients={activePatients} featureNames={featureNames} />
              </div>
            )}
            {activeTab === 1 && (
              <ComparisonPanel allResults={allResults ?? {}} />
            )}
            {activeTab === 2 && (
              <DendrogramView linkageMatrix={linkageMatrix} patients={activePatients} />
            )}

            {/* Patient table always visible at bottom */}
            {activePatients.length > 0 && (
              <PatientTable patients={activePatients} />
            )}
          </div>
        </div>

        {/* ── Right panel ──────────────────────────────────────────────── */}
        <aside className="w-60 min-w-[14rem] flex flex-col gap-3 p-3 border-l border-navy-700 overflow-y-auto bg-navy-900">
          <RiskDonutChart riskDistribution={activeRiskDist} />
          <MetricsPanel   metrics={activeMetrics} />

          {/* Cluster profiles */}
          {result?.cluster_profiles?.length > 0 && (
            <div className="panel space-y-2 fade-in">
              <p className="section-label">Cluster Profiles</p>
              {result.cluster_profiles.map((cp) => (
                <div key={cp.cluster_id} className="text-xs space-y-0.5 border-b border-navy-700 pb-2 last:border-0 last:pb-0">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cluster {cp.cluster_id}</span>
                    <span className="font-mono">{cp.size} pts</span>
                  </div>
                  <span className={`badge-${cp.risk_tier?.toLowerCase() ?? "noise"}`}>
                    {cp.risk_tier}
                  </span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
