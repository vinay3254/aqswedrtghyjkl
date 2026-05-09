import React, { useState } from "react";

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

export default function AlgorithmSelector({ onRun, disabled }) {
  const [selected, setSelected] = useState("kmeans");
  const [params, setParams]     = useState(DEFAULT_PARAMS);
  const [loading, setLoading]   = useState(false);

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
                ? "bg-teal-500 text-navy-900"
                : "bg-navy-700 text-slate-400 hover:text-slate-200"
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
        className="w-full accent-teal-500 cursor-pointer"
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
