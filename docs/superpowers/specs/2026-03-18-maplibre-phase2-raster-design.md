# MapLibre Clean-Room — Phase 2: Raster Tiles

**Date:** 2026-03-18
**Status:** Draft
**Goal:** A real interactive raster tile map — OSM tiles fetched, decoded, uploaded to GPU, drawn per-tile. Proves TileManager + RasterLayer end-to-end. Phase 1 BackgroundLayer still works beneath tiles.

---

## Scope

**In scope:**
- `Projection` interface — designed for future globe/custom projections
- `MercatorProjection` — web mercator tile visibility + tile→clip matrix
- `TileManager` — minimal: visible tile set, fetch, AbortSignal cancellation, no LRU
- `RasterLayer` + `RasterTileService` — self-contained in `layers/raster.ts`
- `WebGLContext.getOrCreateTexture()` — GPU texture upload + cache; unit quad VBO
- `Renderer` — per-tile draw loop, source/layer wiring
- `createRenderer(canvas, options?)` — accepts `options.projection`
- Demo: `demo/phase-2-raster.html` + `demo/phase-2-raster.ts` (OSM tiles, zoom/center controls via `setCamera()`)

**Out of scope (Phase 3):**
- InputHandler (pan/drag/scroll)
- LRU tile eviction + `destroyTexture`
- Vector tiles, FillLayer, LineLayer
- `@bigmistqke/view.gl`
- Worker-based TileService

---

## Design Principles

**Build for the future without implementing it.** Every interface boundary is designed to accommodate extension without requiring changes to callers. Implementations are minimal — the architecture is not.

**Fire-and-forget service boundary.** `TileService.process()` is `Promise<Transferable[]>` — no sync return values, no callbacks back to caller. This keeps it rpc-wrappable for worker placement. `AbortSignal` works inline; a future worker-safe alternative is a separate `cancel(tileID)` method.

**Projection is injected, not imported.** TileManager and Renderer take a `Projection` — no mercator-specific code in either. Globe or custom projections slot in via `createRenderer(canvas, { projection })`.

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `src/mini/core/projection.ts` | Create | `Projection` interface + `Viewport` type |
| `src/mini/renderer/mercator.ts` | Create | `MercatorProjection implements Projection` |
| `src/mini/renderer/tile-manager.ts` | Create | Tile lifecycle: visibility, fetch, cancel, cache |
| `src/mini/layers/raster.ts` | Create | `RasterLayer` + GLSL shaders + `RasterTileService` |
| `src/mini/renderer/webgl-context.ts` | Modify | Add `getOrCreateTexture(key, bitmap)` + unit quad VBO |
| `src/mini/renderer/renderer.ts` | Modify | Source registry, layer→source wiring, per-tile draw loop |
| `src/mini/renderer/index.ts` | Modify | Accept `RendererOptions { projection? }` |
| `demo/phase-2-raster.html` | Create | Phase 2 demo page |
| `demo/phase-2-raster.ts` | Create | Demo script: OSM tiles, zoom/center sliders |

---

## Interfaces

### Projection (`src/mini/core/projection.ts`)

```ts
import type { CameraState, TileID } from './types.ts'

export interface Viewport {
  width: number
  height: number
}

export interface Projection {
  /** Tile IDs visible in the current camera + viewport */
  getVisibleTiles(camera: CameraState, viewport: Viewport): TileID[]
  /** Tile-space [0,1]² → clip-space 4×4 matrix for this tile */
  getTileMatrix(tileID: TileID, camera: CameraState, viewport: Viewport): Float32Array
}
```

### MercatorProjection (`src/mini/renderer/mercator.ts`)

Web mercator (EPSG:3857). `getVisibleTiles` computes the tile grid covering the viewport at the given zoom level. `getTileMatrix` returns a 4×4 matrix mapping the unit tile quad `[0,1]²` to clip space.

Key math:
- `lngToTileX(lng, z)` = `floor((lng + 180) / 360 * 2^z)`
- `latToTileY(lat, z)` = `floor((1 - ln(tan(lat·π/180) + 1/cos(lat·π/180)) / π) / 2 * 2^z)`
- Tile size on screen = `256 * 2^(zoom - floor(zoom))` px (fractional zoom)

### Source definitions

```ts
// src/mini/core/renderer-api.ts (extend existing SourceDefinition)
export interface RasterSourceDefinition extends SourceDefinition {
  type: 'raster'
  url: string        // XYZ tile URL template: 'https://.../{z}/{x}/{y}.png'
  tileSize?: number  // default 256
}
```

