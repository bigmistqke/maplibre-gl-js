# MapLibre Clean-Room Architecture

**Date:** 2026-03-18
**Status:** Draft
**Goal:** A clean-room reimplementation of MapLibre GL JS with a modular, treeshakable architecture — designed to inform a future upstream MapLibre version.

---

## Context and Motivation

The `feat-mini` branch attempted to incrementally refactor MapLibre from a monolith into a pluggable, treeshakable architecture. While it proved out several key patterns (self-contained layer classes, a Surface abstraction, a feature registry), it ultimately revealed that retrofitting these onto a 100k-line entangled codebase is impractical.

The clean-room approach starts fresh with the right foundations, designed for modularity from day one. It is not a full replacement of MapLibre — it is a new core that existing layer/bucket/shader code can be progressively ported into, and that can inform a future MapLibre RFC.

### Key lessons from feat-mini

- The registry pattern (`registry.getLayer('fill')`) is a code smell driven by style JSON's stringly-typed layer references, not a fundamental requirement
- `Surface` as a strategy object accumulated too many responsibilities and became a god class at a different level
- Terrain has two distinct concerns (elevation data and terrain rendering) that are consumed by different parts of the system and should be separate
- Tree-shaking requires pure ES imports as the primary mechanism — not a central registration system

### Non-goals

- Style JSON as a core concept (it is an optional adapter, not a first-class API)
- Full API compatibility with MapLibre GL JS
- WebGL 2 or WebGPU (WebGL 1 for maximum compatibility; WebGL 2 can be targeted later)
- GeoJSON source and symbol/label layers in initial scope (the architecture must accommodate them, not implement them)

---

## Architecture Overview

The system is organized into four tiers with strict downward-only dependencies.

```
Tier 1 · Main thread
  Map, CameraController, InputHandler, ElevationProvider

  ↕ RendererAPI
    direct object reference — Map holds a RendererAPI and calls it directly

Tier 2 · Renderer (lives wherever createRenderer() is called)
  Renderer, TileManager, StyleEvaluator, FrameLoop, WebGLContext, RenderExtensions

  ↕ TileService interface
    @bigmistqke/rpc OR inline — same interface either way

Tier 3 · Optional worker services (stateless compute)
  VectorTileService, RasterTileService
  GeoJSONService (stateful · future), SymbolService (stateful · future)

Tier 4 · Plugins and optional adapters
  TerrainPlugin, style-json adapter (future), @bigmistqke/view.gl
```

No tier depends on a tier above it. No feature-specific branching (`if (terrain)`, `if (hasLabels)`) anywhere in core.

### Thread placement is a deployment detail

Every service boundary is designed so that `@bigmistqke/rpc` can transparently wrap it if needed. Whether a service runs inline or in a worker is decided at composition time, not baked into the architecture.

This works cleanly because all services with thread-placement flexibility are **pure compute** — they only have async interfaces (`setData`, `getTile`, `process`). They have no sync query surface; queries go through the renderer's local geometry cache, which never needs to cross a thread boundary.

### OffscreenCanvas as user-space composition

The architecture does not prescribe an OffscreenCanvas mode. `createRenderer()` works wherever it is called — main thread or worker. If a user wants to move rendering off-thread, they write a worker entry point that calls `createRenderer()` and exposes a custom RPC surface via `@bigmistqke/rpc`. Layer instantiation happens inside the worker where the classes are in scope — no serialization, no registry:

```ts
// renderer.worker.ts (user-authored)
import { FillLayer }      from 'maplibre/layers/fill'
import { RasterLayer }    from 'maplibre/layers/raster'
import { createRenderer } from 'maplibre/renderer'
import { expose, handle } from '@bigmistqke/rpc'

expose({
  init: async (canvas: OffscreenCanvas) => {
    const renderer = await createRenderer(canvas)
    return handle({
      setCamera:      (state) => renderer.setCamera(state),
      addFillLayer:   (opts)  => renderer.addLayer(new FillLayer(opts)),
      addRasterLayer: (opts)  => renderer.addLayer(new RasterLayer(opts)),
      queryRenderedFeatures: (pt) => renderer.queryRenderedFeatures(pt),
    })
  }
})
```

