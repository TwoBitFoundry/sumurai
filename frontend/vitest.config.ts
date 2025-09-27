/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@tests': path.resolve(__dirname, 'tests'),
      '@docs': path.resolve(__dirname, '../docs'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./tests/setup/setup.ts'],
    testTimeout: 5000,
    hookTimeout: 3000,
    teardownTimeout: 3000,
    reporters: ['default'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
      },
    },
    // Add React testing environment configuration
    environmentOptions: {
      jsdom: {
        resources: 'usable',
      },
    },
    // Better test isolation
    sequence: {
      shuffle: false,
    },
    // Clear mocks between tests
    clearMocks: true,
    restoreMocks: true,
  },
})
