import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// GitHub Pages serves this from the repo's /docs folder.
//
// `base` is './' so the built site works wherever it is served from. It has
// been served from three shapes of URL already — a project page under the
// repo name, a custom domain at its own root, and now the production
// artifacts repository under /ale-live/ — and an absolute base is wrong for
// two of the three. Asking for /assets/* on a host that only has
// /ale-live/assets/* 404s every request, and the page never starts.
//
// Relative paths cost nothing here: routing is hash-based, so index.html is
// the only document ever served and everything it asks for sits beside it.
//
// The CNAME in public/ is what keeps the domain attached. `emptyOutDir`
// wipes docs/ on every build, including the CNAME file Pages writes there
// itself, so it has to be reissued from public/ each time.
//
// Routing is hash-based (see App.tsx), so Pages needs no 404.html fallback:
// every route is one document and the server never sees the path.
export default defineConfig({
  plugins: [react()],
  base: './',
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
