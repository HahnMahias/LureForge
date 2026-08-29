import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves this as a project site under /LureForge/, so built
  // asset URLs need that prefix — but the local dev server still serves
  // from the root, so this only applies to `vite build`.
  base: command === 'build' ? '/LureForge/' : '/',
  plugins: [react()],
}))
