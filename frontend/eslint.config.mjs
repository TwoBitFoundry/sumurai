import tailwindLengthRule from './eslint-rules/tailwind-length.js'

export default [
  {
    ignores: ['dist', 'node_modules', '**/*.snap', 'scripts/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      custom: {
        rules: {
          'tailwind-length': tailwindLengthRule,
        },
      },
    },
    rules: {
      'custom/tailwind-length': [
        'warn',
        {
          maxUtilities: 5,
        },
      ],
    },
  },
]
