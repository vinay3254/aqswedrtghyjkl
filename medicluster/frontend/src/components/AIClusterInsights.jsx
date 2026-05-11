import { useMemo, useState } from "react";
import { generateClusterInsights } from "../api/apiClient";

const PRIORITY_CLASS = {
  Immediate: "bg-red-50 text-red-700 border-red-200",
  High: "bg-orange-50 text-orange-700 border-orange-200",
  Routine: "bg-blue-50 text-blue-700 border-blue-200",
  Monitor: "bg-slate-50 text-slate-600 border-slate-200",
};

function riskDistribution(result) {
  return result?.riskDistribution ?? result?.risk_distribution ?? {};
}

function clusterProfiles(result) {
  return result?.clusterProfiles ?? result?.cluster_profiles ?? [];
}

function featureNames(result) {
  return result?.featureNames ?? result?.feature_names ?? [];
}

function compactResult(result) {
  const patients = (result?.patients ?? []).map((patient) => ({
    patient_id: patient.patient_id,
    risk_tier: patient.risk_tier,
    cluster_id: patient.cluster_id,
    age: patient.age,
    bmi: patient.bmi,
    systolic_bp: patient.systolic_bp,
    diastolic_bp: patient.diastolic_bp,
    glucose: patient.glucose,
    hba1c: patient.hba1c,
    cholesterol: patient.cholesterol,
    ldl: patient.ldl,
    triglycerides: patient.triglycerides,
    spo2: patient.spo2,
    num_medications: patient.num_medications,
  }));

  return {
    algorithm: result?.algorithm,
    metrics: result?.metrics,
    riskDistribution: riskDistribution(result),
    clusterProfiles: clusterProfiles(result),
    featureNames: featureNames(result),
    warnings: result?.warnings ?? [],
    patients,
  };
}

function SourcePill({ source }) {
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
      source === "ai"
        ? "bg-violet-50 text-violet-700 border-violet-200"
        : "bg-slate-50 text-slate-500 border-slate-200"
    }`}>
      {source === "ai" ? "AI" : "Local"}
    </span>
  );
}

export default function AIClusterInsights({ result }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const payload = useMemo(() => compactResult(result), [result]);
  const canGenerate = (payload.patients?.length ?? 0) > 0 || (payload.clusterProfiles?.length ?? 0) > 0;

  async function handleGenerate() {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);
    try {
      const data = await generateClusterInsights(payload);
      setInsights(data);
    } catch (err) {
      setError(err?.response?.data?.error || "AI insights unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="section-label mb-0">AI Cohort Copilot</p>
            {insights?.source && <SourcePill source={insights.source} />}
          </div>
          {insights?.headline && (
            <h2 className="text-base font-bold text-slate-900 mt-2">{insights.headline}</h2>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || loading}
          className="btn-primary text-xs py-1.5 px-3 shrink-0 disabled:opacity-40"
        >
          {loading ? (
            <><div className="spinner w-3 h-3" />Thinking...</>
          ) : insights ? (
            "Refresh"
          ) : (
            "Generate insights"
          )}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {!insights && !loading && !error && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            ["Risk drivers", "Feature patterns behind cluster separation"],
            ["Care actions", "Follow-up priorities by cluster"],
            ["Watchlist", "High-acuity patients to review first"],
          ].map(([title, copy]) => (
            <div key={title} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold text-slate-700">{title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{copy}</p>
            </div>
          ))}
        </div>
      )}

      {insights && (
        <div className="mt-4 space-y-4">
          {insights.cohort_summary && (
            <p className="text-sm text-slate-600 leading-relaxed">{insights.cohort_summary}</p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Risk Drivers</p>
              {(insights.risk_drivers ?? []).length === 0 ? (
                <p className="text-xs text-slate-400">No dominant drivers returned.</p>
              ) : insights.risk_drivers.map((driver) => (
                <div key={`${driver.feature}-${driver.signal}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-mono font-bold text-slate-800">{driver.feature}</p>
                  <p className="text-xs text-blue-700 mt-1">{driver.signal}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{driver.rationale}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Care Actions</p>
              {(insights.cluster_actions ?? []).map((action) => (
                <div key={`${action.cluster_id}-${action.action}`} className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-slate-500">Cluster {action.cluster_id ?? "-"}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${PRIORITY_CLASS[action.priority] ?? PRIORITY_CLASS.Monitor}`}>
                      {action.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 mt-2 leading-relaxed">{action.action}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Watchlist</p>
              {(insights.patient_watchlist ?? []).length === 0 ? (
                <p className="text-xs text-slate-400">No high-acuity patients were returned.</p>
              ) : insights.patient_watchlist.map((patient) => (
                <div key={`${patient.patient_id}-${patient.reason}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-slate-800">{patient.patient_id}</span>
                    <span className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
                      {patient.risk_tier}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{patient.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {(insights.care_pathways ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {insights.care_pathways.map((pathway) => (
                <span key={pathway} className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-1">
                  {pathway}
                </span>
              ))}
            </div>
          )}

          {insights.safety_note && (
            <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">{insights.safety_note}</p>
          )}
        </div>
      )}
    </section>
  );
}
