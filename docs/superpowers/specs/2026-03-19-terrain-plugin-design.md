# Terrain Plugin Design

## Goal

Add tree-shakeable 3D terrain to maplibre-mini. Terrain is a plugin — importing `TerrainPlugin` adds ~0 bytes to a bundle that does not use it. The renderer core gets zero `if (terrain)` branches. The demo shows a mercator map with DEM-draped 3D terrain, elevation-aware camera, and existing raster layers draping correctly over the mesh.

## Architecture

Two concerns, two seams:

1. **Render pipeline strategy** — flat vs RTT. Handled by the new `Surface` interface.
2. **Elevation queries** — camera clamping, marker positioning. Handled by the existing `ElevationProvider` interface.

`TerrainPlugin` implements both via duck-typing. The renderer checks for `renderTiles` to find a Surface; `CameraController` checks for `getElevation` to find an ElevationProvider. No new import in core.

## Surface Interface

`Surface` is defined in `src/mini/core/surface.ts`. It imports nothing from `src/mini/renderer/`.

```typescript
// src/mini/core/surface.ts

export interface Surface {
  /** Shader defines injected at program compile time. e.g. ['#define TERRAIN3D;'] */
  readonly shaderDefines: readonly string[]

  /** Execute the tile render loop for one frame. */
  renderTiles(internals: RendererInternals): void

  /** Release GPU resources. */
  destroy(): void
}
```

`RendererInternals` is defined alongside `Surface` in `src/mini/core/surface.ts`. It uses only types already defined in `src/mini/core/` — the renderer-specific types (`LayerEntry`, `StyleEvaluator`) are referenced structurally so no circular imports occur:

```typescript
export interface RendererInternals {
  gl: WebGL2RenderingContext
  camera: CameraState
  viewport: Viewport
  projection: Projection
  programs: ProgramCache
  stencilProgram: WebGLProgram
  // Structurally typed — avoids importing renderer internals
  layers: Array<{ id: string; layer: LayerInstance }>
  tileLayers: Map<string, LayerInstance[]>
  tileManagers: Map<string, { getReadyTiles(): Array<{ tileID: TileID; data: Transferable }>; getRetainedKeys(): Set<string> }>
  sourceTypes: Map<string, 'raster' | 'vector'>
  customLayers: CustomLayer[]
  evaluate: (layer: LayerInstance, zoom: number) => ResolvedPaintProperties
  frameIndex: number
  // Access to raw WebGL context helpers (FBO creation, texture/buffer utilities)
  createFramebuffer(width: number, height: number): FramebufferObject
  destroyFramebuffer(fb: FramebufferObject): void
  getOrCreateTexture(key: string, bitmap: ImageBitmap): WebGLTexture
  getOrCreateMeshBuffers(key: string, mesh: TileMesh): MeshBuffers
  writeTileStencil(prog: WebGLProgram, vert: WebGLBuffer, idx: WebGLBuffer, count: number, ref: number): void
}

export interface FramebufferObject {
  framebuffer: WebGLFramebuffer
  texture: WebGLTexture    // RGBA8, 512×512
  depth: WebGLRenderbuffer
}

export interface MeshBuffers {
  vert: WebGLBuffer
  idx: WebGLBuffer
  indexCount: number
}
```

`RendererInternals` is assembled inside `Renderer.renderFrame()` and passed to `surface.renderTiles()`. The WebGL helper methods (`createFramebuffer`, `writeTileStencil`, etc.) are added to `WebGLContext` and delegated through the internals object, so `TerrainSurface` never imports from `renderer/webgl-context.ts` directly.

## Renderer Changes

### WebGL2 — terrain only, core stays WebGL1

The core renderer stays on `WebGLRenderingContext` (WebGL1). This preserves compatibility with older devices for applications that don't use terrain.

#### Type-safe context inference

`RendererAPI` is extended with a narrowed subtype:

```typescript
// src/mini/core/renderer-api.ts
export interface RendererAPI {
  // ... existing methods
  setSurface(surface: Surface): void
}

export interface WebGL2RendererAPI extends RendererAPI {
  readonly __webgl2: true  // brand — prevents accidental assignment from RendererAPI
}
```

`createRenderer` uses overloads so the return type narrows based on `contextType`:

