// Lazy-flag PWA policy, extracted from vite.config.ts so the "country flags are fetched per
// file, never precached" contract is unit-testable without a full build (see
// tests/contract/pwa-lazy.test.ts). The 271-flag pack would balloon the shell precache, so
// it is excluded from the precache glob and served CacheFirst on demand instead: a country
// puzzle with N entities pulls only its N flags, never all 271. The built service worker is
// smoke-checked separately in tests/contract/pwa.test.ts.
// See docs/architecture/runtime/stack-and-bundle.md.

/** Precache glob-ignore: keep the 271 country flags OUT of the shell precache manifest. */
export const FLAGS_GLOB_IGNORE = "**/assets/glyphs/flags/**";

/** Runtime cache name for on-demand flags. */
export const FLAGS_CACHE = "flags";

/** True for a country-flag SVG request: routed CacheFirst (fetched once, then offline). */
export function isLazyFlagUrl({ url }: { url: URL }): boolean {
  return url.pathname.includes("/assets/glyphs/flags/") && url.pathname.endsWith(".svg");
}
