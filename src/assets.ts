/**
 * A URL for a file in `public/`.
 *
 * Vite rewrites asset references it can see at build time — imports, the ones
 * in `index.html`, `url()` in stylesheets — but a path written as a string in
 * code is opaque to it. Those stayed root-absolute, which is correct only when
 * the app is served from the root of a domain. Under a project page like
 * `shrimpbaguettewax.github.io/ale/` every one of them resolved a level too
 * high and 404'd, taking the logo, the map textures, the fighter art and every
 * icon with them.
 *
 * `BASE_URL` is whatever `base` in `vite.config.ts` says, with a trailing
 * slash, and it is `/` in dev — so this is a no-op locally and correct
 * wherever the build is hosted.
 */
export function asset(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\/+/, '')
}