The user defines their own RPC surface — they expose exactly the layer types and operations their app needs. Core has no opinion on this.

---

## Tier 1 — Main Thread

### Map

A thin user-facing facade. Owns no rendering state. Delegates to `CameraController` and `RendererAPI`.

```ts
class Map {
  addSource(id: string, source: SourceDefinition): void
  removeSource(id: string): void
  addLayer(layer: LayerInstance, beforeId?: string): void
  removeLayer(id: string): void
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  getCamera(): CameraState        // sync — reads CameraController directly
  setCamera(state: Partial<CameraState>, options?: AnimationOptions): void
  addPlugin(plugin: Plugin): void
  readonly renderer: RendererAPI  // exposed for direct query access
}
```

`Map` takes a renderer at construction time — no modes, just composition:

```ts
const renderer = await createRenderer(canvas)
const map = new Map({ container, renderer })
```

`Map` is trivially testable (inject a mock renderer) and future renderer backends require no changes to `Map`.

### CameraController

Owns all camera state. Source of truth for `getZoom()`, `getCenter()`, `getBearing()`, `getPitch()` — always synchronous, never cross any boundary.

Responsibilities:
- Maintain `CameraState` (center, zoom, bearing, pitch)
- Run camera animations (easing, fly-to, ease-to)
- Enforce constraints (max/min zoom, max bounds)
- Clamp center elevation via `ElevationProvider` (for terrain)
- Push `CameraState` to `RendererAPI` on every change (fire-and-forget)

```ts
interface CameraState {
  center: LngLat
  zoom: number
  bearing: number
  pitch: number
  // Terrain elevation at map center, ground level (not camera altitude).
  // Provided by ElevationProvider; always 0 on flat maps.
  groundElevation: number
}
```

### InputHandler

Translates raw DOM events (mouse, touch, keyboard, scroll) into camera commands dispatched to `CameraController`. No rendering knowledge.

### ElevationProvider

A narrow interface with a null-object default. Terrain implements it.

```ts
interface ElevationProvider {
  getElevation(lngLat: LngLat): number
}

const NULL_ELEVATION: ElevationProvider = { getElevation: () => 0 }
```

Used by `CameraController` (center clamping) and marker/popup positioning. Nothing else reads elevation.

### Plugin

The interface for features that extend both Tier 1 and Tier 2. `Map.addPlugin()` inspects via duck-typing — no type registry.

```ts
interface Plugin extends Partial<ElevationProvider> {
  // If present: registered as the map's ElevationProvider
  getElevation?: (lngLat: LngLat) => number

  // If present: forwarded to renderer.addRenderExtension()
  readonly renderExtension?: RenderExtension
}
```

Open for future plugin types — `Map.addPlugin` handles each known field, ignores unknown ones.

---

## Tier 2 — Renderer

### createRenderer

Async factory — no constructor+init smell.

```ts
async function createRenderer(
  canvas: HTMLCanvasElement,
  options?: RendererOptions
): Promise<RendererAPI>
```

Compiles shader programs, initializes WebGL context, starts frame loop. Returns a `RendererAPI` instance.

### RendererAPI

The typed interface `Map` uses to communicate with the renderer. All mutations are fire-and-forget (`void`). Queries are sync — called directly on the object.

```ts
// Minimal definition — extended per source type
interface SourceDefinition {
  type: string  // 'raster' | 'vector' | 'geojson' | ...
  [key: string]: unknown
}

interface RendererAPI {
  resize(width: number, height: number): void
  destroy(): void

  // Content mutations (fire-and-forget)
  addSource(id: string, source: SourceDefinition): void
  removeSource(id: string): void
  addLayer(layer: LayerInstance, beforeId?: string): void
  removeLayer(id: string): void
  setLayerPaint(id: string, props: Record<string, unknown>): void
  setLayerLayout(id: string, props: Record<string, unknown>): void
  setLayerVisibility(id: string, visible: boolean): void

  // Camera (fire-and-forget, called up to 60fps)
  setCamera(state: CameraState): void

  // Render extensions (fire-and-forget)
  addRenderExtension(extension: RenderExtension): void
  removeRenderExtension(id: string): void

  // Queries — sync direct calls
  queryRenderedFeatures(point: ScreenPoint): Feature[]
}
```

