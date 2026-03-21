# Symbol Layer Architecture — Design Spec

## Overview

Redesign the modular symbol rendering system from three independent layers with an optional placement plugin into a cohesive architecture with a shared base class, a lazily-created engine, and composable helpers.

**Goals:**
- Eliminate duplicated tile lifecycle, GPU buffer management, and placement plumbing across TextLayer, LineTextLayer, and IconLayer
- Make collision/placement a built-in concern (not a plugin) that works for a single layer or across many
- Share glyph and image atlases across layers that use the same resources
- Keep the system tree-shakeable — no symbol code ships if no symbol layers are imported

**Non-goals:**
- Full MapLibre feature parity (variable anchors, fade animations, line projection) — the architecture should support these later but this spec covers the structural refactor only
- Changes to the worker-side layout pipeline — workers remain unchanged
- Changes to the renderer or `RendererAPI` interface

---

## Architecture

```
SymbolEngine (one per renderer, static WeakMap<RendererAPI, SymbolEngine>)
  ├── has-a LayoutEngine      (collision, opacity, cross-tile dedup)
  ├── has-a ResourceManager   (glyph atlases, image atlases)
  └── RenderExtension: beforeTiles → LayoutEngine.runPlacement()

SymbolLayerBase (abstract class, implements LayerInstance)
  ├── has-a TileFetcher<T>    (async tile lifecycle)
  ├── references SymbolEngine  (obtained in onAdd via WeakMap)
  ├── draw() scaffolding       (stencil, blend, program, cleanup)
  └── abstract extension points for subclasses

TextLayer extends SymbolLayerBase
LineTextLayer extends SymbolLayerBase
IconLayer extends SymbolLayerBase
```

---

## Components

### 1. SymbolEngine

Thin coordinator. One per renderer, created lazily by the first `SymbolLayerBase.onAdd()` call. Stored in a static `WeakMap<RendererAPI, SymbolEngine>` on `SymbolLayerBase` — no changes to `RendererAPI`, no global state, automatically garbage collected when the renderer is destroyed.

```ts
class SymbolEngine {
  readonly layout: LayoutEngine
  readonly resources: ResourceManager

  register(layer: SymbolLayerBase): void
  unregister(layer: SymbolLayerBase): void
}
```

**Lifecycle:**
- On first `register()`: creates a `RenderExtension` with a `beforeTiles` hook and adds it to the renderer via `addRenderExtension()`.
- On last `unregister()`: removes the extension via `removeRenderExtension()`, calls `resources.destroy()`.
- The engine holds a reference to the renderer (received from the first `register()` call) for querying layer order and registering/removing the extension.

### 2. LayoutEngine

Pure placement logic. No GL, no textures, no knowledge of rendering.

```ts
class LayoutEngine {
  runPlacement(ctx: RenderContext, layers: SymbolLayerBase[]): void
}
```

