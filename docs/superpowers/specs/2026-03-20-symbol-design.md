# Symbol Layer Design

**Date:** 2026-03-20
**Project:** maplibre-modular (`src/modular/`)
**Status:** Approved for implementation planning

---

## Goal

Add symbol rendering (text labels + icon sprites) to maplibre-modular. Copy as much code verbatim from MapLibre GL JS as possible. Zero symbol code in the core bundle when unused — tree-shaking applies at every level.

---

## Design Principles

Symbol is not one feature — it is several distinct, composable concerns:

| Concern | Kind | Why separate |
|---|---|---|
| Glyph loading | Resource provider | Useful beyond text labels; no map lifecycle needed |
| Image/sprite loading | Resource provider | Useful beyond icons; no map lifecycle needed |
| Text rendering | Layer | Own worker; own shader |
| Icon rendering | Layer | Own worker (simpler); own shader |
| Line text rendering | Layer | Larger worker (line machinery); same shader as text |
| Collision / placement | Behavior | Cross-layer, per-frame; plugin only for render hook |

Each is a separate import. Only imported pieces enter the bundle.

---

## API

```ts
import { GlyphManager }   from './layers/symbol/glyph-manager'
import { ImageManager }   from './layers/symbol/image-manager'
import { Placement }      from './layers/symbol/placement'
import { TextLayer }      from './layers/symbol/text-layer'
import { IconLayer }      from './layers/symbol/icon-layer'
import { LineTextLayer }  from './layers/symbol/line-text-layer'

const glyphs = new GlyphManager({ url: 'https://.../fonts/{fontstack}/{range}.pbf' })
const images = new ImageManager({ url: 'https://.../sprite' })

map.addPlugin(new Placement())   // hook only — discovers participating layers via map

map.addLayer(new TextLayer({ source: 'openmaptiles', glyphs }))
map.addLayer(new IconLayer({ source: 'openmaptiles', images }))
map.addLayer(new LineTextLayer({ source: 'openmaptiles', glyphs }))
```

`Placement` is the only `addPlugin` call — purely to get the `beforeTiles` render hook. Everything else is direct construction and layer registration.

---

## Components

### `GlyphManager`

Resource provider. Owns glyph loading (PBF font ranges → SDF bitmaps), atlas packing, and the glyph atlas `WebGLTexture`. Near-verbatim port of MapLibre's `GlyphManager`. Initialized lazily on first `TextLayer.onAdd()` — no map lifecycle of its own.

Pushes decoded glyph ranges to the worker via `workerService.updateGlyphs()` whenever a new range loads, unblocking any queued tiles.

---

### `ImageManager`

Resource provider. Fetches `sprite.json` + `sprite.png`, packs into an image atlas `WebGLTexture`. Near-verbatim port of MapLibre's `load_sprite` + `ImageManager`. Initialized lazily on first `IconLayer.onAdd()`.

Pushes image metadata to the worker via `workerService.updateImages()` on load.

---

### `Placement`

Behavioral coordinator. Added as a plugin solely for the `beforeTiles` render hook. On each frame it traverses `map.getLayers()`, duck-types for `PlacementParticipant`, and runs the `CollisionIndex` + placement algorithm over all participating layers. Owns the `CollisionIndex` (spatial grid) and the per-frame opacity state.

Does not import `TextLayer`, `IconLayer`, or `LineTextLayer` — it only imports the `PlacementParticipant` interface (a compile-time-only type, zero runtime cost).

Without `Placement`, symbol layers render all symbols at full opacity unconditionally.

---

### `PlacementParticipant` (shared interface)

```ts
// src/modular/core/placement-participant.ts  (~5 lines, erased at compile time)
export interface PlacementParticipant {
  getSymbolBuckets(): SymbolBucketData[]
  setOpacity(key: string, opacity: Float32Array): void
}
```

