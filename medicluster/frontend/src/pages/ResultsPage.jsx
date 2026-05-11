import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getClusterResult } from "../api/apiClient";
import ClusterScatterPlot  from "../components/ClusterScatterPlot";
import RiskDonutChart       from "../components/RiskDonutChart";
import MetricsPanel         from "../components/MetricsPanel";
import PatientTable         from "../components/PatientTable";
import ChartErrorBoundary   from "../components/ChartErrorBoundary";
import AIClusterInsights    from "../components/AIClusterInsights";

export default function ResultsPage() {
  const { id } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]    = useState(null);

  useEffect(() => {
    getClusterResult(id)
      .then(setResult)
      .catch((e) => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-slate-500">
        <div className="spinner w-6 h-6" />
        <span>Loading result…</span>
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-blue-800">
        <p>{error}</p>
        <Link to="/dashboard" className="btn-secondary text-sm">← Back to Dashboard</Link>
      </div>
    );

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-blue-950">
            Cluster Result — <span className="text-blue-600 font-mono">{result.algorithm}</span>
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {id}</p>
        </div>
        <Link to="/dashboard" className="btn-secondary text-sm">← Dashboard</Link>
      </div>

      {result.warnings?.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 text-blue-800 text-xs px-4 py-3 rounded-lg space-y-1">
          {result.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-[400px]">
          <ChartErrorBoundary
            title="Scatter plot"
            resetKey={`${result._id ?? id}-${result.patients?.length ?? 0}`}
          >
            <ClusterScatterPlot
              patients={result.patients ?? []}
              featureNames={result.featureNames ?? []}
            />
          </ChartErrorBoundary>
        </div>
        <div className="space-y-4">
          <ChartErrorBoundary
            title="Risk distribution"
            resetKey={JSON.stringify(result.riskDistribution ?? {})}
          >
            <RiskDonutChart riskDistribution={result.riskDistribution ?? {}} />
          </ChartErrorBoundary>
          <MetricsPanel   metrics={result.metrics ?? {}} />
        </div>
      </div>

      <AIClusterInsights result={result} />

      <PatientTable patients={result.patients ?? []} />
    </div>
  );
}
