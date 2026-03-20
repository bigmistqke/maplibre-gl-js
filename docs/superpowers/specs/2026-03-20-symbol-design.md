# Symbol Layer Design

**Date:** 2026-03-20
**Project:** maplibre-modular (`src/modular/`)
**Status:** Approved for implementation planning

---

## Goal

Add symbol layer support (text labels + icon sprites) to maplibre-modular. Copy as much code verbatim from MapLibre GL JS as possible. Zero symbol code in the core bundle when symbols are unused — tree-shaking applies at every level: main-thread plugin, extensions, and worker entry points.

---

## Architecture Overview

Symbol rendering splits across two tiers with different tree-shaking strategies:

**Worker tier** — verbatim MapLibre code in isolated worker entry points. Tree-shaken at the bundle boundary (a map that doesn't import a symbol worker service pays nothing). Two separate entry points allow further granularity.

**Main-thread tier** — a `SymbolPlugin` with a fluent `.extend()` accumulator. Each extension is a separate import. Only imported extensions enter the bundle.

---

## API

```ts
import { SymbolPlugin }       from './layers/symbol/symbol-plugin'
import { GlyphExtension }     from './layers/symbol/glyph-extension'
import { SpriteExtension }    from './layers/symbol/sprite-extension'
import { CollisionExtension } from './layers/symbol/collision-extension'
import { LineExtension }      from './layers/symbol/line-extension'

map.addPlugin(
  symbolPlugin({ source: 'openmaptiles' })
    .extend(new GlyphExtension({ url: 'https://.../fonts/{fontstack}/{range}.pbf' }))
    .extend(new SpriteExtension({ url: 'https://.../sprite' }))
    .extend(new CollisionExtension())
    .extend(new LineExtension())       // also upgrades worker to SymbolLineWorkerService
)
```

Without `LineExtension`, the `get_anchors` / `path_interpolator` / `clip_line` / `merge_lines` code never enters any bundle. Without `CollisionExtension`, the `CollisionIndex` and `Placement` classes are absent. Without symbols entirely, the worker entry points are never bundled.

---

## Worker Tier

### Why two worker entry points

`performSymbolLayout` (verbatim MapLibre) is a monolith — collision boxes are always computed, but line anchor code (`getAnchors`, `getCenterAnchor`, `path_interpolator`, `check_max_angle`, `clip_line`, `merge_lines`) is only called when `symbol-placement` is `'line'` or `'line-center'`. To tree-shake the line machinery out, two separate entry points are needed.

### `symbol-worker-point.ts`

Imports: `performSymbolLayout`, `shaping`, `quads`, `symbol_size`, `anchor`, `get_anchors` (point-only path), `one_em`, `opacity_state`.

Does **not** import: `path_interpolator`, `check_max_angle`, `clip_line`, `merge_lines`.

Used by: `SymbolPointWorkerService`.

### `symbol-worker-line.ts`

Imports everything in the point worker plus: `path_interpolator`, `check_max_angle`, `clip_line`, `merge_lines`.

Used by: `SymbolLineWorkerService`.

### Worker service interface

Both worker services implement the existing `TileService` interface but return a richer payload — the current `Transferable[]` single-item response extends to carry both raw PBF bytes (for fill/line layers on the same source) and the serialised symbol bucket:

```ts
// returns [pbfBytes: ArrayBuffer, symbolBucketData: ArrayBuffer | null]
request(tileID: TileID, url: string): Promise<Transferable[]>
```

One source → one worker. The symbol worker **replaces** (not augments) the vector worker for sources that have symbol layers.

### Glyph + image data flow to worker

`performSymbolLayout` requires glyph SDF bitmaps and sprite image metadata. These are fetched on the main thread (by `GlyphExtension` and `SpriteExtension`) and sent to the worker via `postMessage` before layout runs. The worker caches them; main thread sends updates when new glyph ranges load.

---

## Main-Thread Tier

### `SymbolPlugin<C extends Capabilities>`

A thin orchestrator. Owns:
- The worker service instance (default: `SymbolPointWorkerService`, upgradeable by `LineExtension`)
- An ordered `_extensions: SymbolExtension[]` array
- A `RenderExtension` hook registered on the renderer for per-frame work

No conditionals internally. The plugin calls each extension's hooks unconditionally in registration order.

```ts
interface SymbolExtension {
  onAdd?(plugin: SymbolPlugin<any>, renderer: RendererAPI): void
  onTileLoad?(bucket: SymbolBucket): void
  beforeFrame?(camera: CameraState): void
  onDraw?(ctx: SymbolDrawContext): void
  onDestroy?(): void
}
```

### `.extend<E>(ext: E): SymbolPlugin<C & E['provides']>`

Returns a new plugin type accumulating capabilities. TypeScript enforces capability presence at compile time. The worker service is upgraded if the extension declares `workerServiceClass`.

### Extensions

#### `GlyphExtension`
Owns glyph loading (PBF glyph ranges → SDF bitmaps), the glyph atlas texture, and atlas packing. Verbatim port of MapLibre's `GlyphManager`. Sends decoded glyphs to the worker when ranges load.

**Provides:** `GlyphCapability` (glyph atlas available to draw)

#### `SpriteExtension`
Fetches `sprite.json` + `sprite.png`, packs into an image atlas texture. Verbatim port of MapLibre's `ImageManager` / `load_sprite`. Sends image metadata to the worker.

**Provides:** `SpriteCapability` (icon atlas available to draw)

#### `CollisionExtension`
Owns: `CollisionIndex` (spatial grid), `Placement` class, and `opacityVertexBuffer` updates.

Per-frame (via `beforeFrame` hook): runs `Placement.placeLayerBucketPart` for each loaded tile, writes opacity to `opacityVertexBuffer`, handles fade-in/fade-out animation. All verbatim from MapLibre's placement pipeline.

**Provides:** `CollisionCapability` (symbols respect overlap, animate in/out)

Without this extension, all symbols render at full opacity unconditionally.

#### `LineExtension`
Registers `workerServiceClass = SymbolLineWorkerService`, upgrading the worker entry point at plugin construction time. No main-thread runtime code beyond the upgrade — the line anchor computation happens in the worker.

**Provides:** `LineCapability` (symbols follow line geometry)

---

## File Structure

```
src/modular/layers/symbol/
  symbol-plugin.ts              ← SymbolPlugin class + symbolPlugin() factory
  symbol-extension.ts           ← SymbolExtension interface + Capabilities types
  symbol-bucket.ts              ← SymbolBucket type (serialisable worker output)
  symbol-draw.ts                ← draw() — binds buffers, sets uniforms, gl.drawElements
  glyph-extension.ts            ← GlyphExtension (verbatim GlyphManager port)
  sprite-extension.ts           ← SpriteExtension (verbatim ImageManager/load_sprite port)
  collision-extension.ts        ← CollisionExtension (verbatim Placement port)
  line-extension.ts             ← LineExtension (worker upgrade only)
  worker-point/
    symbol-worker-point.ts      ← worker entry point (no line machinery)
    symbol-point-worker-service.ts
  worker-line/
    symbol-worker-line.ts       ← worker entry point (full)
    symbol-line-worker-service.ts

src/modular/layers/symbol/vendor/  ← verbatim copies from MapLibre src/symbol/
  shaping.ts
  quads.ts
  symbol_layout.ts
  symbol_size.ts
  collision_index.ts
  placement.ts
  grid_index.ts
  anchor.ts
  get_anchors.ts
  one_em.ts
  opacity_state.ts
  path_interpolator.ts          ← line worker only
  check_max_angle.ts            ← line worker only
  clip_line.ts                  ← line worker only
  merge_lines.ts                ← line worker only
```

Shaders (`symbol_sdf`, `symbol_icon`) copied verbatim from `src/shaders/`.

---

## Tree-shaking Summary

| Configuration | Worker bundle | Main bundle extras |
|---|---|---|
| No symbols | — | — |
| Point labels, no collision | `symbol-worker-point.ts` | `GlyphExtension` |
| Point labels + collision | `symbol-worker-point.ts` | `GlyphExtension`, `CollisionExtension` |
| Point + line, full | `symbol-worker-line.ts` | all four extensions |
| Icons only | `symbol-worker-point.ts` | `SpriteExtension` |

---

## Out of Scope (Phase 1)

- Cross-tile symbol index
- Variable anchors
- RTL text plugin
- Vertical text (CJK)
- `text-writing-mode`
- Collision debug visualisation
