import React from "react";

const METRIC_CONFIG = {
  silhouette: {
    label: "Silhouette Score",
    unit: "",
    min: -1,
    max: 1,
    higherBetter: true,
    interpret: (v) =>
      v === null ? "N/A"
      : v > 0.7  ? "Excellent clustering"
      : v > 0.5  ? "Reasonable structure"
      : v > 0.25 ? "Weak clustering"
      : "Overlapping clusters",
    color: (v) =>
      v === null ? "#64748b"
      : v > 0.5  ? "#1d4ed8"
      : v > 0.25 ? "#60a5fa"
      : "#94a3b8",
  },
  davies_bouldin: {
    label: "Davies-Bouldin Index",
    unit: "",
    min: 0,
    max: 3,
    higherBetter: false,
    interpret: (v) =>
      v === null ? "N/A"
      : v < 0.5  ? "Excellent separation"
      : v < 1.0  ? "Good separation"
      : v < 2.0  ? "Moderate overlap"
      : "Poor separation",
    color: (v) =>
      v === null ? "#64748b"
      : v < 0.5  ? "#1d4ed8"
      : v < 1.0  ? "#60a5fa"
      : "#94a3b8",
  },
  calinski_harabasz: {
    label: "Calinski-Harabasz",
    unit: "",
    min: 0,
    max: null,  // unbounded
    higherBetter: true,
    interpret: (v) =>
      v === null ? "N/A"
      : v > 500   ? "Very dense, well-separated clusters"
      : v > 200   ? "Good cluster structure"
      : v > 50    ? "Moderate structure"
      : "Diffuse clusters",
    color: (v) =>
      v === null ? "#64748b"
      : v > 200   ? "#1d4ed8"
      : v > 50    ? "#60a5fa"
      : "#94a3b8",
  },
};

export default function MetricsPanel({ metrics = {} }) {
  return (
    <div className="panel space-y-3">
      <p className="section-label">Cluster Quality Metrics</p>
      {Object.entries(METRIC_CONFIG).map(([key, cfg]) => {
        const raw = metrics[key] ?? null;
        const display = raw !== null ? raw.toFixed(3) : "—";
        const color = cfg.color(raw);
        const pct = computePct(raw, cfg);

        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-400">{cfg.label}</span>
              <span className="font-mono text-sm font-semibold" style={{ color }}>
                {display}
              </span>
            </div>
            {/* Bar */}
            <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
            <p className="text-xs text-slate-600 italic">{cfg.interpret(raw)}</p>
          </div>
        );
      })}
    </div>
  );
}

function computePct(value, cfg) {
  if (value === null) return 0;
  if (cfg.higherBetter) {
    // Silhouette: -1 to 1 → 0–100%
    if (cfg.min === -1 && cfg.max === 1) {
      return ((value + 1) / 2) * 100;
    }
    // Calinski: 0 to ∞, cap at 1000
    const cap = cfg.max ?? 1000;
    return Math.min((value / cap) * 100, 100);
  } else {
    // Davies-Bouldin: 0 to 3, lower is better → invert
    const cap = cfg.max ?? 3;
    return Math.max(0, (1 - value / cap) * 100);
  }
}