**`runPlacement` flow:**
1. Create a fresh `CollisionIndex` from canvas dimensions and camera state.
2. Receive layers in renderer order (reversed — last layer in the stack gets highest collision priority, matching MapLibre's behavior).
3. For each layer, call `layer.getCollisionData(ctx)` → array of `CollisionData`.
4. For each label, call `placeCollisionBox()`. If placeable, call `insertCollisionBox()` and set opacity to 1. Otherwise opacity is 0.
5. Call `layer.setLabelOpacity(tileKey, Float32Array)` with the results.

**CollisionData type:**

```ts
type CollisionData = {
  tileKey: string
  anchors: Array<{ x: number; y: number }>  // screen pixels
  boxes: Array<[number, number, number, number]>  // [x1, y1, x2, y2] screen pixels
}
```

**Future additions** (not in v1, but the shape supports them):
- `CrossTileSymbolIndex` — runs before collision testing, assigns persistent IDs across zoom levels for deduplication.
- `OpacityState` — replaces binary 0/1 opacity with smooth 300ms fade transitions.
- Variable anchor testing — tries up to 9 anchor positions per label before hiding it.

### 3. ResourceManager

Shared asset loading. Deduplicates atlas instances across layers that use the same URL and fontstack.

```ts
class ResourceManager {
  getGlyphManager(glyphUrl: string, fontstack: string): GlyphManager
  getImageManager(spriteUrl: string): ImageManager
  destroy(): void
}
```

**Keying:**
- Glyph managers keyed by `${glyphUrl}|${fontstack}` — two TextLayers with the same fontstack share one GlyphManager and one GPU atlas texture.
- Image managers keyed by sprite URL.

**Ownership:** The `ResourceManager` creates managers on first request and caches them. `destroy()` cleans up all cached managers and their GPU resources.

### 4. TileFetcher\<T\>

Generic async tile lifecycle helper. One instance per layer (composition, not inheritance).

```ts
class TileFetcher<T> {
  constructor(options: {
    fetch: (key: string, data: ArrayBuffer) => Promise<T | null>
    onReady: (key: string, result: T) => void
  })

  request(key: string, data: ArrayBuffer): void
  get(key: string): T | null
  evict(key: string): void
  hasPending(key: string): boolean
}
```

**State machine per tile key:** `idle → fetching → pending → ready`

- `request()`: If key is idle, calls the `fetch` function. If already fetching or ready, no-op.
- When `fetch` resolves: stores result as pending, calls `onReady`.
- `get()`: Returns the result if ready, null otherwise.
- `evict()`: Cancels in-flight requests (if possible), removes cached results.
- `hasPending()`: True if a fetch is in flight for this key.

Each subclass provides its own `fetch` function that calls its specific worker service. The `onReady` callback is used by the base class to queue GPU uploads.

### 5. SymbolLayerBase

Abstract base class. Implements `LayerInstance`. Contains all shared symbol layer behavior.

**What it owns:**
- `TileFetcher<T>` instance (created in constructor with subclass-provided fetch function)
- Reference to `SymbolEngine` (obtained in `onAdd()` via static WeakMap)
- `_tileOpacity: Map<string, Float32Array>` — written by LayoutEngine, read during draw
- `_tileBuckets: Map<string, GPUBucket | null>` — GPU-uploaded vertex/index buffers
- `_pendingUploads: Map<string, T>` — fetched results waiting for GPU upload

**Lifecycle methods:**
- `onAdd(renderer)`: Get-or-create `SymbolEngine` from WeakMap, register self with engine, store GL context.
- `destroy()`: Unregister from engine, destroy GPU buffers, destroy tile fetcher.
- `evictTile(key)`: Evict from fetcher, delete GPU buffers, clear opacity cache.

**draw() scaffolding:**

```
draw(ctx: DrawContext):
  1. Poll TileFetcher for ready results → move to _pendingUploads
  2. Upload pending buffers to GPU (_uploadBucket)
  3. Skip if no bucket for this tile
  4. gl.disable(STENCIL_TEST)
  5. gl.enable(BLEND)
  6. gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA)  // premultiplied alpha
  7. Call subclass drawTile(gl, program, bucket, ctx)
  8. gl.disable(BLEND)
  9. gl.enable(STENCIL_TEST)
  10. Disable vertex attribs
```

**Abstract methods subclasses must implement:**

```ts
abstract class SymbolLayerBase {
  // WebGL programs this layer needs
  abstract readonly programs: ProgramDefinition[]

  // Create the worker fetch function for TileFetcher
  abstract createTileFetcher(): TileFetcher<T>

  // Upload a worker result to GPU buffers
  abstract uploadBucket(gl: WebGLRenderingContext, key: string, data: T): GPUBucket

  // The actual GL draw for one tile: bind atlas, set uniforms, drawElements
  abstract drawTile(gl: WebGLRenderingContext, program: WebGLProgram,
                    bucket: GPUBucket, ctx: DrawContext): void

  // Collision data for visible tiles (project tile coords → screen space)
  abstract getCollisionData(ctx: RenderContext): CollisionData[]
}
```

**Placement integration (concrete, not abstract):**

```ts
// Called by LayoutEngine — stores opacity for use in draw()
setLabelOpacity(tileKey: string, opacity: Float32Array): void {
  this._tileOpacity.set(tileKey, opacity)
}
```

### 6. Subclasses

Each subclass is focused: it provides worker integration, atlas binding, and shader uniforms. Everything else is inherited.

**TextLayer extends SymbolLayerBase:**
- Worker: `TextWorkerService` (point text shaping via `SymbolWorkerPoint`)
- Atlas: `GlyphManager` from `engine.resources.getGlyphManager(url, fontstack)`
- Shader: `symbol_sdf` program
- Uniforms: `u_texture`, `u_texsize`, `u_resolution`, `u_color`, `u_opacity`, `u_font_scale`
- Collision: projects label anchors from tile coords to screen coords, builds AABBs from label sizes

**LineTextLayer extends SymbolLayerBase:**
- Worker: `LineTextWorkerService` (line text shaping via `SymbolWorkerLine`)
- Atlas: `GlyphManager` from `engine.resources` (shared with TextLayer if same fontstack + URL)
- Shader: same `symbol_sdf` program as TextLayer
- Uniforms: same as TextLayer
- Collision: same projection approach, anchors come from line geometry

**IconLayer extends SymbolLayerBase:**
- Worker: `IconWorkerService` (icon quad generation via `SymbolWorkerIcon`)
- Atlas: `ImageManager` from `engine.resources.getImageManager(spriteUrl)`
- Shader: `symbol_icon` program
- Uniforms: `u_texture`, `u_texsize`, `u_resolution`, `u_opacity`
- Blend: `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` (straight alpha, not premultiplied)

---

## Data Flow (One Frame)

```
beforeTiles:
  SymbolEngine.beforeTiles(ctx)
    → LayoutEngine.runPlacement(ctx, registeredLayers)
      for each layer (reverse renderer order):
        layer.getCollisionData(ctx) → [{tileKey, anchors, boxes}]
        for each label:
          CollisionIndex.placeCollisionBox()
          if placeable: insertCollisionBox(), opacity = 1
          else: opacity = 0
        layer.setLabelOpacity(tileKey, opacityArray)

per-tile draw (called by renderer for each visible tile):
  SymbolLayerBase.draw(ctx):
    1. Poll TileFetcher → queue pending uploads
    2. Upload pending buffers to GPU
    3. Skip if no bucket
    4. Disable stencil, enable blend
    5. subclass.drawTile():
       - Bind atlas texture from ResourceManager
       - Set shader uniforms
       - Read _tileOpacity for per-label visibility
       - gl.drawElements() (per-label or single draw)
    6. Restore GL state
```

---

## File Layout

```
src/modular/layers/symbol/
  engine/
    symbol-engine.ts          SymbolEngine coordinator
    layout-engine.ts          LayoutEngine (collision, placement)
    resource-manager.ts       ResourceManager (atlas dedup)
  base/
    symbol-layer-base.ts      SymbolLayerBase abstract class
    tile-fetcher.ts           TileFetcher<T> generic helper
    types.ts                  GPUBucket, CollisionData, shared types
  text-layer.ts               TextLayer (extends SymbolLayerBase)
  line-text-layer.ts          LineTextLayer (extends SymbolLayerBase)
  icon-layer.ts               IconLayer (extends SymbolLayerBase)
  glyph-manager.ts            GlyphManager (unchanged, owned by ResourceManager)
  glyph-atlas.ts              GlyphAtlas (unchanged)
  glyph-loader.ts             (unchanged)
  image-manager.ts            ImageManager (unchanged, owned by ResourceManager)
  image-atlas.ts              (unchanged)
  sprite-loader.ts            (unchanged)
  workers/                    (unchanged)
  vendor/                     (unchanged)
```

---

## What Gets Deleted

- `src/modular/layers/symbol/placement.ts` — replaced by `LayoutEngine`
- `src/modular/core/placement-participant.ts` — replaced by methods on `SymbolLayerBase`
- `src/modular/core/placement-participant.test.ts` — replaced by LayoutEngine tests
- The `PlacementParticipant` interface — no longer needed
- The `RenderExtension` plugin pattern for placement — engine registers its own extension internally

---

## Migration Path

This is a refactor of internal architecture. The external API changes:

**Before:**
```ts
const placement = new Placement()
map.addPlugin(placement)
map.addLayer(new TextLayer({ glyphs, source, textField, ... }))
```

**After:**
```ts
map.addLayer(new TextLayer({ glyphUrl, source, textField, ... }))
// Engine, placement, and atlas sharing happen automatically
```

The `Placement` class and `addPlugin` call are no longer needed for symbol collision. The `glyphs` (GlyphManager) constructor option is replaced by `glyphUrl` — the ResourceManager creates and shares the GlyphManager internally.

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| WeakMap for engine storage | No RendererAPI changes, automatic GC, supports multiple maps |
| Reverse layer order for collision | Matches MapLibre's behavior (last layer = highest priority) |
| LayoutEngine has no GL dependency | Testable in isolation, clean separation of concerns |
| ResourceManager deduplicates by key | Two TextLayers with same fontstack share one atlas — saves GPU memory |
| TileFetcher as composition | Tile lifecycle is infrastructure, not layout — reusable for non-symbol layers |
| Abstract base class (not mixin) | Layers share enough behavior that inheritance pays for itself; extension points are well-defined |
| Subclasses own shader specifics | Text vs icon rendering differs enough to warrant separate draw logic |
| Per-label opacity via Float32Array | Simple interface; can be upgraded to per-vertex buffer for fade animations later |
