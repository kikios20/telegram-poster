import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-redirects',
      closeBundle() {
        const redirectsSrc = path.resolve(__dirname, '../_redirects')
        const redirectsDist = path.resolve(__dirname, 'dist/_redirects')
        if (existsSync(redirectsSrc)) {
          copyFileSync(redirectsSrc, redirectsDist)
        }
      }
    }
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'https://telegram-poster-api.onrender.com')
  }
})
