/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    screens: {
      md: '768px',
      lg: '1024px',
      xxl: '1536px',
    },
  },
  plugins: [],
};