`TextLayer`, `IconLayer`, and `LineTextLayer` implement this interface structurally. `Placement` imports only this file — no coupling to any layer implementation.

---

### `TextLayer`

Regular layer. Owns `TextWorkerService` (point text worker). On `onAdd`: initializes `GlyphManager`, registers `Placement` if present (via duck-type check on `map.getLayers()`). Implements `PlacementParticipant`.

**Worker:** `symbol-worker-point.ts` — shaping + quad generation, no line machinery.

---

### `IconLayer`

Regular layer. Owns `IconWorkerService`. On `onAdd`: initializes `ImageManager`. Implements `PlacementParticipant`.

**Worker:** `symbol-worker-icon.ts` — sprite lookup + quad generation. Simpler than text (no shaping).

---

### `LineTextLayer`

Regular layer. Owns `LineTextWorkerService` (larger worker bundle). On `onAdd`: initializes `GlyphManager`. Implements `PlacementParticipant`.

**Worker:** `symbol-worker-line.ts` — full layout including `path_interpolator`, `get_anchors`, `check_max_angle`, `clip_line`, `merge_lines`.

---

## Worker Architecture

Each layer type has its own worker entry point. Workers are separate bundles — unused workers are never fetched or parsed.

```
symbol-worker-point.ts   ← TextLayer worker
  imports: shaping, quads, symbol_layout_helpers, symbol_size,
           anchor, collision_feature, one_em, opacity_state
  does NOT import: path_interpolator, check_max_angle, clip_line, merge_lines

symbol-worker-icon.ts    ← IconLayer worker
  imports: sprite lookup, quad generation (no shaping, no SDF)

symbol-worker-line.ts    ← LineTextLayer worker
  imports: everything in point worker +
           path_interpolator, check_max_angle, clip_line, merge_lines
```

### Why split `symbol_layout.ts`

MapLibre's `performSymbolLayout` statically imports line machinery — bundlers include all static imports regardless of runtime branches. To tree-shake line code out of the point worker, we write two thin entry functions sharing `vendor/symbol_layout_helpers.ts` (extracted shared internals). The line-specific imports only appear in `symbol-worker-line.ts`.

### Worker class interface (Comlink)

```ts
class SymbolWorker {
  updateGlyphs(glyphMap: GlyphMap): void
  updateImages(imageMap: ImageMap): void
  request(key: string, url: string, layers: SymbolLayerSpec[]): Promise<SymbolTileData | null>
  cancel(key: string): void
}
```

Tiles arriving before their glyph ranges are loaded are queued and retried when `updateGlyphs()` delivers the needed range.

### Side-channel for bucket data

Workers cache `SymbolTileData` per tile key. `TextLayer`/`IconLayer`/`LineTextLayer` retrieve it via `workerService.getBucket(key)` — outside `TileManager`. Raw PBF bytes continue to flow through `TileManager` unchanged for fill/line layers on the same source. No changes to `TileManager` or the `TileService` interface.

### `workerService` as source tile service

```ts
const textLayer = new TextLayer({ source: 'openmaptiles', glyphs })
map.addSource('openmaptiles', {
  type: 'vector',
  url: '...',
  tileService: textLayer.workerService,  // layer owns the service
})
```

---

## `StructArray` — Shared Primitive

A small (~60 line) runtime utility replacing MapLibre's code-generated `StructArray` machinery:

```ts
// src/modular/core/struct-array.ts
const TextVertexLayout = defineStruct({
  x: 'int16', y: 'int16', offsetX: 'int16', offsetY: 'int16',
  texX: 'uint16', texY: 'uint16',
})

const arr = new StructArray(TextVertexLayout)
arr.emplaceBack(100, 200, 0, 0, 32, 64)
gl.bufferData(gl.ARRAY_BUFFER, arr.arrayBuffer, gl.STATIC_DRAW)
```

`defineStruct` computes stride and byte offsets at definition time. `StructArray` grows a backing `ArrayBuffer` geometrically. Supported types: `int8`, `uint8`, `int16`, `uint16`, `int32`, `uint32`, `float32`.

