import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        discord: {
          background: '#121212', // Настоящий темный фон
          card: '#1e1e1e',      // Карточки и elevated-поверхности
          input: '#2d2d2d',     // Поля ввода
          'button-primary': '#5865f2', // Основная кнопка (фиолетовая)
          'button-secondary': '#383838',// Вторичная кнопка (темно-серая)
          'button-danger': '#ed4245',   // Кнопка опасности (красная)
          text: '#e1e1e1',         // Основной текст (почти белый)
          'text-secondary': '#a8a8a8', // Вторичный текст
          'text-muted': '#717171',     // Приглушенный текст
          'text-link': '#00aff4',      // Ссылки (голубой)
          info: '#5865f2',        // Цвет информационных сообщений
          success: '#3ba55c',      // Цвет успеха (зеленый)
          warning: '#faa61a',      // Цвет предупреждения (оранжевый)
          danger: '#ed4245',       // Цвет опасности (красный)
          accent: '#5865f2',       // Акцентный цвет (фиолетовый)
          border: '#383838',       // Цвет границ для разделения
        }
        // background: "var(--background)", // Remove or keep if needed elsewhere
        // foreground: "var(--foreground)", // Remove or keep if needed elsewhere
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
