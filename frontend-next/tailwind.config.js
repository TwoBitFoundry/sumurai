/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Mr Eaves XL Mod', 'system-ui', 'sans-serif'],
        heading: ['Cal Sans', 'system-ui', 'sans-serif'],
        subheading: ['Mr Eaves XL Mod', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          900: '#0c4a6e',
        },
        surface: {
          light: '#ffffff',
          'light-secondary': '#f8fafc',
          dark: '#0f172a',
          'dark-secondary': '#1e293b',
        },
        chart: {
          light: {
            primary: '#0ea5e9',
            secondary: '#10b981',
            accent: '#f59e0b',
            warning: '#ef4444',
            info: '#8b5cf6',
            success: '#059669',
          },
          dark: {
            primary: '#38bdf8',
            secondary: '#34d399',
            accent: '#fbbf24',
            warning: '#f87171',
            info: '#a78bfa',
            success: '#10b981',
          },
        },
      },
    },
  },
  plugins: [],
};
