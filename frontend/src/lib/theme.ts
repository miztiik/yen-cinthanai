// Live theme + palette swap. Settings picks a PALETTE (hue family) and a THEME MODE
// (light | dark | system); this stamps data-theme/data-palette on <html> and writes
// the 8 colour tokens from config/palettes.json onto :root, so the chrome (which reads
// the tokens via Tailwind @theme in app.css) restyles instantly - colours only, never
// layout. "system" follows prefers-color-scheme and re-applies on OS change. Pure
// helpers are unit-tested; DOM writes are guarded for node tests, mirroring
// lib/motion.ts. See docs/concepts/ui-shell.md and config/palettes.toml.

import type { Palettes } from "./config";

export type ThemeMode = "light" | "dark" | "system";
export type Scheme = "light" | "dark";

/** Resolve a mode to a concrete scheme; "system" reads prefers-color-scheme. */
export function resolveScheme(mode: string, prefersDark?: boolean): Scheme {
  if (mode === "light" || mode === "dark") return mode;
  const dark = prefersDark ?? globalThis.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? true;
  return dark ? "dark" : "light";
}

/** Token map for a palette+scheme, falling back to the default palette; null when the
 *  config has no match (caller keeps the app.css bootstrap fallback). */
export function themeTokens(p: Palettes | null, paletteId: string, scheme: Scheme): Record<string, string> | null {
  if (!p) return null;
  const pal = p.palette[paletteId] ?? p.palette[p.default];
  return pal?.[scheme] ?? null;
}

let current: { p: Palettes | null; paletteId: string; mode: string } | null = null;
let watching = false;

/** Apply palette+mode: stamp data-theme/data-palette and write the token custom props
 *  onto :root. No-op without a document (node tests). */
export function applyTheme(p: Palettes | null, paletteId: string, mode: string): void {
  current = { p, paletteId, mode };
  const el = globalThis.document?.documentElement;
  if (!el) return;
  const scheme = resolveScheme(mode);
  el.dataset.theme = scheme;
  el.dataset.palette = paletteId;
  const tokens = themeTokens(p, paletteId, scheme);
  if (tokens) {
    const names = p?.tokens?.length ? p.tokens : Object.keys(tokens);
    for (const k of names) {
      const v = tokens[k];
      if (v) el.style.setProperty(`--${k}`, v);
    }
  }
  ensureSystemWatch();
}

/** Sync, config-free boot: stamp data-theme/data-palette from saved settings before the
 *  palette JSON loads, so the scheme (light/dark) is correct on the first paint. */
export function bootTheme(mode: string, paletteId: string): void {
  const el = globalThis.document?.documentElement;
  if (!el) return;
  el.dataset.theme = resolveScheme(mode);
  el.dataset.palette = paletteId;
}

/** Re-apply on OS scheme change while in "system" mode (registered once). */
function ensureSystemWatch(): void {
  if (watching) return;
  const mq = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
  if (!mq?.addEventListener) return;
  watching = true;
  mq.addEventListener("change", () => {
    if (current && current.mode === "system") applyTheme(current.p, current.paletteId, "system");
  });
}