### TileManager (`src/mini/renderer/tile-manager.ts`)

```ts
interface TileEntry {
  status: 'loading' | 'ready' | 'error'
  // Convention: for raster tiles, Transferable[0] is an ImageBitmap.
  // TileManager casts index 0 to ImageBitmap after RasterTileService.process() resolves.
  imageBitmap?: ImageBitmap
  controller: AbortController
}

class TileManager {
  constructor(
    urlTemplate: string,          // e.g. 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    tileService: TileService,
    projection: Projection,
    onTileReady: () => void,      // → frameLoop.markDirty()
  )

  update(camera: CameraState, viewport: Viewport): void
  // Computes visible tile IDs via projection.getVisibleTiles(camera, viewport)
  // Fetches missing tiles (fetch → ArrayBuffer → tileService.process())
  // Cancels in-flight AbortControllers for tiles no longer in visible set
  // On process() resolution: stores imageBitmap (Transferable[0] as ImageBitmap), calls onTileReady()

  /** Returns only currently-visible tiles that have status 'ready'. Never returns stale out-of-view tiles. */
  getReadyTiles(): Array<{ tileID: TileID; imageBitmap: ImageBitmap }>

  destroy(): void
  // Cancels all in-flight requests
}
```

No LRU. All fetched tiles accumulate in memory. `getReadyTiles()` filters to the current visible set — tiles outside that set remain in the cache but are never drawn. Eviction is Phase 3.

Uses `new globalThis.Map<string, TileEntry>()` internally to avoid collision with the `Map` class name.

### RasterTileService

Inline in `layers/raster.ts`. Implements `TileService`:

```ts
class RasterTileService implements TileService {
  async process(
    _tileID: TileID,
    data: ArrayBuffer,
    _layerTypes: string[],
    signal: AbortSignal,
  ): Promise<Transferable[]> {
    const blob = new Blob([data])
    const bitmap = await createImageBitmap(blob)
    if (signal.aborted) { bitmap.close(); return [] }
    return [bitmap]
  }
}
```

### RasterLayer

```ts
class RasterLayer {
  readonly type = 'raster'
  static programs: ProgramDefinition[] = [{ name: 'raster', vertex: rasterVert, fragment: rasterFrag }]
  static TileService = RasterTileService

  source: string      // source id passed to addSource()
  opacity: number     // default 1

  constructor(options: { source: string; opacity?: number })

  draw(ctx: DrawContext & { tileTexture: WebGLTexture }): void
  // Uses ctx.gl, ctx.programs.get('raster'), ctx.tileTexture, ctx.matrix, ctx.paint['opacity']
  // Binds the unit quad VBO from WebGLContext (passed via ctx.gl — quad buffer is a property of WebGLContext)
  // Sets uniforms: u_matrix (ctx.matrix), u_texture (unit 0), u_opacity
  // Calls gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}
```

GLSL:
```glsl
// vertex (rasterVert)
attribute vec2 a_pos;
uniform mat4 u_matrix;
varying vec2 v_uv;
void main() {
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
  v_uv = a_pos;
}

// fragment (rasterFrag)
precision mediump float;
uniform sampler2D u_texture;
uniform float u_opacity;
varying vec2 v_uv;
void main() {
  gl_FragColor = texture2D(u_texture, v_uv) * u_opacity;
}
```

### WebGLContext additions

```ts
// Unit quad VBO — created once in constructor, shared by all tile-drawing layers.
// Vertices: [0,0, 1,0, 0,1, 1,1] (TRIANGLE_STRIP covering [0,1]²)
readonly quadBuffer: WebGLBuffer

// Texture cache — keyed by tileKey (e.g. '10/512/341')
// On first call: creates WebGLTexture, uploads bitmap via gl.texImage2D(TEXTURE_2D, ...)
// Subsequent calls: returns cached texture
getOrCreateTexture(key: string, bitmap: ImageBitmap): WebGLTexture
```

`quadBuffer` is created in the `WebGLContext` constructor. `RasterLayer.draw` accesses it via `onAdd` — see Renderer changes below.

### Renderer changes

**Constructor:** `Renderer(canvas: HTMLCanvasElement, projection: Projection)`

Renderer stores the `Projection` instance. `projection` is used in `setCamera` (to update TileManagers) and `renderFrame` (to compute per-tile matrices).

