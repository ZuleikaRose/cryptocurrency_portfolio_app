import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Lists every built script and stylesheet in /precache.json, so the service worker can cache the
// pages and language chunks that load on demand, not only those index.html names (US-9.5).
const precacheList = () => ({
  name: 'cpa-precache-list',
  generateBundle(_, bundle) {
    const files = Object.keys(bundle).filter((file) => /\.(js|css)$/.test(file)).map((file) => `/${file}`).sort()
    this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(files) })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), precacheList()],
  // The project's .env lives at the repo root. Vite only exposes VITE_* names to the
  // browser, so SUPABASE_SECRET_KEY and CRYPTORANK_API_KEY stay out of the bundle.
  envDir: '..',
  build: {
    rolldownOptions: {
      output: {
        // Libraries change less often than the app, so they get their own long-cached chunks.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/, priority: 20 },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 15 },
          ],
        },
      },
    },
  },
})