```typescript
// src/mini/renderer/index.ts
export interface RendererOptions {
  projection?: Projection
  contextType?: 'webgl' | 'webgl2'  // default: 'webgl'
}

export async function createRenderer(
  canvas: HTMLCanvasElement,
  options: RendererOptions & { contextType: 'webgl2' }
): Promise<WebGL2RendererAPI>
export async function createRenderer(
  canvas: HTMLCanvasElement,
  options?: RendererOptions
): Promise<RendererAPI>
```

`MapGL` becomes generic on the renderer type:

```typescript
// src/mini/core/map.ts
export class MapGL<R extends RendererAPI = RendererAPI> {
  readonly renderer: R

  constructor(options: MapGLOptions<R>)
  addPlugin(plugin: Plugin<R>): void
  // ... rest unchanged
}

export interface MapGLOptions<R extends RendererAPI = RendererAPI> {
  renderer: R
  initialCamera?: Partial<CameraState>
}

// Structural constraint — a plugin is compatible if its onAdd accepts R
export type Plugin<R extends RendererAPI> = {
  getElevation?: (lngLat: LngLat) => number
  renderExtension?: RenderExtension
  onAdd?: (map: MapGL<R>, renderer: R) => void
}
```

`TerrainPlugin.onAdd` is typed to require `WebGL2RendererAPI`:

```typescript
onAdd(_map: MapGL<WebGL2RendererAPI>, renderer: WebGL2RendererAPI): void {
  renderer.setSurface(this)
}
```

TypeScript enforces the constraint at the call site:

```typescript
// ✅ WebGL2 renderer — TerrainPlugin accepted
const renderer = await createRenderer(canvas, { contextType: 'webgl2' })
// renderer: WebGL2RendererAPI
const map = new MapGL({ renderer })
// map: MapGL<WebGL2RendererAPI>
map.addPlugin(new TerrainPlugin({ source: 'dem' }))  // ✓

// ❌ WebGL1 renderer — compile-time error
const renderer = await createRenderer(canvas)
// renderer: RendererAPI
const map = new MapGL({ renderer })
// map: MapGL<RendererAPI>
map.addPlugin(new TerrainPlugin({ source: 'dem' }))
// TS error: TerrainPlugin.onAdd requires WebGL2RendererAPI, not RendererAPI
```

The `__webgl2` brand on `WebGL2RendererAPI` prevents accidental structural equivalence — a plain `RendererAPI` cannot satisfy `WebGL2RendererAPI` even if it happens to have the same methods.

`WebGLContext` constructor accepts `contextType` and calls `canvas.getContext(contextType)`. When `contextType` is `'webgl2'` the `Renderer` class marks itself as `WebGL2RendererAPI` (the brand field is set at construction, not runtime-checked). All existing shaders, interfaces, and `DrawContext` remain `WebGLRenderingContext` — no migration required.

`RendererInternals.gl` is typed `WebGL2RenderingContext` since `TerrainSurface` is the only consumer of `renderTiles(internals)`. The `Renderer` casts `this._webgl.gl as WebGL2RenderingContext` when assembling internals — this is safe because `setSurface` can only be called on a `WebGL2RendererAPI`, which was created with `contextType: 'webgl2'`.

### Surface field and setSurface

`Renderer` stores `private _surface: Surface`. On construction it is set to `FLAT_SURFACE` — a module-level constant defined in `src/mini/renderer/flat-surface.ts` (NOT in `core/surface.ts`, to avoid a core-imports-renderer layering violation):

```typescript
// src/mini/renderer/flat-surface.ts
import type { Surface } from '../core/surface.ts'
import { flatRenderTiles } from './flat-render-tiles.ts'

export const FLAT_SURFACE: Surface = {
  shaderDefines: [],
  renderTiles: flatRenderTiles,
  destroy() {},
}
```

`flatRenderTiles` is the current tile loop in `renderFrame()` extracted verbatim into `src/mini/renderer/flat-render-tiles.ts`.

`RendererAPI` gains:

```typescript
setSurface(surface: Surface): void
```

When `setSurface` is called, the renderer invalidates the compiled program cache by reassigning `this._compiledPrograms = new WeakMap()` (`WeakMap` has no `.clear()` method) so that programs are recompiled with the new `shaderDefines` on the next frame.

### shaderDefines → program compilation

