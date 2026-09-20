import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const yahooProxy = {
  '/market/yahoo': {
    target: 'https://query1.finance.yahoo.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/market\/yahoo/, ''),
    headers: {
      'user-agent': 'Mozilla/5.0',
      accept: 'application/json',
    },
  },
}

const nseProxy = {
  '/market/nse': {
    target: 'https://nsearchives.nseindia.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/market\/nse/, ''),
    headers: {
      'user-agent': 'Mozilla/5.0',
      accept: 'text/csv',
    },
  },
}

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  optimizeDeps: { entries: ['index.html'] },
  server: {
    host: '127.0.0.1',
    port: 5181,
    strictPort: true,
    proxy: { ...yahooProxy, ...nseProxy },
    watch: { ignored: ['**/.chrome-firebase-profile/**'] },
  },
  preview: { proxy: { ...yahooProxy, ...nseProxy } },
  test: {
    environment: 'happy-dom',
  },
})
