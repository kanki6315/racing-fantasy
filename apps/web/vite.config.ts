import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In dev we proxy "/api/*" to the .NET API so the browser sees one origin (cookies + no CORS).
// In prod the client talks to VITE_API_BASE_URL directly (API configures CORS for that origin).
const API_TARGET = process.env.VITE_DEV_API_TARGET ?? 'http://localhost:5239'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Honor a harness-assigned port (e.g. a second dev server while 5173 is taken); default otherwise.
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
