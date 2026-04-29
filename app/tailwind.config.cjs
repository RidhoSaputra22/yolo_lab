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
          "primary-content": "#ffffff",
          secondary: "#1d6f52",
          "secondary-content": "#ffffff",
          accent: "#156f9d",
          "accent-content": "#ffffff",
          neutral: "#18242b",
          "neutral-content": "#f7fafc",
          info: "#156f9d",
          "info-content": "#ffffff",
          success: "#1d6f52",
          "success-content": "#ffffff",
          warning: "#c78918",
          "warning-content": "#17110a",
          error: "#b2473b",
          "error-content": "#ffffff",
          "base-100": "#ffffff",
          "base-200": "#f5f7fb",
          "base-300": "#dbe3ec",
          "base-content": "#172033",
          "--rounded-box": "0.5rem",
          "--rounded-btn": "0.375rem",
          "--rounded-badge": "0.375rem",
          "--padding-card": "1.25rem",
          "--tab-radius": "0.375rem",
          "--animation-btn": "0.18s",
          "--animation-input": "0.18s",
          "--btn-text-case": "none",
          "--navbar-padding": "0.75rem",
          "--border-btn": "1px",
          "--tab-border": "1px",
        },
      },
    ],
    darkTheme: "yololab",
  },
};
