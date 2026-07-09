import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F3EFE6",
        ink: "#14202E",
        "ink-soft": "#2C3A4B",
        ledger: "#1D2B3A",
        brass: "#C08A3E",
        amber: "#E8A33D",
        moss: "#4B7A5B",
        rust: "#B4483A",
        line: "#D8D0BE",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        grain: "url('/grain.svg')",
      },
      borderRadius: {
        card: "3px",
      },
      keyframes: {
        ticker: {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-50%)" },
        },
        stamp: {
          "0%": { transform: "scale(1.4) rotate(-8deg)", opacity: "0" },
          "60%": { transform: "scale(0.95) rotate(-8deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(-8deg)", opacity: "1" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        ticker: "ticker 18s linear infinite",
        stamp: "stamp 0.4s ease-out",
        "pulse-dot": "pulseDot 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
