/** @type {import('tailwindcss').Config} */
module.exports = {
  content: {
    relative: true,
    files: [
      "./index.html",
      "./src/**/*.{js,jsx}",
      "./ui/**/*.{js,jsx}",
    ],
  },
  theme: {
    extend: {
      colors: {
        primary: "#d85b34",
        secondary: "#1d6f52",
        accent: "#156f9d",
        neutral: "#18242b",
        info: "#156f9d",
        success: "#1d6f52",
        warning: "#c78918",
        error: "#b2473b",
        "base-100": "#ffffff",
        "base-200": "#f8fafc",
        "base-300": "#e5e7eb",
        "base-content": "#18242b",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        panel: "0 22px 48px rgba(24, 36, 43, 0.12)",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        yololab: {
          primary: "#d85b34",
          secondary: "#1d6f52",
          accent: "#156f9d",
          neutral: "#18242b",
          info: "#156f9d",
          success: "#1d6f52",
          warning: "#c78918",
          error: "#b2473b",
          "base-100": "#ffffff",
          "base-200": "#f8fafc",
          "base-300": "#e5e7eb",
          "base-content": "#18242b",
          "--rounded-box": "0.25rem",
          "--rounded-btn": "0.25rem",
          "--rounded-badge": "0.25rem",
          "--animation-btn": "0.18s",
          "--animation-input": "0.18s",
          "--btn-text-case": "none",
          "--navbar-padding": "0.75rem",
          "--border-btn": "1px",
          "--tab-border": "1px",
          "--tab-radius": "0.25rem",
        },
      },
    ],
    darkTheme: "yololab",
  },
};
