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
          background: '#36393f', // Основной темный фон
          card: '#2f3136',      // Фон карточек/элементов
          input: '#202225',     // Фон полей ввода
          'button-primary': '#5865f2', // Основная кнопка (фиолетовая)
          'button-secondary': '#4f545c',// Вторичная кнопка (серая)
          'button-danger': '#ed4245',   // Кнопка опасности (красная)
          text: '#dcddde',         // Основной текст (светло-серый)
          'text-secondary': '#b9bbbe', // Вторичный текст (темнее серого)
          'text-muted': '#72767d',     // Приглушенный текст
          'text-link': '#00aff4',      // Ссылки (голубой)
          info: '#5865f2',        // Цвет информационных сообщений
          success: '#3ba55c',      // Цвет успеха (зеленый)
          warning: '#faa61a',      // Цвет предупреждения (оранжевый)
          danger: '#ed4245',       // Цвет опасности (красный)
          accent: '#5865f2',       // Акцентный цвет (фиолетовый)
          border: '#202225',       // Цвет границ
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