### Renderer

Implements `RendererAPI`. Owns WebGL context, tile manager, style evaluator, frame loop.

On `addLayer()`: registers the layer's GPU programs with `WebGLContext` (reference-counted), registers the layer's `TileService` class with `TileManager`.

On `setCamera()`: updates internal camera state, marks frame dirty.

### DrawContext and RenderContext

```ts
interface ProgramCache {
  get(name: string): WebGLProgram | undefined
}

// Typed as Record<string, unknown> at the boundary.
// Each LayerClass narrows it inside draw() via a typed cast (e.g. FillPaint).
type ResolvedPaintProperties = Record<string, unknown>

interface DrawContext {
  gl: WebGLRenderingContext
  programs: ProgramCache
  tileID: TileID
  matrix: Float32Array             // tile-space → clip-space
  zoom: number
  paint: ResolvedPaintProperties   // pre-evaluated for this layer + zoom
  frameIndex: number

  // Small shared GPU resources — always present on the renderer, negligible bundle cost.
  // Empty/idle when nothing uses them.
  imageAtlas: ImageAtlas           // sprite images, icon textures, fill patterns
  lineDashAtlas: LineDashAtlas     // dash pattern textures for line layers

}

interface RenderContext {
  gl: WebGLRenderingContext
  programs: ProgramCache
  camera: CameraState
  visibleTiles: TileID[]
  frameIndex: number
}
```

### TileManager

Owns tile lifecycle: visibility calculation, request scheduling, in-flight tracking, eviction.

On camera change: computes visible tile IDs. For each missing tile, fetches the raw `ArrayBuffer` (owns network request, URL template, caching headers) then calls `TileService.process()` for decoding and geometry generation. Both steps are cancellable via `AbortSignal`.

Services are instantiated **per source instance** — one `VectorTileService` per vector source, one `RasterTileService` per raster source. Stateless services are cheap to duplicate; stateful ones (GeoJSON, future) require per-instance state by nature. Services are destroyed when their source is removed.

When a new layer type is added after tiles are already loaded: `TileManager` re-processes affected cached tiles (raw `ArrayBuffer` is retained) to generate the missing bucket geometry.

### StyleEvaluator

Evaluates paint and layout property expressions per-zoom per-layer. Called by `Renderer` before each draw call.

```ts
interface StyleEvaluator {
  evaluate(layer: LayerInstance, zoom: number, feature?: Feature): ResolvedPaintProperties
}
```

`LayerInstance` subclasses declare their paint property specs. `StyleEvaluator` interprets them, keeping expression logic out of draw code.

### FrameLoop

Drives rendering via `requestAnimationFrame`. Marks frames dirty when camera, tiles, or style changes. Calls `Renderer.renderFrame()` when dirty.

### WebGLContext

Owns all GPU resources: compiled programs, texture atlases, framebuffers. Uses `@bigmistqke/view.gl` for uniform and attribute management.

Programs are compiled from `ProgramDefinition` objects provided by layer classes. Programs support shader injection via `#pragma maplibre extension <id>` directives.

`ImageAtlas` and `LineDashAtlas` are owned by `WebGLContext` and exposed through `DrawContext`. They are small (~100–300 lines, no external dependencies) so they are always present — zero cost when nothing uses them. `GlyphManager` and other large subsystems are not owned by `WebGLContext`; they are registered by layer extensions and live outside the renderer core.

### RenderExtensions

An ordered list of `RenderExtension` objects iterated at defined points in the frame loop. No extension-specific code in core.

```ts
interface RenderExtension {
  id: string

  // Injected at compile time into programs that opt in via:
  // #pragma maplibre extension <id>
  // Multiple extensions injected in registration order. Stripped if not registered.
  shaderInjection?: {
    vertex?: string
    fragment?: string
    defines?: Record<string, string>
  }

  beforeTiles?(ctx: RenderContext): void
  afterTiles?(ctx: RenderContext): void

  // Applied to tile mesh geometry before GPU upload
  transformTileGeometry?(mesh: TileMesh, tileID: TileID): TileMesh
}
```

