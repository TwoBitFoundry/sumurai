import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import nextPlugin from '@next/eslint-plugin-next'
import tailwindLengthRule from './eslint-rules/tailwind-length.mjs'

const nextCoreWebVitals = nextPlugin.configs['core-web-vitals'] ?? {}

export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'dist/**', 'build/**', 'coverage/**']
  },
  ...tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended
  ),
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest
      }
    },
    plugins: {
      '@next/next': nextPlugin,
      custom: {
        rules: {
          'tailwind-length': tailwindLengthRule
        }
      }
    },
    rules: {
      ...(nextCoreWebVitals.rules || {}),
      '@next/next/no-img-element': 'off',
      'custom/tailwind-length': ['warn', { maxUtilities: 5 }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    files: ['**/*.cjs', '**/*.config.js', '**/*.config.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      'no-undef': 'off'
    }
  }
]
