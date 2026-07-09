// Contract: a deploy build emits an offline shell. After `npm run build`, dist
// must hold the service worker, the precache manifest, the static webmanifest,
// and the 404 fallback that mirrors index.html (SPA deep links on Pages). The
// suite skips when dist is absent so CI stays green before the build step.
// See docs/architecture/runtime/stack-and-bundle.md, docs/how-to/ship-to-github-pages.md.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const dist = resolve(here, "../../dist");
const has = existsSync(dist);

describe.skipIf(!has)("PWA build artifacts", () => {
  it("emits a service worker and precache manifest", () => {
    const files = readdirSync(dist);
    expect(files).toContain("sw.js");
    expect(files.some((f) => /^workbox-[0-9a-f]+\.js$/.test(f))).toBe(true);
  });

  it("ships the static webmanifest and 404 fallback", () => {
    expect(existsSync(resolve(dist, "manifest.webmanifest"))).toBe(true);
    expect(existsSync(resolve(dist, "404.html"))).toBe(true);
  });

  it("does not precache the growing puzzle archive; days + index are runtime-cached", () => {
    const sw = readFileSync(resolve(dist, "sw.js"), "utf8");
    // No dated day file is baked into the precache manifest - the archive grows unbounded and
    // must not bloat the install; a day is fetched + CacheFirst-cached on first play instead.
    expect(sw).not.toMatch(/puzzles\/\d{4}-\d{2}-\d{2}-[a-z]+\.json/);
    // The bank index is still referenced - by its NetworkFirst runtime route (kept fresh), not
    // the precache manifest - so the newest day + the full archive listing always appear.
    expect(sw).toMatch(/puzzles\/index\.json/);
  });

  it("404 mirrors index.html so deep links boot the app", () => {
    expect(readFileSync(resolve(dist, "404.html"), "utf8")).toBe(
      readFileSync(resolve(dist, "index.html"), "utf8"),
    );
  });

  it("does not precache the 271 country flags (they lazy-load on demand)", () => {
    const sw = readFileSync(resolve(dist, "sw.js"), "utf8");
    // no per-flag entry appears in the precache manifest ...
    expect(sw).not.toMatch(/glyphs\/flags\/[a-z-]+\.svg/);
    // ... but the CacheFirst runtime route for the flags dir is present
    expect(sw).toMatch(/assets\/glyphs\/flags\//);
  });
});
