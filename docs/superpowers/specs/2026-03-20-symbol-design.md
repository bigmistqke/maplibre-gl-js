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

**Worker tier** — verbatim MapLibre code (where possible) in isolated worker entry points. Tree-shaken at the bundle boundary (a map that doesn't import a symbol worker service pays nothing). Two separate entry points allow further granularity within the worker bundle.

**Main-thread tier** — a `SymbolPlugin` with a fluent `.extend()` accumulator. Each extension is a separate import. Only imported extensions enter the bundle.

---

## API

```ts
import { symbolPlugin }       from './layers/symbol/symbol-plugin'
import { GlyphExtension }     from './layers/symbol/glyph-extension'
import { SpriteExtension }    from './layers/symbol/sprite-extension'
import { CollisionExtension } from './layers/symbol/collision-extension'
import { LineExtension }      from './layers/symbol/line-extension'

// symbolPlugin() creates the worker service. The same instance is wired
// into addSource so the plugin holds a reference to it.
const symbols = symbolPlugin({ source: 'openmaptiles' })
  .extend(new GlyphExtension({ url: 'https://.../fonts/{fontstack}/{range}.pbf' }))
  .extend(new SpriteExtension({ url: 'https://.../sprite' }))
  .extend(new CollisionExtension())
  .extend(new LineExtension())  // upgrades workerService to SymbolLineWorkerService

map.addSource('openmaptiles', {
  type: 'vector',
  url: '...',
  tileService: symbols.workerService,  // plugin owns the service reference
})
map.addPlugin(symbols)
```

All `.extend()` calls must happen before `map.addPlugin()` is called. Extensions cannot be added dynamically after `onAdd` fires.

Without `LineExtension`, the `get_anchors` / `path_interpolator` / `clip_line` / `merge_lines` code never enters any bundle. Without `CollisionExtension`, the `CollisionIndex` and `Placement` classes are absent. Without symbols entirely, the worker entry points are never bundled.

---

## Shared Primitive: `StructArray`

A small (~60 line) runtime utility, new to maplibre-modular, that replaces MapLibre's code-generated `StructArray` machinery. It packs vertex data into a flat `ArrayBuffer` with a known stride — exactly what `gl.bufferData` needs — without any build-time codegen.

```ts
// src/modular/core/struct-array.ts

const SymbolLayout = defineStruct({
  x:       'int16',
  y:       'int16',
  offsetX: 'int16',
  offsetY: 'int16',
  texX:    'uint16',
  texY:    'uint16',
})

const arr = new StructArray(SymbolLayout)
arr.emplaceBack(100, 200, 0, 0, 32, 64)

gl.bufferData(gl.ARRAY_BUFFER, arr.arrayBuffer, gl.STATIC_DRAW)
```

`defineStruct` computes stride and per-field byte offsets from the type map at definition time. `StructArray` maintains a single `ArrayBuffer` with typed views (`Int16Array`, `Uint16Array`, `Float32Array`, etc.) and grows it geometrically on `emplaceBack`. Supported field types: `int8`, `uint8`, `int16`, `uint16`, `int32`, `uint32`, `float32`.

**Scope:** `src/modular/core/struct-array.ts` — a general utility, not symbol-specific. Existing layers (`FillLayer`, `LineLayer`) can migrate to it over time. Symbol uses it for all vertex buffers in the worker and on the main thread, replacing both `WorkerSymbolBucket`'s plain typed arrays and the `StructArray` machinery from MapLibre's `array_types.g.ts`.

---

## Worker Tier

### Two worker entry points

`performSymbolLayout` in MapLibre's `symbol_layout.ts` is a monolith. The line placement code (`getAnchors`, `getCenterAnchor`, `path_interpolator`, `check_max_angle`, `clip_line`, `merge_lines`) is called conditionally at runtime based on `symbol-placement`, but is statically imported — bundlers include all statically-imported modules regardless of runtime branches.

To achieve actual tree-shaking of line machinery, we do **not** copy `symbol_layout.ts` verbatim as a single file. Instead we write two thin entry functions and extract the shared helpers into `vendor/symbol_layout_helpers.ts`:

- `performSymbolLayoutPoint` — handles only `symbol-placement: 'point'` features. Does not import `path_interpolator`, `check_max_angle`, `clip_line`, `merge_lines`.
- `performSymbolLayoutLine` — handles all placement types. Imports the full set.

`vendor/symbol_layout_helpers.ts` contains the shared internals extracted from MapLibre's `symbol_layout.ts`: `getAnchorJustification`, `getIconQuads`, `getGlyphQuads`, `addFeature`, `addSymbol`, and related helpers. Both layout entry functions and the vendored `placement.ts` import from this file. This is the one structural departure from verbatim copy — the function is split, not modified.

### Worker-internal bucket representation

During layout, the worker needs mutable vertex accumulators. These are `StructArray` instances (using our new `src/modular/core/struct-array.ts` utility) with layouts matching MapLibre's vertex formats:

```ts
const TextLayout = defineStruct({ x: 'int16', y: 'int16', offsetX: 'int16', offsetY: 'int16', texX: 'uint16', texY: 'uint16' })
const IconLayout = defineStruct({ ... })

type WorkerSymbolBucket = {
  textVertices:    StructArray<typeof TextLayout>
  textIndices:     Uint16Array
  iconVertices:    StructArray<typeof IconLayout>
  iconIndices:     Uint16Array
  symbolInstances: StructArray<typeof SymbolInstanceLayout>
  collisionBoxes:  StructArray<typeof CollisionBoxLayout>
}
```

On completion, `arrayBuffer` from each `StructArray` is transferred zero-copy to the main thread as `SymbolTileData`. MapLibre's `array_types.g.ts` code-generation machinery is not used.

### `symbol-worker-point.ts`

Imports: `performSymbolLayoutPoint`, `shaping`, `quads`, `symbol_layout_helpers`, `symbol_size`, `anchor`, `collision_feature`, `one_em`, `opacity_state`.

Does **not** import: `path_interpolator`, `check_max_angle`, `clip_line`, `merge_lines`.

Used by: `SymbolPointWorkerService`.

### `symbol-worker-line.ts`

Imports everything in the point worker plus: `performSymbolLayoutLine`, `path_interpolator`, `check_max_angle`, `clip_line`, `merge_lines`.

Used by: `SymbolLineWorkerService`.

### Worker class interface (Comlink)

Each worker exposes a class via `Comlink.expose`:

```ts
class SymbolWorker {
  // Called once at load and whenever new ranges arrive
  updateGlyphs(glyphMap: GlyphMap): void
  updateImages(imageMap: ImageMap): void

  // Fetches tile, runs layout, serialises bucket
  // Returns null on cancel or if the tile is queued pending glyph load
  request(key: string, url: string, layers: SymbolLayerSpec[]): Promise<SymbolTileData | null>
  cancel(key: string): void
}
```

`SymbolLayerSpec` is a plain-object summary of symbol layer paint/layout properties, constructed on the main thread and sent to the worker at request time (not at construction time, to allow the layer list to change).

### Glyph and image availability

A tile arriving before its glyph ranges have loaded is placed in a **pending queue** on the worker. When `updateGlyphs()` delivers the needed range, the worker retries queued tiles. This mirrors MapLibre's `WorkerTile` pending mechanism. `updateImages()` follows the same pattern for sprite data.

### Worker service as side-channel

`SymbolWorkerService` caches the latest `SymbolTileData` for each tile key in a `Map<string, SymbolTileData>`. `SymbolPlugin` accesses this via `workerService.getBucket(key)` — the data flows outside `TileManager`. `TileManager` continues returning raw PBF bytes as `transferables[0]` for fill/line layers. No changes to `TileManager` or the `TileService` interface.

### Subdivision / globe dependency

`symbol_layout.ts` in MapLibre imports `subdivideVertexLine` for globe rendering. The two layout entry functions we write omit this call. Out of scope for Phase 1.

### RTL stubs

Two live runtime imports in vendored files need no-op stubs for Phase 1:

- `transform_text.ts` — vendored as a no-op (returns input string unchanged)
- `vendor/rtl_text_plugin_worker_stub.ts` — a no-op stub satisfying the import in `shaping.ts` line 307 (`rtlWorkerPlugin`)

---

## Main-Thread Tier

### `SymbolPlugin<C extends Capabilities>`

Created by `symbolPlugin(opts)`. Owns:

- `workerService` — the `SymbolWorkerService` instance (default: `SymbolPointWorkerService`; upgraded to `SymbolLineWorkerService` when `LineExtension` is added). Exposed as a public property so the caller can pass it to `addSource`.
- `_extensions: SymbolExtension[]` — populated by `.extend()` calls before `onAdd`
- A `RenderExtension` registered on the renderer, using the existing `beforeTiles` hook for per-frame placement work

No conditionals internally. The plugin calls each extension's hooks unconditionally in registration order.

```ts
interface SymbolExtension {
  onAdd?(plugin: SymbolPlugin<any>, renderer: RendererAPI): void
  onTileLoad?(key: string, data: SymbolTileData): void
  beforeTiles?(ctx: RenderContext): void
  onDraw?(ctx: SymbolDrawContext): void
  onDestroy?(): void
}
```

### `.extend<E>(ext: E): SymbolPlugin<C & E['provides']>`

Returns `this` with an updated type. Registers the extension. If the extension declares `workerServiceClass`, upgrades `this.workerService`. Must be called before `map.addPlugin()`.

### Extensions

#### `GlyphExtension`
Owns glyph loading (PBF glyph ranges → SDF bitmaps), the glyph atlas texture, and atlas packing. Verbatim port of MapLibre's `GlyphManager`. On each new glyph range load, calls `workerService.updateGlyphs()` to unblock pending tiles.

**Provides:** `GlyphCapability`

#### `SpriteExtension`
Fetches `sprite.json` + `sprite.png`, packs into an image atlas texture. Verbatim port of MapLibre's `load_sprite` + `ImageManager`. Calls `workerService.updateImages()` on load.

**Provides:** `SpriteCapability`

#### `CollisionExtension`
Owns the `CollisionIndex` (spatial grid) and a purpose-built `SymbolPlacement` adapter class. `SymbolPlacement` is adapted (not verbatim) from MapLibre's `placement.ts` — the adaptation replaces `tile.getBucket(layer)` with `workerService.getBucket(key)`, accepting `SymbolTileData` instead of MapLibre's `Tile + SymbolBucket`.

Per-frame via `beforeTiles`: runs placement for each loaded tile, produces per-symbol visibility, writes opacity to a CPU-side array. On draw, the opacity data is uploaded to the `opacityVertexBuffer`.

`CollisionIndex` is adapted (not verbatim) to remove static imports of `clip_line` and `path_interpolator`. The line-label path interpolation in `CollisionIndex` is extracted into a separate `collision_index_line.ts` that is imported only from `symbol-worker-line.ts`. The base `CollisionIndex` handles point collision only.

**Provides:** `CollisionCapability`

Without this extension, all symbols render at full opacity unconditionally.

#### `LineExtension`
Before `onAdd`: sets `workerService = new SymbolLineWorkerService()`, upgrading the worker entry point. No main-thread runtime behaviour beyond the upgrade.

**Provides:** `LineCapability`

---

## File Structure

```
src/modular/layers/symbol/
  symbol-plugin.ts                     ← SymbolPlugin class + symbolPlugin() factory
  symbol-extension.ts                  ← SymbolExtension interface + Capabilities types
  symbol-draw.ts                       ← draw() — binds buffers, uniforms, gl.drawElements
  glyph-extension.ts                   ← GlyphExtension
  sprite-extension.ts                  ← SpriteExtension
  collision-extension.ts               ← CollisionExtension + SymbolPlacement adapter
  line-extension.ts                    ← LineExtension (worker upgrade only)

  worker-point/
    symbol-layout-point.ts             ← point-only layout (no line imports)
    symbol-worker-point.ts             ← worker entry point
    symbol-point-worker-service.ts     ← Comlink wrapper + getBucket() side-channel

  worker-line/
    symbol-layout-line.ts              ← full layout (includes line imports)
    symbol-worker-line.ts              ← worker entry point
    symbol-line-worker-service.ts      ← Comlink wrapper + getBucket() side-channel

  vendor/                              ← verbatim or near-verbatim from MapLibre src/symbol/
    symbol_layout_helpers.ts           ← extracted shared helpers (getAnchorJustification, etc.)
    shaping.ts
    quads.ts
    symbol_size.ts
    collision_feature.ts
    collision_index.ts                 ← adapted: static clip_line/path_interpolator imports removed
    collision_index_line.ts            ← line-specific collision path (imported by worker-line only)
    placement.ts                       ← adapted: Tile.getBucket() → SymbolTileData lookup
    grid_index.ts
    anchor.ts
    get_anchors.ts
    one_em.ts
    opacity_state.ts
    transform_text.ts                  ← no-op stub
    rtl_text_plugin_worker_stub.ts     ← no-op stub (satisfies shaping.ts import)
    path_interpolator.ts               ← line worker only
    check_max_angle.ts                 ← line worker only
    clip_line.ts                       ← line worker only
    merge_lines.ts                     ← line worker only

  shaders/
    symbol_sdf.vertex.glsl             ← verbatim from MapLibre
    symbol_sdf.fragment.glsl
    symbol_icon.vertex.glsl
    symbol_icon.fragment.glsl
```

---

## What is verbatim vs adapted

| File | Verbatim? | Reason for adaptation |
|---|---|---|
| `shaping.ts` | Yes | — |
| `quads.ts` | Yes | — |
| `symbol_size.ts` | Yes | — |
| `collision_feature.ts` | Yes | — |
| `grid_index.ts` | Yes | — |
| `anchor.ts` | Yes | — |
| `get_anchors.ts` | Yes | — |
| `one_em.ts` | Yes | — |
| `opacity_state.ts` | Yes | — |
| `path_interpolator.ts` | Yes | — |
| `check_max_angle.ts` | Yes | — |
| `clip_line.ts` | Yes | — |
| `merge_lines.ts` | Yes | — |
| `symbol_layout_helpers.ts` | Near-verbatim | Extracted from `symbol_layout.ts`; not a new file in MapLibre |
| `collision_index.ts` | Adapted | Remove static `clip_line`/`path_interpolator` imports |
| `placement.ts` | Adapted | Replace `Tile.getBucket()` with `SymbolTileData` lookup |
| `transform_text.ts` | Stub | RTL out of scope |
| `rtl_text_plugin_worker_stub.ts` | Stub | RTL out of scope |

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
- RTL text plugin (transform_text and rtlWorkerPlugin stubbed as no-ops)
- Vertical text (CJK)
- `text-writing-mode`
- Collision debug visualisation
- Globe subdivision for symbol geometry
- `symbol_text_and_icon` shader (combined text + inline icons)
