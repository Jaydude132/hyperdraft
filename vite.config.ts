import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset URLs, so the built app also loads from a file:// URL —
  // which is how the desktop shell opens it.
  base: './',
})