---

## Layer System and Tree-Shaking

### Pure ES imports — no registry

Each layer type is self-contained. Tree-shaking is automatic — unused layer types and everything they bring (bucket, programs, tile service) are dead code.

```ts
import { RasterLayer } from 'maplibre/layers/raster'
import { FillLayer }   from 'maplibre/layers/fill'

map.addLayer(new RasterLayer({ source: 'basemap', opacity: 1 }))
map.addLayer(new FillLayer({ source: 'buildings', sourceLayer: 'building', color: '#cc9977' }))
```

### LayerClass structure

```ts
class FillLayer {
  readonly type = 'fill'

  // Multiple programs for variants (fill body + fill outline)
  static programs: ProgramDefinition[] = [
    { name: 'fill',         vertex: fillVert,       fragment: fillFrag        },
    { name: 'fill-outline', vertex: fillOutlineVert, fragment: fillOutlineFrag },
  ]

  // Worker service for tile processing
  static TileService: typeof FillTileService = FillTileService

  // Paint properties with defaults
  source: string
  sourceLayer?: string
  color: ColorExpression = '#000000'
  opacity: number = 1

  constructor(options: FillLayerOptions) { ... }

  draw(ctx: DrawContext): void {
    // Small shared resources available directly on ctx
    const { imageAtlas } = ctx  // for fill-pattern support
  }
}
```

### Layer lifecycle: onAdd

Layers that need shared per-renderer resources (beyond `imageAtlas` and `lineDashAtlas`) declare them in `onAdd`. The renderer provides `getOrCreate` — a simple `Map<Class, Instance>` that guarantees one instance per renderer per resource type:

```ts
class SymbolLayer {
  private glyphManager!: GlyphManager

  onAdd(renderer: Renderer): void {
    // One GlyphManager per renderer, shared across all SymbolLayer instances.
    // Dead code if SymbolLayer is never imported.
    this.glyphManager = renderer.getOrCreate(GlyphManager, (gl) => new GlyphManager(gl))
  }

  draw(ctx: DrawContext): void {
    this.glyphManager.getGlyphs(...)
  }
}
```

`getOrCreate` uses the class constructor as the key — no strings, no registry. Multiple `SymbolLayer` instances share one `GlyphManager`. Multiple renderer instances each get their own. `GlyphManager` (and TinySDF) are dead code if `SymbolLayer` is never imported.

### Style JSON adapter (separate package)

A future `maplibre/style-json` package parses style JSON and calls the imperative API. Not part of core.

---

## Services

### Tile fetching vs tile processing

`TileManager` fetches tile data (HTTP, URL template, caching headers). `TileService` receives the already-fetched `ArrayBuffer` and handles decoding and geometry generation only. This centralizes network error handling and cancellation in `TileManager`.

```ts
interface TileService {
  // layerTypes: which layer types to build buckets for (e.g. ['fill', 'line'])
  process(
    tileID: TileID,
    data: ArrayBuffer,
    layerTypes: string[],
    signal: AbortSignal
  ): Promise<Transferable[]>
}
```

`TileService` is the only service interface defined in core — it is what `TileManager` calls. All services are pure async compute with no sync query surface. `queryRenderedFeatures` always queries the renderer's local geometry cache, never the service.

### Services in initial scope

`VectorTileService` (`layers/vector.ts`): decode MVT protobuf → tessellate geometry → `Transferable[]`.

`RasterTileService` (`layers/raster.ts`): decode PNG/JPEG → pixel data as `Transferable`.

Both run inline by default. Thread placement is a deployment detail — wrap in `@bigmistqke/rpc` at composition time to move to a worker pool.

### Services out of initial scope (designed for)

`GeoJSONService` (`layers/geojson.ts`): owns the dataset, re-tiles on demand. Interface lives alongside `GeoJSONLayer`, not in core.

`SymbolService` (`layers/symbol.ts`): text shaping, cross-tile collision index. Interface lives alongside `SymbolLayer`, not in core.

