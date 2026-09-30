import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the build works from any host path (Vercel, Netlify, GitHub Pages)
export default defineConfig({ plugins: [react()], base: './', build: { chunkSizeWarningLimit: 1000 } }) // data is bundled
