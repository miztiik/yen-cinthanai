import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { FLAGS_CACHE, FLAGS_GLOB_IGNORE, isLazyFlagUrl } from "./src/lib/pwa";

// Base path: '/' for local dev and preview; deploy sets GH_PAGES_BASE to the
// project path (e.g. '/yen-cinthanai/'). See docs/how-to/ship-to-github-pages.md.
const base = process.env.GH_PAGES_BASE ?? "/";

// SPA history fallback: dist/404.html must mirror the BUILT index.html (hashed
// asset tags + base), so deep links boot the app on GitHub Pages.
function spaFallback() {
  return {
    name: "spa-404-fallback",
    closeBundle() {
      const out = resolve(process.cwd(), "dist");
      copyFileSync(resolve(out, "index.html"), resolve(out, "404.html"));
    },
  };
}

// Offline PWA (vite-plugin-pwa). autoUpdate so a new day's bundle takes over on
// the next visit; precache the shell + today's bank; future days fall through to
// a NetworkFirst rule so a fresh manifest is fetched online but yesterday's save
// still loads from cache offline. start_url/scope stay relative (manifest: false
// keeps the static public/manifest.webmanifest). See docs/architecture/runtime/
// stack-and-bundle.md and docs/how-to/ship-to-github-pages.md.
function pwa() {
  return VitePWA({
    base,
    registerType: "autoUpdate",
    injectRegister: null,
    manifest: false,
    workbox: {
      globPatterns: ["**/*.{js,css,html,svg,json,webmanifest}"],
      // The 271 country flags are kept OUT of the shell precache (it would balloon); they are
      // fetched per file on demand via the CacheFirst "flags" rule below, then served offline.
      globIgnores: [FLAGS_GLOB_IGNORE],
      navigateFallback: `${base}404.html`,
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.pathname.endsWith(".json") && url.pathname.includes("/puzzles/"),
          handler: "NetworkFirst",
          options: {
            cacheName: "puzzles",
            expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          // Country flags: fetched per file on first render, cached, then served offline. A
          // country puzzle pulls only its N entities' flags, never all 271 (not precached).
          urlPattern: isLazyFlagUrl,
          handler: "CacheFirst",
          options: {
            cacheName: FLAGS_CACHE,
            expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
  });
}

export default defineConfig(({ mode }) => ({
  base,
  plugins: [svelte(), tailwindcss(), pwa(), spaFallback()],
  // Component render tests opt into jsdom per-file (`@vitest-environment jsdom`) and mount
  // Svelte; the browser condition makes a bare `svelte` import resolve to its client build
  // so mount/flushSync work (svelte.dev/docs/svelte/testing). Scoped to test mode - the
  // production build + dev resolution are untouched; node-env tests keep the default env.
  ...(mode === "test" ? { resolve: { conditions: ["browser"] } } : {}),
  test: {
    environment: "node",
    include: ["tests/**/*.{test,spec}.ts"],
  },
}));
