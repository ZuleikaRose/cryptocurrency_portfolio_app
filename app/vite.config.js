import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The project's .env lives at the repo root. Vite only exposes VITE_* names to the
  // browser, so SUPABASE_SECRET_KEY and CRYPTORANK_API_KEY stay out of the bundle.
  envDir: '..',
})
