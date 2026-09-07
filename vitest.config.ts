import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/**
 * Separate from `vite.config.ts` on purpose: the build config carries a
 * `docs/` output dir, a manual chunk splitter and a `base` that exist for
 * GitHub Pages and have nothing to say about tests.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    /* Screens read the chain through the real client, which retries across
       endpoints before it gives up. The default 5s is not enough for a route
       that makes several reads in sequence. */
    testTimeout: 20_000,
  },
})