Used by all three worker types for vertex accumulation. Not symbol-specific — `FillLayer` and `LineLayer` can migrate to it. MapLibre's `array_types.g.ts` code-generation is not used.

---

## Verbatim vs Adapted

| File | Status | Notes |
|---|---|---|
| `shaping.ts` | Verbatim | — |
| `quads.ts` | Verbatim | — |
| `symbol_size.ts` | Verbatim | — |
| `collision_feature.ts` | Verbatim | — |
| `grid_index.ts` | Verbatim | — |
| `anchor.ts` | Verbatim | — |
| `get_anchors.ts` | Verbatim | — |
| `one_em.ts` | Verbatim | — |
| `opacity_state.ts` | Verbatim | — |
| `path_interpolator.ts` | Verbatim | line worker only |
| `check_max_angle.ts` | Verbatim | line worker only |
| `clip_line.ts` | Verbatim | line worker only |
| `merge_lines.ts` | Verbatim | line worker only |
| `symbol_layout_helpers.ts` | Near-verbatim | Extracted from `symbol_layout.ts` |
| `collision_index.ts` | Adapted | Remove static `clip_line`/`path_interpolator` imports |
| `placement.ts` | Adapted | Replace `Tile.getBucket()` with `SymbolTileData` lookup |
| `transform_text.ts` | Stub | RTL out of scope |
| `rtl_text_plugin_worker_stub.ts` | Stub | Satisfies `shaping.ts` import |

---

## File Structure

```
src/modular/core/
  struct-array.ts                      ← shared primitive
  placement-participant.ts             ← shared interface (compile-time only)

src/modular/layers/symbol/
  glyph-manager.ts                     ← GlyphManager (resource)
  image-manager.ts                     ← ImageManager (resource)
  placement.ts                         ← Placement (plugin, render hook only)
  text-layer.ts                        ← TextLayer
  icon-layer.ts                        ← IconLayer
  line-text-layer.ts                   ← LineTextLayer

  workers/
    symbol-worker-point.ts             ← TextLayer worker entry
    symbol-worker-icon.ts              ← IconLayer worker entry
    symbol-worker-line.ts              ← LineTextLayer worker entry
    text-worker-service.ts
    icon-worker-service.ts
    line-text-worker-service.ts

  vendor/                              ← from MapLibre src/symbol/
    symbol_layout_helpers.ts
    shaping.ts
    quads.ts
    symbol_size.ts
    collision_feature.ts
    collision_index.ts                 ← adapted
    grid_index.ts
    anchor.ts
    get_anchors.ts
    one_em.ts
    opacity_state.ts
    transform_text.ts                  ← stub
    rtl_text_plugin_worker_stub.ts     ← stub
    path_interpolator.ts
    check_max_angle.ts
    clip_line.ts
    merge_lines.ts

  shaders/
    symbol_sdf.vertex.glsl
    symbol_sdf.fragment.glsl
    symbol_icon.vertex.glsl
    symbol_icon.fragment.glsl
```

---

## Tree-shaking Summary

| Configuration | Bundles included |
|---|---|
| Nothing | — |
| Text labels only | `GlyphManager`, `TextLayer`, `symbol-worker-point` |
| Text + collision | + `Placement`, `collision_index`, `placement` |
| Icons only | `ImageManager`, `IconLayer`, `symbol-worker-icon` |
| Line text | `GlyphManager`, `LineTextLayer`, `symbol-worker-line` (larger) |
| Everything | All of the above |

---

## Out of Scope (Phase 1)

- Cross-tile symbol index
- Variable anchors
- RTL text (`transform_text` stubbed as no-op)
- Vertical text / CJK
- `text-writing-mode`
- Collision debug visualisation
- Globe subdivision for symbol geometry
- `symbol_text_and_icon` shader (combined text + inline icons)
