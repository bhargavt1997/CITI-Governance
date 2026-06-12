import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // '/' for local dev and the single Docker image; set VITE_BASE=/CITI-Governance/ for GitHub Pages.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    // Allow access through dev tunnels (e.g. *.trycloudflare.com) for peer testing.
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
