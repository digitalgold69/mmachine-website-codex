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
    },
  },
  plugins: [],
};