`_getOrCompilePrograms()` is keyed on `(projection, shaderDefines)`. When `setSurface` is called:
1. `_compiledPrograms` is cleared
2. On the next `renderFrame()`, programs recompile with `surface.shaderDefines` prepended to the vertex shader prelude

The vertex shader prelude is assembled as:
```typescript
const prelude = this._surface.shaderDefines.join('\n') + '\n' + this._projection.vertexShaderPrelude
```

`projectTileWithElevation` is defined unconditionally in the prelude but its body is:
```glsl
vec4 projectTileWithElevation(vec2 posInTile, float elevation) {
#ifdef TERRAIN3D
  // elevation offset along the up vector in world space
  return projectTile(posInTile + vec2(0.0, elevation * u_elevation_scale));
#else
  return projectTile(posInTile);
#endif
}
```

This means the flat pipeline pays zero cost — `projectTileWithElevation` compiles as an alias for `projectTile` when `TERRAIN3D` is not defined. Tree-shaking handles the import side; `#ifdef` handles the GPU side.

### renderFrame structure

```typescript
renderFrame(): void {
  // ... setup ...
  const internals: RendererInternals = { gl, camera, ... }

  // Full-frame layers (Background) always go first
  for (const { layer } of this._layers) {
    if (isFullFrameLayer(layer)) { ... }
  }

  // Delegate tile loop to surface
  this._surface.renderTiles(internals)

  this._renderExtensions.runAfterTiles(renderCtx)
  this._frameIndex++
}
```

## Plugin system change

`plugin.ts` is replaced by the `Plugin<R>` structural type defined alongside `MapGL`. The old `Plugin` interface is deleted — it was a named interface for what is now captured generically. `MapGL.addPlugin` calls `plugin.onAdd(this, this.renderer)` if present, after the existing elevation/renderExtension wiring. `this.renderer` is already `public readonly` on `MapGL`.

## TerrainPlugin

```typescript
// src/mini/layers/terrain/terrain-plugin.ts

export class TerrainPlugin {
  constructor(opts: { source: string; exaggeration?: number }) {}

  // ElevationProvider — duck-typed by CameraController
  getElevation(lngLat: LngLat): number {
    // decode DEM pixel from cached tile data for lngLat mercator position
  }

  // Surface — set on renderer via onAdd
  readonly shaderDefines = ['#define TERRAIN3D;']
  renderTiles(internals: RendererInternals): void { /* TerrainSurface logic */ }
  destroy(): void { /* free RTT pool, mesh buffers */ }

  // Plugin lifecycle — elevation wiring happens automatically via addPlugin's
  // existing getElevation duck-type check; onAdd only needs to set the surface.
  // Typed to require WebGL2RendererAPI — enforced at compile time via MapGL<R>.
  onAdd(_map: MapGL<WebGL2RendererAPI>, renderer: WebGL2RendererAPI): void {
    renderer.setSurface(this)
  }
}
```

Usage from application code:

```typescript
map.addSource('dem', {
  type: 'raster',
  url: 'https://api.maptiler.com/tiles/terrain-rgb/{z}/{x}/{y}.png?key=...',
})
map.addPlugin(new TerrainPlugin({ source: 'dem', exaggeration: 1.5 }))
```

## RTT Pipeline (TerrainPlugin.renderTiles internals)

Three passes each frame:

### Pass 1 — RTT (render tile layers to per-tile FBOs)

For each tile in `internals.tileManagers.get(source).getReadyTiles()`:
1. Bind a pooled `FramebufferObject` from `RTTPool.getOrCreate(tileKey)`
2. `gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT)`
3. Draw all tile-based layers using the same draw calls as FlatSurface, but with the FBO bound — no stencil needed (each FBO is one tile, no overlap)

### Pass 2 — Terrain mesh (drape FBO textures over 3D mesh)

For each tile:
1. Set stencil mask (ALWAYS+REPLACE, same as FlatSurface)
2. Bind the tile's FBO color texture as `u_map_texture`
3. Bind the DEM tile texture as `u_dem`
4. Draw the 32×32 grid mesh (shared VBO) with the terrain shader
5. EQUAL stencil test for subsequent layers

### Pass 3 — Direct (non-RTT layers)

Custom layers render on top directly, same as FlatSurface. Stencil disabled.

## Height Mesh and Terrain Shaders

A shared 32×32 grid (1024 quads, 1089 vertices) is uploaded once as a static VBO. Only the DEM texture and tile uniforms change per tile. All position data is in `[0,1]×[0,1]` grid space; the terrain vertex shader maps this to tile space and samples the DEM for elevation.

