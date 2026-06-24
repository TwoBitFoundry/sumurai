/** @type {import('tailwindcss').Config} */
const categoryPillSafelist = [
  'bg-[color:color-mix(in_srgb,var(--category-accent)_22%,var(--color-surface-card))]',
  'dark:bg-[color:color-mix(in_srgb,var(--category-accent-bright)_28%,transparent)]',
  'border-[color:color-mix(in_srgb,var(--category-accent)_32%,var(--color-surface-card))]',
  'dark:border-transparent',
  '!border',
  '!border-[color:color-mix(in_srgb,var(--category-accent)_28%,var(--color-surface-card))]',
  'dark:!border-transparent',
  '!bg-[color:color-mix(in_srgb,var(--category-accent)_22%,var(--color-surface-card))]',
  'dark:!bg-[color:color-mix(in_srgb,var(--category-accent-bright)_28%,transparent)]',
  '!border-[var(--category-accent)]',
  '!bg-[color:color-mix(in_srgb,var(--category-accent)_30%,var(--color-surface-card))]',
  'dark:!bg-[color:color-mix(in_srgb,var(--category-accent-bright)_34%,transparent)]',
  'text-[var(--category-accent)]',
  'dark:text-[var(--category-accent-bright)]',
  'bg-[var(--category-accent)]',
  'dark:bg-[var(--category-accent-bright)]',
  'ring-[color:color-mix(in_srgb,var(--category-accent)_55%,var(--color-surface-card))]',
  'dark:ring-[color:color-mix(in_srgb,var(--category-accent-bright)_55%,transparent)]',
];

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
  safelist: categoryPillSafelist,
  plugins: [],
};