Both follow the same thread-placement-as-deployment-detail principle — their interfaces are fully async so wrapping in `@bigmistqke/rpc` to move to a dedicated worker is straightforward.

---

## Terrain Plugin

`TerrainPlugin` implements both `ElevationProvider` (Tier 1) and provides a `RenderExtension` (Tier 2) via a single `map.addPlugin()` call.

```ts
class TerrainPlugin implements Plugin {
  getElevation(lngLat: LngLat): number { /* DEM tile lookup */ }

  readonly renderExtension: RenderExtension = {
    id: 'terrain',
    shaderInjection: {
      vertex: `uniform sampler2D u_dem; /* vertex elevation displacement */`,
      defines: { TERRAIN: '1' },
    },
    beforeTiles(ctx) { /* RTT framebuffer setup, depth pre-pass */ },
    afterTiles(ctx)  { /* drape RTT result over terrain mesh */ },
    transformTileGeometry(mesh, tileID) { /* warp flat mesh to terrain */ },
  }
}
```

`Map.addPlugin(terrain)`:
1. Detects `plugin.getElevation` → registers as `ElevationProvider`
2. Detects `plugin.renderExtension` → calls `renderer.addRenderExtension()`

No `instanceof` checks. No registry. Duck-typed via `Plugin`'s optional fields.

---

## Dependencies

| Package | Role | Required |
|---|---|---|
| `@bigmistqke/rpc` | Typed RPC for tile worker services | Yes |
| `@bigmistqke/view.gl` | Uniform and attribute management in WebGLContext | Yes |
| `gl-matrix` | Matrix math | Yes |
| `@mapbox/vector-tile` + `pbf` | MVT decoding in VectorTileService | With VectorTileService |

No build-time codegen. Shaders are plain `.glsl` strings imported as modules.

---

## Directory Structure

```
src/
  core/
    map.ts                    — Map facade
    camera.ts                 — CameraController + CameraState
    input.ts                  — InputHandler
    plugin.ts                 — Plugin interface
    elevation-provider.ts     — ElevationProvider interface + NULL_ELEVATION
    render-extension.ts       — RenderExtension + DrawContext + RenderContext
    tile-service.ts           — TileService interface
    types.ts                  — LngLat, TileID, ScreenPoint, Feature, etc.

  renderer/
    index.ts                  — createRenderer() + RendererAPI interface
    renderer.ts               — RendererAPI implementation
    tile-manager.ts           — Tile lifecycle, fetch orchestration
    style-evaluator.ts        — Paint/layout expression evaluation
    frame-loop.ts             — rAF loop
    webgl-context.ts          — GPU resources, shader injection
    render-extensions.ts      — Extension registry + frame hooks

  layers/
    raster.ts                 — RasterLayer (self-contained)
    fill.ts                   — FillLayer (self-contained)
    line.ts                   — LineLayer (self-contained)
    background.ts             — BackgroundLayer (self-contained)

  services/
    vector-tile-service.ts    — Stateless MVT decode + tessellate
    raster-tile-service.ts    — Stateless raster decode

  plugins/
    terrain.ts                — TerrainPlugin

  shaders/
    fill.vert.glsl + fill.frag.glsl
    fill-outline.vert.glsl + fill-outline.frag.glsl
    line.vert.glsl + line.frag.glsl
    raster.vert.glsl + raster.frag.glsl
    background.vert.glsl + background.frag.glsl
```

---

## What This Enables

- **Tree-shaking by import**: unused layer types and everything they bring are dead code
- **Testable in isolation**: each tier can be tested independently; `TileService` implementations are pure functions; `Map` accepts a mock renderer
- **No feature flags in core**: terrain, labels, GeoJSON are plugins/extensions — no `if (terrain)` anywhere
- **OffscreenCanvas without a registry**: user writes a worker entry point with an explicit RPC surface; layer instantiation happens in the worker where classes are in scope
- **Upstream-friendly**: clean interfaces, no framework dependencies, no proprietary build system
- **Style JSON as adapter**: existing tooling supported via a separate adapter package