**Source registry:** Renderer adds `_sources = new globalThis.Map<string, SourceDefinition>()` and `_tileManagers = new globalThis.Map<string, TileManager>()`.

`addSource(id, source)`:
- Stores source in `_sources`
- If `source.type === 'raster'`: constructs `new TileManager(source.url, new RasterTileService(), this._projection, () => this._frameLoop.markDirty())`
- Stores TileManager in `_tileManagers` keyed by source id

`addLayer(layer)` — existing behavior plus:
- If `(layer as any).source` exists, stores the source→layer association in `_tileLayers = new globalThis.Map<string, LayerInstance[]>()`

`setCamera(state)`:
- Existing behavior (update `_camera`, markDirty) plus:
- Constructs `viewport: Viewport = { width: this._width, height: this._height }`
- Calls `tileManager.update(state, viewport)` for each active TileManager

`renderFrame()`:
1. Full-frame layers (BackgroundLayer) — unchanged
2. For each `[sourceId, tileManager]` in `_tileManagers`:
   - `viewport = { width: this._width, height: this._height }`
   - For each `{ tileID, imageBitmap }` in `tileManager.getReadyTiles()`:
     - `tileTexture = this._webgl.getOrCreateTexture(tileKey(tileID), imageBitmap)`
     - `matrix = this._projection.getTileMatrix(tileID, camera, viewport)`
     - For each layer in `_tileLayers.get(sourceId) ?? []`:
       - `const paint = this._styleEvaluator.evaluate(layer, camera.zoom)`
       - `layer.draw({ gl, programs: this._webgl.programs, tileID, matrix, zoom: camera.zoom, paint, frameIndex: this._frameIndex, tileTexture })`

`RasterLayer.draw` accesses the quad VBO via `this._webgl.quadBuffer` through `onAdd`:

```ts
// In RasterLayer
private _quadBuffer!: WebGLBuffer

onAdd(renderer: RendererAPI): void {
  // renderer is the Renderer instance; access quadBuffer via duck-typing
  this._quadBuffer = (renderer as any)._webgl.quadBuffer
}
```

### createRenderer options

```ts
// src/mini/renderer/index.ts
import { MercatorProjection } from './mercator.ts'

export interface RendererOptions {
  projection?: Projection   // default: new MercatorProjection()
}

export async function createRenderer(
  canvas: HTMLCanvasElement,
  options?: RendererOptions,
): Promise<RendererAPI> {
  return new Renderer(canvas, options?.projection ?? new MercatorProjection())
}
```

---

## Demo (`demo/phase-2-raster.html`)

Controls:
- Zoom slider (0–18, step 0.1)
- Center lat/lng display (static — no InputHandler in Phase 2)
- Attribution: © OpenStreetMap contributors

Setup:
```ts
const renderer = await createRenderer(canvas)
const map = new MapGL({ renderer })

map.addSource('osm', {
  type: 'raster',
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileSize: 256,
} as RasterSourceDefinition)

map.addLayer(new RasterLayer({ source: 'osm', opacity: 1 }))
map.setCamera({ center: { lng: 4.9, lat: 52.37 }, zoom: 10 }) // Amsterdam
```

---

## Testing

All tests use `vitest.config.mini.ts` (`environment: 'node'`, manual WebGL mocks). No jsdom, no `vitest-webgl-canvas-mock`.

`fetch` and `createImageBitmap` are stubbed with `vi.stubGlobal` in tests that need them.

Key test files:
- `src/mini/core/projection.test.ts` — Projection interface shape (compile-time duck-typing check)
- `src/mini/renderer/mercator.test.ts` — tile coordinate math: known lng/lat → expected x/y/z
- `src/mini/renderer/tile-manager.test.ts` — visible set update, fetch triggered, cancellation on out-of-view
- `src/mini/layers/raster.test.ts` — RasterLayer.draw binds texture + draws quad; RasterTileService.process returns ImageBitmap
- `src/mini/renderer/webgl-context.test.ts` — getOrCreateTexture: first call uploads, second call returns cached

---

## What Phase 3 Adds

- `InputHandler` — pan/drag/scroll → CameraController
- LRU eviction in TileManager + `WebGLContext.destroyTexture()`
- `VectorTileService` + `FillLayer` + `LineLayer` (earcut tessellation, real shaders)
- `@bigmistqke/view.gl` in WebGLContext for uniform/attribute management
- Worker-based TileService via `@bigmistqke/rpc`
