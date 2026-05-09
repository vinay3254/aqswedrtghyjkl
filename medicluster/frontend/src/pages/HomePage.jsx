import React, { useState } from "react";
import { Link } from "react-router-dom";

const FEATURES = [
  {
    icon: "⚡",
    title: "K-Means",
    desc: "Fast centroid-based clustering. Ideal for well-separated, spherical clusters with known K.",
    tag: "Partitioning",
  },
  {
    icon: "🔍",
    title: "DBSCAN",
    desc: "Density-based clustering that detects arbitrary shapes and automatically identifies outliers as noise.",
    tag: "Density",
  },
  {
    icon: "🌿",
    title: "Hierarchical",
    desc: "Builds a tree of nested clusters. Visualise the full dendrogram and choose K after the fact.",
    tag: "Agglomerative",
  },
  {
    icon: "📊",
    title: "GMM",
    desc: "Probabilistic soft-assignment clustering. Each patient gets a probability score per cluster.",
    tag: "Probabilistic",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Upload Data", desc: "Drag-and-drop your patient CSV or use our bundled 100-patient sample dataset." },
  { step: "02", title: "Run Clustering", desc: "Choose an algorithm, tune parameters, and click Run. Results are computed in seconds." },
  { step: "03", title: "Analyse Results", desc: "Explore scatter plots, risk donut charts, the patient table, and quality metrics." },
];

export default function HomePage() {
  const [hovered, setHovered] = useState(null);

  return (
    <div className="min-h-screen bg-navy-900">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-16 px-6">
        {/* Background grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#2563eb 1px, transparent 1px), linear-gradient(90deg, #2563eb 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 text-xs text-blue-700">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            AI-powered · Unsupervised Clustering · Real-time Analysis
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-blue-950">
            Medi<span className="text-blue-600">Cluster</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            AI-powered patient risk stratification using unsupervised clustering. <br />
            Identify at-risk patient populations without labels — instantly.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link to="/dashboard" className="btn-primary px-8 py-3 text-base">
              Launch Dashboard
            </Link>
            <a
              href="#how-it-works"
              className="btn-secondary px-8 py-3 text-base"
            >
              Learn More
            </a>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 pt-8 text-center">
            {[
              { val: "4", label: "ML Algorithms" },
              { val: "3", label: "Quality Metrics" },
              { val: "100%", label: "Offline Ready" },
            ].map(({ val, label }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-blue-600 font-mono">{val}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Algorithm Cards ───────────────────────────────────────────────── */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-center text-blue-950 mb-2">4 Clustering Algorithms</h2>
        <p className="text-slate-500 text-center text-sm mb-10">
          Compare them all or tune a single algorithm for precision results.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className={`panel cursor-default transition-all duration-300 ${
                hovered === i
                  ? "border-blue-300 -translate-y-1"
                  : "hover:border-blue-200"
              }`}
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <div className="inline-block text-xs font-mono text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-0.5 mb-2">
                {f.tag}
              </div>
              <h3 className="font-bold text-blue-950 mb-1">{f.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-16 px-6 bg-blue-50/60">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-blue-950 mb-10">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.step} className="text-center space-y-3">
                <div className="w-12 h-12 rounded-full border border-blue-200 bg-white flex items-center justify-center mx-auto">
                  <span className="font-mono text-blue-700 text-sm font-bold">{step.step}</span>
                </div>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block absolute" />
                )}
                <h3 className="font-semibold text-blue-950">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link to="/dashboard" className="btn-primary px-10 py-3 text-base mx-auto inline-flex">
              Get Started
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-navy-700 py-6 px-6 text-center text-xs text-slate-600">
        <p>MediCluster · CtrlAltElite · M S Engineering College · Hackathon 2024</p>
      </footer>
    </div>
  );
}
