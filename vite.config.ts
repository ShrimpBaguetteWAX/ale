import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// GitHub Pages serves this from the repo's /docs folder.
//
// `base` is '/' because a custom domain is attached. Pages puts a project
// page under the repo name — shrimpbaguettewax.github.io/ale/ — but a custom
// domain serves that same folder at its own root, so every asset path loses
// the /ale/ prefix. That URL now 301s to new.alienlegends.io, and building
// with the old base left the site asking for /ale/assets/* on a host that
// only has /assets/*: every request 404d and the page never started.
//
// The CNAME in public/ is what keeps the domain attached. `emptyOutDir`
// wipes docs/ on every build, including the CNAME file Pages writes there
// itself, so it has to be reissued from public/ each time.
//
// Routing is hash-based (see App.tsx), so Pages needs no 404.html fallback:
// every route is one document and the server never sees the path.
export default defineConfig({
  plugins: [react()],
  base: '/',
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
