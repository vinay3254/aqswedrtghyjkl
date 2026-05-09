/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#050912",
          900: "#0A0F1E",
          800: "#0D1530",
          700: "#111b3a",
          600: "#162247",
        },
        teal: {
          400: "#2EEDC8",
          500: "#00D4AA",
          600: "#00B891",
        },
        risk: {
          low: "#22c55e",
          moderate: "#eab308",
          high: "#f97316",
          critical: "#ef4444",
          noise: "#6b7280",
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
