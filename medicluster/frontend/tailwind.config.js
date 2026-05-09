/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#eaf2ff",
          900: "#f8fbff",
          800: "#ffffff",
          700: "#dbeafe",
          600: "#bfdbfe",
        },
        teal: {
          400: "#3b82f6",
          500: "#2563eb",
          600: "#1d4ed8",
        },
        risk: {
          low: "#93c5fd",
          moderate: "#60a5fa",
          high: "#2563eb",
          critical: "#1e3a8a",
          noise: "#94a3b8",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
