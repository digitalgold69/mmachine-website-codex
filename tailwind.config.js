/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        racing: {
          DEFAULT: "#0F3D2E",
          dark: "#08241C",
          light: "#155040",
        },
        gold: {
          DEFAULT: "#DF1718",
          dark: "#A30E13",
          light: "#F0443A",
        },
        cream: {
          DEFAULT: "#FBF8F1",
          dark: "#F5EFE0",
          darker: "#EAE0C8",
        },
        ink: {
          DEFAULT: "#2C2C2A",
          muted: "#5a4a3a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["'Playfair Display'", "Georgia", "serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.125rem" }],
        sm: ["0.9375rem", { lineHeight: "1.375rem" }],
        base: ["1.0625rem", { lineHeight: "1.625rem" }],
        lg: ["1.1875rem", { lineHeight: "1.75rem" }],
        xl: ["1.3125rem", { lineHeight: "1.875rem" }],
        "2xl": ["1.5625rem", { lineHeight: "2rem" }],
        "3xl": ["1.9375rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.3125rem", { lineHeight: "2.625rem" }],
        "5xl": ["3.0625rem", { lineHeight: "1" }],
        "6xl": ["3.8125rem", { lineHeight: "1" }],
      },
    },
  },
  plugins: [],
};