All terrain shaders use `#version 300 es`.

```glsl
// terrain.vert
#version 300 es
in vec2 a_pos;           // grid position [0,1]×[0,1]
uniform sampler2D u_dem;
uniform float u_exaggeration;
uniform float u_elevation_scale;
out vec2 v_uv;

void main() {
  vec4 dem = texture(u_dem, a_pos);
  // Mapbox terrain-RGB decoding
  float elevation = (dem.r * 255.0 * 65536.0
                   + dem.g * 255.0 * 256.0
                   + dem.b * 255.0) * 0.1 - 10000.0;
  vec2 tilePos = a_pos * 4096.0;
  gl_Position = projectTileWithElevation(tilePos, elevation * u_exaggeration * u_elevation_scale);
  v_uv = a_pos;
}

// terrain.frag
#version 300 es
precision mediump float;
uniform sampler2D u_map_texture;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  fragColor = texture(u_map_texture, v_uv);
}
```

## FBO Pool

```typescript
// src/mini/layers/terrain/rtt-pool.ts

class RTTPool {
  // One FBO per tile key, 512×512 RGBA8 + depth renderbuffer
  getOrCreate(key: string, internals: RendererInternals): FramebufferObject
  // Evict FBOs for keys no longer retained by any TileManager
  evict(retainedKeys: Set<string>): void
  destroy(internals: RendererInternals): void
}
```

`evict` is called each frame with the union of `tileManager.getRetainedKeys()` across all sources. This requires `TileManager` to expose a new public method:

```typescript
// src/mini/renderer/tile-manager.ts
getRetainedKeys(): Set<string> {
  return this._retainSet
}
```

## TileManager change

One new public method: `getRetainedKeys(): Set<string>` — returns the current `_retainSet`. This lets TerrainPlugin evict FBOs for tiles that are no longer retained.

## File Structure

```
src/mini/core/surface.ts                  — Surface interface, RendererInternals, FramebufferObject, MeshBuffers
src/mini/core/renderer-api.ts             — add WebGL2RendererAPI interface, setSurface()
src/mini/core/map.ts                      — MapGL<R>, MapGLOptions<R>, Plugin<R>; delete Plugin interface
src/mini/core/plugin.ts                   — deleted (replaced by Plugin<R> in map.ts)
src/mini/renderer/renderer.ts             — _surface field, setSurface(), assemble RendererInternals
src/mini/renderer/webgl-context.ts        — contextType param, createFramebuffer()
src/mini/renderer/flat-surface.ts         — FLAT_SURFACE constant
src/mini/renderer/flat-render-tiles.ts    — current tile loop extracted verbatim
src/mini/renderer/tile-manager.ts         — add getRetainedKeys()
src/mini/layers/terrain/
  terrain-plugin.ts                       — TerrainPlugin (Surface + ElevationProvider + Plugin)
  rtt-pool.ts                             — FBO pool
  terrain-mesh.ts                         — shared 32×32 grid VBO
  terrain-shaders.ts                      — terrain vert/frag GLSL strings
demo/phase7/
  main.ts                                 — map + raster layer + terrain plugin
  index.html
```

## WebGL2 scope

MapLibre carries a `WebGLRenderingContext | WebGL2RenderingContext` union throughout and uses `isWebGL2()` to branch at runtime. Mini-clean takes a cleaner stance: the **core is WebGL1, terrain is WebGL2-only**. Applications that don't use terrain continue to work on older devices unchanged. The terrain plugin verifies the context at `onAdd` and throws a descriptive error if WebGL2 is unavailable. No existing shader needs migration.

## What is explicitly out of scope

- Occlusion queries (`isOccluded`, `depthAtPoint`)
- Elevation animation smoothing
- Pan gesture terrain clamping
- Variable zoom across viewport
- Symbol layer terrain draping

These are all additive — the `Surface` interface and `TerrainPlugin` can grow to support them without touching any other file.

## Tree-shaking guarantee

`src/mini/core/surface.ts` imports nothing from `src/mini/layers/terrain/`. `Renderer` imports `FLAT_SURFACE` from `src/mini/renderer/flat-surface.ts`. An application that never calls `new TerrainPlugin(...)` will have zero terrain code in its bundle.
