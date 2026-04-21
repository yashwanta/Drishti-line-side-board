import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config for MES Line Side Board
// In dev mode: proxies /api/* → Go gateway on port 3001
// In production: serve the built dist/ as static files from the Go server itself
//   (or behind nginx on port 80)

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: '../backend-go/static',   // Go will serve this in production
    emptyOutDir: true,
  }
})
