import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/message': 'http://localhost:8000',
      '/session': 'http://localhost:8000',
      '/stt': 'http://localhost:8000',
      '/tts': 'http://localhost:8000',
      '/screen': 'http://localhost:8000',
      '/cart': {
        target: 'http://localhost:8000',
        bypass: (req) => {
          if (req.headers.accept && req.headers.accept.includes('text/html')) {
            return '/index.html';
          }
        }
      },
      '/order': {
        target: 'http://localhost:8000',
        bypass: (req) => {
          if (req.headers.accept && req.headers.accept.includes('text/html')) {
            return '/index.html';
          }
        }
      }
    }
  }
})

