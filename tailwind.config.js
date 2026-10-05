/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          bg: "#f8f9fa",
          subtle: "#f1f3f5",
          border: "#e5e7eb",
          card: "#ffffff",
        },
        ink: {
          primary: "#0f172a",
          secondary: "#475569",
          muted: "#94a3b8",
          border: "#cbd5e1",
        },
        brand: {
          blue: "#0052ff",
          blueHover: "#0045d8",
          blueLight: "#eff4ff",
          indigo: "#4f46e5",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
