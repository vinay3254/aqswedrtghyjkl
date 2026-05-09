import React from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const TIER_CONFIG = {
  Low:      { color: "#93c5fd", label: "Low Risk" },
  Moderate: { color: "#60a5fa", label: "Moderate Risk" },
  High:     { color: "#2563eb", label: "High Risk" },
  Critical: { color: "#1e3a8a", label: "Critical Risk" },
  Noise:    { color: "#94a3b8", label: "Noise / Outlier" },
};

const TIER_ORDER = ["Low", "Moderate", "High", "Critical", "Noise"];

export default function RiskDonutChart({ riskDistribution = {} }) {
  const total = Object.values(riskDistribution).reduce((a, b) => a + b, 0);

  const data = TIER_ORDER
    .filter((t) => riskDistribution[t] > 0)
    .map((t) => ({
      name: t,
      value: riskDistribution[t],
      color: TIER_CONFIG[t]?.color ?? "#888",
      pct: total ? ((riskDistribution[t] / total) * 100).toFixed(1) : 0,
    }));

  const isEmpty = data.length === 0;

  const CenterLabel = () => (
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
      <tspan
        x="50%"
        dy="-6"
        fontSize="22"
        fontWeight="700"
        fill="#0f172a"
        fontFamily="JetBrains Mono"
      >
        {total}
      </tspan>
      <tspan x="50%" dy="18" fontSize="10" fill="#64748b" fontFamily="Inter">
        patients
      </tspan>
    </text>
  );

  return (
    <div className="panel space-y-2">
      <p className="section-label">Risk Distribution</p>

      {isEmpty ? (
        <div className="h-40 flex items-center justify-center text-slate-600 text-sm">
          No data yet
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={82}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="transparent" />
                ))}
                <CenterLabel />
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-blue-100 rounded-lg px-3 py-2 text-xs shadow-sm">
                      <p style={{ color: d.color }} className="font-semibold">{d.name}</p>
                      <p className="text-slate-700">{d.value} patients ({d.pct}%)</p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="space-y-1.5">
            {data.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-slate-600">{TIER_CONFIG[d.name]?.label ?? d.name}</span>
                </div>
                <div className="font-mono text-slate-700">
                  {d.value} <span className="text-slate-600">({d.pct}%)</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
