/// <reference types="node" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // needed inside Docker so HMR binds to 0.0.0.0
    port: 5173,
    strictPort: true,
    // Optional for file watching in containers (you already set CHOKIDAR_USEPOLLING=true):
    watch: { usePolling: true },
    // Proxy API calls to the Django container named "web"
    proxy: {
      '/api': {
        target: 'http://web:8000',   // <— points to the Django service
        changeOrigin: true,
      },
    },
    // (Optional) if HMR websocket needs an explicit client port when accessed from host
    // hmr: { clientPort: 5173 },
  },
})
