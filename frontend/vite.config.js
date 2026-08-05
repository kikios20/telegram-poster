import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-redirects',
      closeBundle() {
        const redirectsSrc = path.resolve(__dirname, '../_redirects')
        const redirectsDist = path.resolve(__dirname, 'dist/_redirects')
        if (existsSync(redirectsSrc)) {
          // Ensure dist directory exists
          const distDir = path.dirname(redirectsDist)
          if (!existsSync(distDir)) {
            mkdirSync(distDir, { recursive: true })
          }
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
