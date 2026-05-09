import React, { useMemo, useState } from "react";

const TIER_COLORS = {
  Low:      "badge-low",
  Moderate: "badge-moderate",
  High:     "badge-high",
  Critical: "badge-critical",
  Noise:    "badge-noise",
};

const PAGE_SIZE = 20;

export default function PatientTable({ patients = [] }) {
  const [search, setSearch]     = useState("");
  const [tierFilter, setTier]   = useState("All");
  const [sortKey, setSortKey]   = useState("patient_id");
  const [sortDir, setSortDir]   = useState("asc");
  const [page, setPage]         = useState(1);

  const tiers = ["All", "Low", "Moderate", "High", "Critical", "Noise"];

  const filtered = useMemo(() => {
    let rows = patients;
    if (search)
      rows = rows.filter((p) =>
        String(p.patient_id).toLowerCase().includes(search.toLowerCase())
      );
    if (tierFilter !== "All")
      rows = rows.filter((p) => p.risk_tier === tierFilter);
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [patients, search, tierFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sort = (key) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const exportCSV = () => {
    const cols = ["patient_id", "cluster_id", "risk_tier", "age", "bmi", "systolic_bp", "glucose", "pca_x", "pca_y"];
    const header = cols.join(",");
    const lines  = filtered.map((p) => cols.map((c) => csvCell(p[c])).join(","));
    const blob   = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href = url;
    a.download = "medicluster_results.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const columns = [
    { key: "patient_id",  label: "Patient ID" },
    { key: "age",         label: "Age" },
    { key: "bmi",         label: "BMI" },
    { key: "systolic_bp", label: "Sys BP" },
    { key: "glucose",     label: "Glucose" },
    { key: "risk_tier",   label: "Risk Tier" },
    { key: "cluster_id",  label: "Cluster" },
  ];

  return (
    <div className="panel space-y-3 fade-in">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <p className="section-label mb-0">Patient Table ({filtered.length} records)</p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search patient ID…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-field w-44 text-xs"
          />
          <select
            value={tierFilter}
            onChange={(e) => { setTier(e.target.value); setPage(1); }}
            className="input-field w-36 text-xs"
          >
            {tiers.map((t) => <option key={t}>{t}</option>)}
          </select>
          <button onClick={exportCSV} className="btn-secondary text-xs py-1.5 px-3">
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-navy-700">
        <table className="w-full text-xs text-left">
          <thead className="bg-navy-800 text-slate-500 uppercase tracking-wide">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => sort(col.key)}
                  className="px-3 py-2.5 cursor-pointer hover:text-blue-700 select-none whitespace-nowrap"
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-600">
                  No results match filters
                </td>
              </tr>
            ) : (
              pageRows.map((p, i) => (
                <tr
                  key={i}
                  className="border-t border-navy-700 hover:bg-navy-700/40 transition-colors"
                >
                  <td className="px-3 py-2 font-mono text-blue-700">{p.patient_id}</td>
                  <td className="px-3 py-2 font-mono">{p.age ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{fmt(p.bmi)}</td>
                  <td className="px-3 py-2 font-mono">{p.systolic_bp ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{fmt(p.glucose)}</td>
                  <td className="px-3 py-2">
                    <span className={TIER_COLORS[p.risk_tier] ?? "badge-noise"}>
                      {p.risk_tier ?? "?"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-500">{p.cluster_id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary text-xs py-1 px-2 disabled:opacity-30"
          >
            ← Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary text-xs py-1 px-2 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

const fmt = (v) => (v !== undefined && v !== null ? Number(v).toFixed(1) : "—");

const csvCell = (value) => {
  if (value === undefined || value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
