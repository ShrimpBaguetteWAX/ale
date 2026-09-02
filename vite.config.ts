import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// GitHub Pages serves this from the repo's /docs folder.
//
// `base` is the repo name because this is a project page:
// shrimpbaguettewax.github.io/ale/. Leave it as '/' only if a custom domain
// is attached, where the app sits at the domain root instead.
//
// Routing is hash-based (see App.tsx), so Pages needs no 404.html fallback:
// every route is one document and the server never sees the path.
export default defineConfig({
  plugins: [react()],
  base: '/ale/',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    target: 'es2020',
    // Low-end devices: keep the initial parse small and split the wallet SDKs
    // out of the critical path.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@wharfkit') || id.includes('@greymass')) return 'wharf'
          if (id.includes('react-router')) return 'router'
          if (id.includes('react')) return 'react'
        },
      },
    },
  },
})
