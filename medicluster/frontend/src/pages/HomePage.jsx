import { Link } from "react-router-dom";

const ALGORITHMS = [
  {
    title: "K-Means",
    tag: "Partitioning",
    desc: "Fast centroid-based clustering for well-separated patient groups with a known number of clusters.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
        <circle cx="20" cy="20" r="3" fill="#2563eb" />
        <circle cx="8"  cy="10" r="2.5" fill="#93c5fd" />
        <circle cx="11" cy="15" r="2"   fill="#93c5fd" />
        <circle cx="6"  cy="16" r="1.5" fill="#bfdbfe" />
        <circle cx="32" cy="10" r="2.5" fill="#93c5fd" />
        <circle cx="29" cy="15" r="2"   fill="#93c5fd" />
        <circle cx="33" cy="16" r="1.5" fill="#bfdbfe" />
        <circle cx="20" cy="34" r="2.5" fill="#93c5fd" />
        <circle cx="16" cy="30" r="2"   fill="#93c5fd" />
        <circle cx="24" cy="30" r="1.5" fill="#bfdbfe" />
        <line x1="20" y1="20" x2="8"  y2="10" stroke="#dbeafe" strokeWidth="1" strokeDasharray="2 2" />
        <line x1="20" y1="20" x2="32" y2="10" stroke="#dbeafe" strokeWidth="1" strokeDasharray="2 2" />
        <line x1="20" y1="20" x2="20" y2="34" stroke="#dbeafe" strokeWidth="1" strokeDasharray="2 2" />
      </svg>
    ),
  },
  {
    title: "DBSCAN",
    tag: "Density",
    desc: "Identifies dense patient populations and flags low-density patients as clinical outliers automatically.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
        <circle cx="12" cy="13" r="2" fill="#2563eb" />
        <circle cx="16" cy="17" r="2" fill="#2563eb" />
        <circle cx="10" cy="18" r="2" fill="#2563eb" />
        <circle cx="13" cy="22" r="2" fill="#2563eb" />
        <circle cx="27" cy="11" r="2" fill="#16a34a" />
        <circle cx="30" cy="15" r="2" fill="#16a34a" />
        <circle cx="25" cy="16" r="2" fill="#16a34a" />
        <circle cx="28" cy="20" r="2" fill="#16a34a" />
        <circle cx="35" cy="32" r="2" fill="#94a3b8" opacity="0.5" />
        <circle cx="5"  cy="33" r="2" fill="#94a3b8" opacity="0.5" />
        <circle cx="20" cy="36" r="2" fill="#94a3b8" opacity="0.5" />
        <circle cx="12" cy="17" r="9" stroke="#dbeafe" strokeWidth="1" strokeDasharray="3 2" fill="none" />
        <circle cx="28" cy="15" r="9" stroke="#dcfce7" strokeWidth="1" strokeDasharray="3 2" fill="none" />
      </svg>
    ),
  },
  {
    title: "Hierarchical",
    tag: "Agglomerative",
    desc: "Builds a dendrogram tree of nested clusters — choose K after inspecting the full patient hierarchy.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
        <circle cx="20" cy="5"  r="2.5" fill="#2563eb" />
        <circle cx="10" cy="18" r="2"   fill="#3b82f6" />
        <circle cx="30" cy="18" r="2"   fill="#3b82f6" />
        <circle cx="5"  cy="32" r="2"   fill="#93c5fd" />
        <circle cx="14" cy="32" r="2"   fill="#93c5fd" />
        <circle cx="26" cy="32" r="2"   fill="#93c5fd" />
        <circle cx="35" cy="32" r="2"   fill="#93c5fd" />
        <line x1="20" y1="7"  x2="10" y2="16" stroke="#bfdbfe" strokeWidth="1.5" />
        <line x1="20" y1="7"  x2="30" y2="16" stroke="#bfdbfe" strokeWidth="1.5" />
        <line x1="10" y1="20" x2="5"  y2="30" stroke="#dbeafe" strokeWidth="1.5" />
        <line x1="10" y1="20" x2="14" y2="30" stroke="#dbeafe" strokeWidth="1.5" />
        <line x1="30" y1="20" x2="26" y2="30" stroke="#dbeafe" strokeWidth="1.5" />
        <line x1="30" y1="20" x2="35" y2="30" stroke="#dbeafe" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: "GMM",
    tag: "Probabilistic",
    desc: "Soft-assignment clustering — every patient receives a probability score for each risk cluster.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
        <ellipse cx="15" cy="21" rx="11" ry="7" fill="#dbeafe" opacity="0.8" />
        <ellipse cx="25" cy="21" rx="11" ry="7" fill="#bfdbfe" opacity="0.8" />
        <ellipse cx="15" cy="21" rx="11" ry="7" stroke="#2563eb" strokeWidth="1.2" fill="none" />
        <ellipse cx="25" cy="21" rx="11" ry="7" stroke="#1d4ed8" strokeWidth="1.2" fill="none" />
        <circle  cx="15" cy="21" r="1.5" fill="#1e40af" />
        <circle  cx="25" cy="21" r="1.5" fill="#1e3a8a" />
      </svg>
    ),
  },
];

