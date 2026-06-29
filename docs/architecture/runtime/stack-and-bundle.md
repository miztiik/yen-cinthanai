# Stack and Bundle

**Last Updated**: 2026-06-29

Runtime stack, drag, offline, repo tree. Richness-first: no fixed byte cap; optimize only if a mid-tier Android drops below 60fps / input-to-photon 50ms (CLAUDE.md Holy Law #2).

## Pins

node 22 | vite 6.3 | svelte 5 | typescript 5.8 | tailwindcss 4 (+@tailwindcss/vite) | vitest 3 | @playwright/test 1.4x. 2D DOM grid - no renderer, physics, or drag library.

## Drag (native pointer)

pointerdown -> setPointerCapture -> transform translate3d follow (compositor-only) -> pointerup -> nearest-slot snap. Tap-select fallback. transform+opacity only, never top/left.

## Offline (vite-plugin-pwa 1.3)

autoUpdate; base /yen-cinthanai/; precache shell + today; runtimeCaching NetworkFirst for /puzzles/*.json; navigateFallback 404.html; manifest start_url/scope relative. New day = NetworkFirst then Cache API. Yesterday's save always loads.

## Repo tree (P0-P3)

```
config/  tiers shapes glyphpacks copy budgets retention dials .toml        build
tools/   generator solver uniqueness prune templates emit models bake      build
public/  assets/glyphs/{household,creatures,abstract}/*.svg + index.json    runtime
public/  index.html 404.html manifest.webmanifest config/*.json puzzles/*   runtime
src/     main.ts App.svelte lib/glyphs.ts Glyph.svelte state/ contracts/    runtime
tests/   fixtures unit contract integration e2e
```
Modules created when code lands, not pre-stubbed.

## Glyphs (centralized assets, no inline SVG)

All SVG/icons live under `public/assets/glyphs/<pack>/*.svg`, indexed by `glyphs/index.json` (ref -> POSIX path). `config/glyphpacks.toml` carries labels only. `lib/glyphs.ts::glyphPath` resolves "pack.id" to a base-aware URL; `Glyph.svelte` is the sole renderer. No bytes are inlined into components (CLAUDE.md #6, #10).

## Responsiveness gates (P3)

4x CPU + Slow 4G; input-to-photon <50ms; 60fps; first-interaction <2s; zero new error/404. No byte cap.

## See also
- [../contracts/schemas.md](../contracts/schemas.md) - runtime readers.
- [../generator/pipeline.md](../generator/pipeline.md) - bank input.
- [../../concepts/ui-shell.md](../../concepts/ui-shell.md) - components.
