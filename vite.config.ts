import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// The game's stylesheets (src/styles/game.ts) stay off the first page, but a
// visitor who presses Play should not then wait on them: the first page asks
// for them a few seconds after it has loaded, when the browser is idle. Not a
// <link> in the head: the browser starts one of those straight away, and on a
// slow connection it took bandwidth from the first page's own paint. Nor on
// `load` alone, which fires before React has drawn the page.
const prefetchGameCss = (): Plugin => ({
  name: 'prefetch-game-css',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      const css = Object.keys(ctx.bundle ?? {}).find((f) => /^assets\/game-[\w-]+\.css$/.test(f))
      if (!css) throw new Error('prefetch-game-css: no assets/game-*.css in the build (was styles/game.ts renamed?)')
      const later = `addEventListener('load',function(){setTimeout(function(){(window.requestIdleCallback||setTimeout)(function(){var l=document.createElement('link');l.rel='prefetch';l.as='style';l.crossOrigin='';l.href='./${css}';document.head.appendChild(l)},{timeout:3000})},4000)})`
      return [{ tag: 'script', children: later, injectTo: 'head' }]
    },
  },
})

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
  plugins: [react(), prefetchGameCss()],
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
          // WharfKit's window has its own chunk: it is loaded only when a
          // wallet window is about to open (wharf/session.ts).
          if (id.includes('@wharfkit/web-renderer')) return 'wharf-ui'
          if (id.includes('@wharfkit') || id.includes('@greymass')) return 'wharf'
          if (id.includes('react-router')) return 'router'
          if (id.includes('react')) return 'react'
        },
      },
    },
  },
})
