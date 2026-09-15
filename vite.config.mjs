import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the built index.html loads assets via relative paths when
// served from file:// inside the packaged Electron app.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
