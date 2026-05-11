import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0 group">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
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
          <span className="font-bold text-base text-slate-900 group-hover:text-blue-600 transition-colors">
            Medi<span className="text-blue-600">Cluster</span>
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-0.5">
          {[
            { to: "/",          label: "Home" },
            { to: "/dashboard", label: "Dashboard" },
            { to: "/imaging",   label: "Imaging" },
            { to: "/predict",   label: "Predict" },
            { to: "/patient",   label: "Patients" },
            { to: "/reminders", label: "Reminders" },
            { to: "/mci",      label: "MCI Board" },
            { to: "/ask-ai",   label: "CliniQ" },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === to
                  ? "text-blue-700 bg-blue-50"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {label}
            </Link>
          ))}
          <a
            href="http://localhost:5174"
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            Dispatch
          </a>
        </nav>

        {/* CTA — only on home */}
        {pathname === "/" && (
          <Link to="/dashboard" className="btn-primary text-sm py-1.5 px-4 shrink-0">
            Launch App
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        )}
      </div>
    </header>
  );
}
