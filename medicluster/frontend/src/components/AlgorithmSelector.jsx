import React, { useState } from "react";
import { getOptimalK } from "../api/apiClient";

const ALGORITHMS = [
  { id: "kmeans",       label: "K-Means" },
  { id: "dbscan",       label: "DBSCAN" },
  { id: "hierarchical", label: "Hierarchical" },
  { id: "gmm",          label: "GMM" },
  { id: "all",          label: "All" },
];

const DEFAULT_PARAMS = {
  kmeans:       { k: 4, init: "k-means++" },
  dbscan:       { eps: 0.5, min_samples: 5 },
  hierarchical: { n_clusters: 4, linkage: "ward" },
  gmm:          { n_components: 4, covariance_type: "full" },
  all:          {},
};

export default function AlgorithmSelector({ onRun, disabled, dataset }) {
  const [selected,    setSelected]    = useState("kmeans");
  const [params,      setParams]      = useState(DEFAULT_PARAMS);
  const [loading,     setLoading]     = useState(false);
  const [recLoading,  setRecLoading]  = useState(false);
  const [recResult,   setRecResult]   = useState(null); // { best_k, scores }

  const set = (key, val) =>
    setParams((p) => ({ ...p, [selected]: { ...p[selected], [key]: val } }));

  const handleRun = async () => {
    setLoading(true);
    try {
      await onRun?.(selected, params[selected] ?? {});
    } finally {
      setLoading(false);
    }
  };

  const handleRecommendK = async () => {
    if (!dataset) return;
    setRecLoading(true);
    setRecResult(null);
    try {
      const rows = dataset.datasetId === "__sample__" ? dataset.rawData : dataset.preview;
      const data = await getOptimalK(rows);
      const bestK = data.best_k ?? data.optimal_k ?? data.recommended_k;
      if (bestK) {
        setRecResult(data);
        // Auto-apply K to the active param
        if (selected === "kmeans")       set("k", bestK);
        else if (selected === "gmm")     set("n_components", bestK);
        else if (selected === "hierarchical") set("n_clusters", bestK);
      }
    } catch {
      // silently ignore — button just won't show a result
    } finally {
      setRecLoading(false);
    }
  };

  const showRecommendBtn = (selected === "kmeans" || selected === "gmm" || selected === "hierarchical") && !disabled;

  return (
    <div className="panel space-y-3">
      <p className="section-label">Algorithm</p>

      {/* Algorithm tabs */}
      <div className="flex flex-wrap gap-1">
        {ALGORITHMS.map((algo) => (
          <button
            key={algo.id}
            onClick={() => setSelected(algo.id)}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
              selected === algo.id
                ? "bg-blue-600 text-white"
                : "bg-blue-50 text-slate-600 hover:text-blue-700"
            }`}
          >
            {algo.label}
          </button>
        ))}
      </div>

      {/* Dynamic parameter controls */}
      <div className="space-y-3 text-sm">
        {selected === "kmeans" && (
          <>
            <SliderField
              label={`K (clusters): ${params.kmeans.k}`}
              min={2} max={8} step={1}
              value={params.kmeans.k}
              onChange={(v) => set("k", +v)}
            />
            <SelectField
              label="Init method"
              options={["k-means++", "random"]}
              value={params.kmeans.init}
              onChange={(v) => set("init", v)}
            />
          </>
        )}

        {selected === "dbscan" && (
          <>
            <SliderField
              label={`Epsilon: ${params.dbscan.eps}`}
              min={0.1} max={2.0} step={0.1}
              value={params.dbscan.eps}
              onChange={(v) => set("eps", +v)}
            />
            <SliderField
              label={`Min Samples: ${params.dbscan.min_samples}`}
              min={2} max={20} step={1}
              value={params.dbscan.min_samples}
              onChange={(v) => set("min_samples", +v)}
            />
          </>
        )}

        {selected === "hierarchical" && (
          <>
            <SliderField
              label={`Clusters: ${params.hierarchical.n_clusters}`}
              min={2} max={8} step={1}
              value={params.hierarchical.n_clusters}
              onChange={(v) => set("n_clusters", +v)}
            />
            <SelectField
              label="Linkage"
              options={["ward", "complete", "average", "single"]}
              value={params.hierarchical.linkage}
              onChange={(v) => set("linkage", v)}
            />
          </>
        )}

        {selected === "gmm" && (
          <>
            <SliderField
              label={`Components: ${params.gmm.n_components}`}
              min={2} max={8} step={1}
              value={params.gmm.n_components}
              onChange={(v) => set("n_components", +v)}
            />
            <SelectField
              label="Covariance type"
              options={["full", "tied", "diag", "spherical"]}
              value={params.gmm.covariance_type}
              onChange={(v) => set("covariance_type", v)}
            />
          </>
        )}

        {selected === "all" && (
          <p className="text-xs text-slate-500 italic">
            Runs all 4 algorithms with default parameters for side-by-side comparison.
          </p>
        )}
      </div>

      {/* Recommend K */}
      {showRecommendBtn && (
        <div className="space-y-1">
          <button
            onClick={handleRecommendK}
            disabled={recLoading}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors disabled:opacity-50"
          >
            {recLoading ? (
              <><div className="spinner w-3 h-3" />Finding best K…</>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Recommend K
              </>
            )}
          </button>
          {recResult && (
            <div className="bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-2 text-xs space-y-1">
              <p className="font-semibold text-violet-800">
                Recommended K = <span className="text-violet-600 text-sm">{recResult.best_k ?? recResult.optimal_k}</span>
                <span className="text-violet-400 font-normal ml-1">(auto-applied)</span>
              </p>
              {recResult.scores && (
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(recResult.scores).slice(0, 4).map(([k, v]) => (
                    <span key={k} className={`px-1.5 py-0.5 rounded font-mono ${String(k) === String(recResult.best_k ?? recResult.optimal_k) ? "bg-violet-600 text-white" : "bg-white text-slate-500 border border-slate-200"}`}>
                      K={k}: {typeof v === "number" ? v.toFixed(3) : v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={disabled || loading}
        className="btn-primary w-full"
      >
        {loading ? (
          <>
            <div className="spinner w-4 h-4" />
            <span>Clustering…</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
            </svg>
            Run Clustering
          </>
        )}
      </button>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SliderField({ label, min, max, step, value, onChange }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-1 font-mono">{label}</p>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full accent-blue-600 cursor-pointer"
      />
      <div className="flex justify-between text-xs text-slate-600">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

function SelectField({ label, options, value, onChange }) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