const STEPS = [
  {
    n: "1",
    title: "Upload Patient Data",
    desc: "Drop a CSV with patient vitals — age, BMI, blood pressure, glucose, and more. Or load the built-in sample dataset.",
  },
  {
    n: "2",
    title: "Run Clustering",
    desc: "Pick an algorithm, tune parameters, and hit Run. Risk tiers are assigned in seconds.",
  },
  {
    n: "3",
    title: "Review & Export",
    desc: "Explore scatter plots, risk breakdown, cluster profiles, and patient table. Export results as CSV.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/80 via-white to-white" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "radial-gradient(circle, #2563eb 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative max-w-3xl mx-auto text-center space-y-6">
          <span className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold rounded-full px-4 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Unsupervised ML · CT Scan AI Analysis · Real-time Risk Stratification
          </span>

          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Patient Risk<br />
            <span className="text-blue-600">Stratification</span> at Scale
          </h1>

          <p className="text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
            Upload patient vitals, run unsupervised clustering, and instantly
            identify at-risk populations — no labels, no manual review.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
            <Link to="/dashboard" className="btn-primary px-8 py-3 text-sm">
              Open Dashboard
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <a href="#how-it-works" className="btn-secondary px-8 py-3 text-sm">
              How It Works
            </a>
          </div>

          {/* Risk tier legend */}
          <div className="mt-8 max-w-sm mx-auto space-y-2">
            <p className="text-xs text-slate-400 text-left font-medium">Risk tier distribution (example)</p>
            <div className="flex h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-400 flex-1" />
              <div className="bg-amber-400 w-1/3" />
              <div className="bg-orange-500 w-1/5" />
              <div className="bg-red-500 w-[10%]" />
            </div>
            <div className="flex justify-between text-xs">
              {[["bg-emerald-400","Low"],["bg-amber-400","Moderate"],["bg-orange-500","High"],["bg-red-500","Critical"]].map(([c,l]) => (
                <span key={l} className="flex items-center gap-1 text-slate-400">
                  <span className={`w-2 h-2 rounded-full ${c} inline-block`} />{l}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Algorithms ───────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-slate-50 border-y border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900">Four Clustering Algorithms</h2>
            <p className="text-slate-500 text-sm mt-1.5">Compare all four or fine-tune a single one for your dataset.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ALGORITHMS.map((a) => (
              <div
                key={a.title}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all duration-200"
              >
                <div className="mb-4">{a.icon}</div>
                <span className="inline-block text-xs font-mono font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 py-0.5 mb-2">
                  {a.tag}
                </span>
                <h3 className="font-bold text-slate-900 mb-1.5 text-sm">{a.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex gap-4 hover:border-purple-200 transition-colors">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">CT Scan & Document Upload</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Attach medical images and reports to any patient record for complete clinical context.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 flex gap-4 hover:border-blue-200 transition-colors">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">AI Pathology Detection</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  DenseNet121 trained on CheXpert + NIH datasets detects 18 chest pathologies from uploaded scans.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-slate-900">How It Works</h2>
            <p className="text-slate-500 text-sm mt-1.5">From raw CSV to actionable risk tiers in under a minute.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {STEPS.map((s, i) => (
              <div key={s.n} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                    {s.n}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="hidden md:block flex-1 h-px bg-slate-200" />
                  )}
                </div>
                <h3 className="font-bold text-slate-900">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <Link to="/dashboard" className="btn-primary px-10 py-3 text-sm mx-auto inline-flex">
              Get Started
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-100 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
              <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5">
                <circle cx="10" cy="10" r="3" fill="#fff" />
                <circle cx="4"  cy="5"  r="2" fill="#fff" />
                <circle cx="16" cy="5"  r="2" fill="#fff" />
                <circle cx="4"  cy="15" r="2" fill="#fff" />
                <circle cx="16" cy="15" r="2" fill="#fff" />
                <line x1="10" y1="10" x2="4"  y2="5"  stroke="#fff" strokeWidth="1.2" />
                <line x1="10" y1="10" x2="16" y2="5"  stroke="#fff" strokeWidth="1.2" />
                <line x1="10" y1="10" x2="4"  y2="15" stroke="#fff" strokeWidth="1.2" />
                <line x1="10" y1="10" x2="16" y2="15" stroke="#fff" strokeWidth="1.2" />
              </svg>
            </div>
            <span className="font-semibold text-slate-600">MediCluster</span>
          </div>
          <span>CtrlAltElite · M S Engineering College · Hackathon 2024</span>
          <span>For clinical reference only — not a diagnostic tool.</span>
        </div>
      </footer>
    </div>
  );
}
