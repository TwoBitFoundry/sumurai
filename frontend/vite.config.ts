import { defineConfig } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@tests': path.resolve(__dirname, 'tests'),
      '@docs': path.resolve(__dirname, '../docs'),
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
