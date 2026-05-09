import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <header className="sticky top-0 z-50 bg-navy-900/95 backdrop-blur border-b border-navy-700">
      <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
              <circle cx="10" cy="10" r="3" fill="#0A0F1E" />
              <circle cx="4"  cy="5"  r="2" fill="#0A0F1E" />
              <circle cx="16" cy="5"  r="2" fill="#0A0F1E" />
              <circle cx="4"  cy="15" r="2" fill="#0A0F1E" />
              <circle cx="16" cy="15" r="2" fill="#0A0F1E" />
              <line x1="10" y1="10" x2="4"  y2="5"  stroke="#0A0F1E" strokeWidth="1.2" />
              <line x1="10" y1="10" x2="16" y2="5"  stroke="#0A0F1E" strokeWidth="1.2" />
              <line x1="10" y1="10" x2="4"  y2="15" stroke="#0A0F1E" strokeWidth="1.2" />
              <line x1="10" y1="10" x2="16" y2="15" stroke="#0A0F1E" strokeWidth="1.2" />
            </svg>
          </div>
          <span className="font-bold text-lg text-white tracking-tight group-hover:text-teal-400 transition-colors">
            Medi<span className="text-teal-500">Cluster</span>
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {[
            { to: "/", label: "Home" },
            { to: "/dashboard", label: "Dashboard" },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === to
                  ? "text-teal-400 bg-teal-500/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-navy-700"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        {isHome && (
          <Link to="/dashboard" className="btn-primary text-sm py-1.5 px-4">
            Launch App
          </Link>
        )}
      </div>
    </header>
  );
}
