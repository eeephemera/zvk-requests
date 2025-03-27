/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        discord: {
          bg: "var(--discord-bg)",
          darker: "var(--discord-darker)",
          dark: "var(--discord-dark)",
          medium: "var(--discord-medium)",
          light: "var(--discord-light)",
          lightest: "var(--discord-lightest)",
          text: "var(--discord-text)",
          "text-muted": "var(--discord-text-muted)",
          "text-secondary": "var(--discord-text-secondary)",
          accent: "var(--discord-accent)",
          "accent-dark": "var(--discord-accent-dark)",
          "accent-light": "var(--discord-accent-light)",
          "accent-super-light": "var(--discord-accent-super-light)",
          success: "var(--discord-success)",
          warning: "var(--discord-warning)",
          danger: "var(--discord-danger)",
          info: "var(--discord-info)"
        }
      }
    },
  },
  plugins: [],
}; 