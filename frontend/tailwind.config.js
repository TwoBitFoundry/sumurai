/** @type {import('tailwindcss').Config} */
const tokenBridge = require('./src/ui/tokens/tailwind-bridge');

module.exports = {
  content: ['./src/app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: tokenBridge.fontFamily,
      colors: tokenBridge.colors,
    },
  },
  plugins: [],
};
