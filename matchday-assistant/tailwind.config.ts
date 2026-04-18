import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0b0f1a",
          surface: "#111827",
          elevated: "#1f2937",
        },
        border: {
          DEFAULT: "#1f2937",
          strong: "#374151",
        },
        ability: {
          advanced: "#10b981",
          intermediate: "#f59e0b",
          developing: "#ef4444",
        },
      },
      fontSize: {
        "tap-lg": ["1.125rem", { lineHeight: "1.5rem" }],
      },
      minHeight: {
        tap: "44px",
      },
      minWidth: {
        tap: "44px",
      },
    },
  },
  plugins: [],
};

export default config;
