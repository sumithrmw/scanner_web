// vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/scanner_web/', // Required for GitHub Pages
  define: {
    // Ensure env vars are replaced at build time
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_KEY),
  },
})