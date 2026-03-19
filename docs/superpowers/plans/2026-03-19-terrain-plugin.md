# Terrain Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tree-shakeable `TerrainPlugin` that drapes raster tile layers over a 3D DEM mesh using an RTT pipeline, with compile-time WebGL2 type safety via a generic `MapGL<R>`.

**Architecture:** The renderer delegates its tile loop to a `Surface` interface. The default `FLAT_SURFACE` extracts the current tile loop verbatim. `TerrainPlugin` implements `Surface` (RTT pipeline) and `ElevationProvider` (DEM queries). `MapGL<R>` is made generic so TypeScript enforces WebGL2 requirement at the call site; core stays WebGL1.

**Tech Stack:** TypeScript, WebGL1 (core), WebGL2 (terrain opt-in), GLSL ES 3.00 (terrain shaders), Vite (demo)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/mini/core/surface.ts` | `Surface`, `RendererInternals`, `FramebufferObject`, `MeshBuffers` interfaces |
| Create | `src/mini/renderer/flat-render-tiles.ts` | Current tile loop extracted verbatim |
| Create | `src/mini/renderer/flat-surface.ts` | `FLAT_SURFACE` constant |
| Modify | `src/mini/core/renderer-api.ts` | Add `setSurface()`, add `WebGL2RendererAPI` brand interface |
| Modify | `src/mini/renderer/webgl-context.ts` | Add `contextType` param, `createFramebuffer()`, `destroyFramebuffer()` |
| Modify | `src/mini/renderer/renderer.ts` | `_surface` field, `setSurface()`, assemble `RendererInternals`, `shaderDefines` in prelude, `__webgl2` brand |
| Modify | `src/mini/renderer/index.ts` | Add `contextType` to `RendererOptions`, `createRenderer` overloads, export `WebGL2RendererAPI` |
| Modify | `src/mini/core/map.ts` | `MapGL<R>`, `MapGLOptions<R>`, `Plugin<R>` type, call `onAdd` in `addPlugin` |
| Delete | `src/mini/core/plugin.ts` | Replaced by `Plugin<R>` in `map.ts` |
| Modify | `src/mini/renderer/tile-manager.ts` | Add `getRetainedKeys(): Set<string>` |
| Create | `src/mini/layers/terrain/terrain-shaders.ts` | GLSL ES 3.00 strings for terrain vert/frag |
| Create | `src/mini/layers/terrain/terrain-mesh.ts` | 32×32 grid VBO builder |
| Create | `src/mini/layers/terrain/rtt-pool.ts` | FBO pool keyed by tile key |
| Create | `src/mini/layers/terrain/terrain-plugin.ts` | `TerrainPlugin` — Surface + ElevationProvider + Plugin |
| Create | `demo/phase7/index.html` | Demo HTML |
| Create | `demo/phase7/main.ts` | Demo entry point |

---

### Task 1: Surface interface and RendererInternals

**Files:**
- Create: `src/mini/core/surface.ts`

- [ ] **Step 1: Create `src/mini/core/surface.ts`**

```typescript
// src/mini/core/surface.ts
import type { CameraState, TileID, TileMesh, ResolvedPaintProperties } from './types.ts'
import type { Projection, Viewport } from './projection.ts'
import type { ProgramCache } from './render-extension.ts'
import type { LayerInstance, CustomLayer } from './renderer-api.ts'

export interface FramebufferObject {
  framebuffer: WebGLFramebuffer
  texture: WebGLTexture    // RGBA8, width×height
  depth: WebGLRenderbuffer
}

export interface MeshBuffers {
  vert: WebGLBuffer
  idx: WebGLBuffer
  indexCount: number
}

export interface RendererInternals {
  /** Typed as WebGL2 — safe because setSurface() can only be called on WebGL2RendererAPI. */
  gl: WebGL2RenderingContext
  camera: CameraState
  viewport: Viewport
  projection: Projection
  programs: ProgramCache
  stencilProgram: WebGLProgram
  /** Structurally typed to avoid importing renderer internals into core. */
  layers: Array<{ id: string; layer: LayerInstance }>
  tileLayers: Map<string, LayerInstance[]>
  tileManagers: Map<string, {
    getReadyTiles(): Array<{ tileID: TileID; data: Transferable }>
    getRetainedKeys(): Set<string>
  }>
  sourceTypes: Map<string, 'raster' | 'vector'>
  customLayers: CustomLayer[]
  evaluate: (layer: LayerInstance, zoom: number) => ResolvedPaintProperties
  frameIndex: number
  createFramebuffer(width: number, height: number): FramebufferObject
  destroyFramebuffer(fb: FramebufferObject): void
  getOrCreateTexture(key: string, bitmap: ImageBitmap): WebGLTexture
  getOrCreateMeshBuffers(key: string, mesh: TileMesh): MeshBuffers
  writeTileStencil(
    prog: WebGLProgram,
    vert: WebGLBuffer,
    idx: WebGLBuffer,
    count: number,
    ref: number,
  ): void
}

export interface Surface {
  /** Shader defines injected at program compile time. e.g. ['#define TERRAIN3D'] */
  readonly shaderDefines: readonly string[]
  /** Execute the tile render loop for one frame. */
  renderTiles(internals: RendererInternals): void
  /** Release GPU resources. */
  destroy(): void
}
```

- [ ] **Step 2: Type-check**

```bash
node_modules/.bin/tsc --noEmit
```

Expected: no errors (new file, no consumers yet).

- [ ] **Step 3: Commit**

```bash
git add src/mini/core/surface.ts
git commit -m "feat(mini): add Surface interface and RendererInternals"
```

---

### Task 2: Extract flat tile loop + wire Renderer

This is the largest change. Extract the current `renderFrame()` tile loop into `flatRenderTiles`, create `FLAT_SURFACE`, add WebGL framebuffer helpers to `WebGLContext`, add `_surface` field + `setSurface()` to `Renderer`, and make `renderFrame()` delegate to `this._surface.renderTiles(internals)`.

**Files:**
- Create: `src/mini/renderer/flat-render-tiles.ts`
- Create: `src/mini/renderer/flat-surface.ts`
- Modify: `src/mini/core/renderer-api.ts`
- Modify: `src/mini/renderer/webgl-context.ts`
- Modify: `src/mini/renderer/renderer.ts`

- [ ] **Step 1: Add `setSurface()` to `RendererAPI`**

In `src/mini/core/renderer-api.ts`, add `setSurface` to the `RendererAPI` interface:

```typescript
// Add at top:
import type { Surface } from './surface.ts'

// Add to RendererAPI interface:
setSurface(surface: Surface): void
```

- [ ] **Step 2: Add `createFramebuffer` and `destroyFramebuffer` to `WebGLContext`**

In `src/mini/renderer/webgl-context.ts`:

Add `contextType` parameter to the constructor (defaults to `'webgl'`):

```typescript
constructor(canvas: HTMLCanvasElement, contextType: 'webgl' | 'webgl2' = 'webgl') {
  const gl = canvas.getContext(contextType, { antialias: true, stencil: true }) as WebGLRenderingContext
  if (!gl) throw new Error(`${contextType} not supported`)
  gl.getExtension?.('OES_element_index_uint')
  this.gl = gl
  // ... rest unchanged
}
```

Add `createFramebuffer` and `destroyFramebuffer` methods (using only WebGL1 FBO APIs):

```typescript
createFramebuffer(width: number, height: number): import('../core/surface.ts').FramebufferObject {
  const { gl } = this
  const texture = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, null)

  const depth = gl.createRenderbuffer()!
  gl.bindRenderbuffer(gl.RENDERBUFFER, depth)
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height)
  gl.bindRenderbuffer(gl.RENDERBUFFER, null)

  const framebuffer = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  return { framebuffer, texture, depth }
}

destroyFramebuffer(fb: import('../core/surface.ts').FramebufferObject): void {
  const { gl } = this
  gl.deleteFramebuffer(fb.framebuffer)
  gl.deleteTexture(fb.texture)
  gl.deleteRenderbuffer(fb.depth)
}
```

- [ ] **Step 3: Create `src/mini/renderer/flat-render-tiles.ts`**

Extract the stencil tile loop + custom layers from the current `renderFrame()`. The function signature matches `Surface.renderTiles`:

```typescript
// src/mini/renderer/flat-render-tiles.ts
import type { RendererInternals } from '../core/surface.ts'

const ELEVATION_PRELUDE = /* glsl */`
vec4 projectTileWithElevation(vec2 posInTile, float elevation) {
  return projectTile(posInTile);
}
`

export { ELEVATION_PRELUDE }

export function flatRenderTiles(internals: RendererInternals): void {
  const { gl, camera, viewport, projection, programs, stencilProgram,
          layers, tileLayers, tileManagers, sourceTypes, customLayers,
          evaluate, frameIndex } = internals

  gl.enable(gl.STENCIL_TEST)
  gl.clear(gl.STENCIL_BUFFER_BIT)
  let nextStencilRef = 1

  for (const [sourceId, tileManager] of tileManagers) {
    const readyTiles = tileManager.getReadyTiles()
    const sourceLayers = tileLayers.get(sourceId) ?? []
    const sourceType = sourceTypes.get(sourceId) ?? 'raster'

    for (const { tileID, data } of readyTiles) {
      const mesh = projection.getMeshForTile(tileID)
      const meshBuffers = internals.getOrCreateMeshBuffers(tileID.key, mesh)

      const ref = nextStencilRef++
      if (nextStencilRef > 255) nextStencilRef = 1

      // Phase 1: write stencil mask
      gl.useProgram(stencilProgram)
      projection.setTileUniforms(gl as any, stencilProgram, tileID, camera, viewport)
      internals.writeTileStencil(stencilProgram, meshBuffers.vert, meshBuffers.idx, meshBuffers.indexCount, ref)

      // Phase 2: draw layers — only fragments where stencil === ref pass
      gl.stencilFunc(gl.EQUAL, ref, 0xFF)
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP)
      gl.stencilMask(0x00)

      let tileTexture: WebGLTexture | undefined
      if (sourceType === 'raster') {
        tileTexture = internals.getOrCreateTexture(tileID.key, data as ImageBitmap)
      }

      for (const layer of sourceLayers) {
        const paint = evaluate(layer, camera.zoom)
        const program = programs.get((layer.constructor as any).programs?.[0]?.name)
        if (program) {
          gl.useProgram(program)
          projection.setTileUniforms(gl as any, program, tileID, camera, viewport)
        }
        ;(layer as any).draw({
          gl,
          programs,
          tileID,
          meshBuffers,
          zoom: camera.zoom,
          paint,
          frameIndex,
          tileTexture,
          tileData: sourceType === 'vector' ? data : undefined,
          imageAtlas: {},
          lineDashAtlas: {},
        })
      }
    }
  }

  gl.disable(gl.STENCIL_TEST)

  // Custom layers — rendered after all tiles, stencil off
  if (customLayers.length > 0) {
    const WORLD_TILE = { z: 0, x: 0, y: 0, key: '0/0/0' }
    for (const layer of customLayers) {
      layer.render({
        gl: gl as any,
        camera,
        viewport,
        vertexShaderPrelude: projection.vertexShaderPrelude,
        setProjectionUniforms: (program: WebGLProgram) => {
          gl.useProgram(program)
          projection.setTileUniforms(gl as any, program, WORLD_TILE, camera, viewport)
        },
      })
    }
  }
}
```

- [ ] **Step 4: Create `src/mini/renderer/flat-surface.ts`**

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

- [ ] **Step 5: Update `src/mini/renderer/renderer.ts`**

Modify `Renderer` to:
1. Import `Surface`, `RendererInternals`, `FLAT_SURFACE`
2. Add `private _surface: Surface = FLAT_SURFACE`
3. Implement `setSurface(surface: Surface): void`
4. Add `projectTileWithElevation` prelude injection and `_compiledPrograms` invalidation
5. Move tileManager `update()` calls before assembling internals
6. Replace tile loop + custom layers in `renderFrame()` with `this._surface.renderTiles(internals)`

Key changes to imports at top of `renderer.ts`:

```typescript
import type { Surface, RendererInternals } from '../core/surface.ts'
import { FLAT_SURFACE } from './flat-surface.ts'
import { ELEVATION_PRELUDE } from './flat-render-tiles.ts'
```

Add field after `_frameIndex`:

```typescript
private _surface: Surface = FLAT_SURFACE
```

Add `setSurface` method:

```typescript
setSurface(surface: Surface): void {
  this._surface.destroy()
  this._surface = surface
  // Invalidate compiled programs — will recompile with new shaderDefines
  this._compiledPrograms = new WeakMap()
}
```

Update `_getOrCompilePrograms()` to prepend `shaderDefines` and `ELEVATION_PRELUDE`:

```typescript
private _getOrCompilePrograms(): { layers: ProgramCache; stencil: WebGLProgram } {
  if (!this._compiledPrograms.has(this._projection)) {
    const prelude = this._surface.shaderDefines.join('\n') + '\n' +
                    this._projection.vertexShaderPrelude + '\n' +
                    ELEVATION_PRELUDE
    const defs = this._layers.flatMap(e => (e.layer.constructor as any).programs ?? [])
    const layers = this._webgl.compilePrograms(defs, prelude)
    const stencil = this._webgl.compileStencilProgram(prelude)
    for (const def of defs) {
      const p = layers.get(def.name)
      if (p) this._allPrograms.push(p)
    }
    this._allPrograms.push(stencil)
    this._compiledPrograms.set(this._projection, { layers, stencil })
  }
  return this._compiledPrograms.get(this._projection)!
}
```

Replace the tile loop + custom layers section in `renderFrame()`:

```typescript
renderFrame(): void {
  const { gl } = this._webgl
  gl.viewport(0, 0, this._width, this._height)

  const camera = this._camera ?? {
    center: { lng: 0, lat: 0 },
    zoom: 0,
    bearing: 0,
    pitch: 0,
    groundElevation: 0,
  }

  const viewport: Viewport = { width: this._width, height: this._height }
  const { layers: programs, stencil: stencilProg } = this._getOrCompilePrograms()

  const renderCtx: RenderContext = {
    gl,
    programs,
    camera,
    visibleTiles: [],
    frameIndex: this._frameIndex,
  }

  this._renderExtensions.runBeforeTiles(renderCtx)

  // Full-frame layers (e.g. BackgroundLayer)
  for (const { layer } of this._layers) {
    if (isFullFrameLayer(layer)) {
      const paint = this._styleEvaluator.evaluate(layer, camera.zoom)
      layer.drawBackground({ gl, paint })
    }
  }

  // Update tile managers before delegating to surface
  for (const tm of this._tileManagers.values()) {
    tm.update(camera, viewport)
  }

  const internals: RendererInternals = {
    gl: this._webgl.gl as WebGL2RenderingContext,
    camera,
    viewport,
    projection: this._projection,
    programs,
    stencilProgram: stencilProg,
    layers: this._layers,
    tileLayers: this._tileLayers,
    tileManagers: this._tileManagers,
    sourceTypes: this._sourceTypes,
    customLayers: this._customLayers,
    evaluate: (layer, zoom) => this._styleEvaluator.evaluate(layer, zoom),
    frameIndex: this._frameIndex,
    createFramebuffer: (w, h) => this._webgl.createFramebuffer(w, h),
    destroyFramebuffer: (fb) => this._webgl.destroyFramebuffer(fb),
    getOrCreateTexture: (key, bitmap) => this._webgl.getOrCreateTexture(key, bitmap),
    getOrCreateMeshBuffers: (key, mesh) => this._webgl.getOrCreateMeshBuffers(key, mesh),
    writeTileStencil: (prog, vert, idx, count, ref) =>
      this._webgl.writeTileStencil(prog, vert, idx, count, ref),
  }

  this._surface.renderTiles(internals)

  this._renderExtensions.runAfterTiles(renderCtx)
  this._frameIndex++
}
```

Also remove the `tileManager.update(camera, viewport)` call that was inside the old per-source loop in `renderFrame()` (it's now done once above, before internals assembly).

- [ ] **Step 6: Type-check**

```bash
node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Build phase6 demo and verify it still works**

```bash
node_modules/.bin/vite build demo/phase6 --outDir ../../demo-dist-phase6 --emptyOutDir --base ./
```

Expected: builds successfully, ~57 kB bundle. Open in browser and confirm map renders normally.

- [ ] **Step 8: Commit**

```bash
git add src/mini/core/renderer-api.ts src/mini/core/surface.ts \
        src/mini/renderer/webgl-context.ts src/mini/renderer/renderer.ts \
        src/mini/renderer/flat-render-tiles.ts src/mini/renderer/flat-surface.ts
git commit -m "feat(mini): extract flat tile loop into Surface interface"
```

---

### Task 3: WebGL2 type safety + generic MapGL + Plugin<R>

**Files:**
- Modify: `src/mini/core/renderer-api.ts`
- Modify: `src/mini/renderer/renderer.ts`
- Modify: `src/mini/renderer/index.ts`
- Modify: `src/mini/core/map.ts`
- Delete: `src/mini/core/plugin.ts`

- [ ] **Step 1: Add `WebGL2RendererAPI` to `renderer-api.ts`**

Add after the `RendererAPI` interface:

```typescript
/** Branded subtype — prevents accidental structural assignment from plain RendererAPI. */
export interface WebGL2RendererAPI extends RendererAPI {
  readonly __webgl2: true
}
```

- [ ] **Step 2: Make `Renderer` carry the `__webgl2` brand at runtime**

In `renderer.ts`, add a `readonly __webgl2: boolean` field set from `contextType`. This enables both the compile-time brand narrowing AND a runtime guard in `TerrainPlugin.onAdd`.

Modify `Renderer` to store `contextType`:

```typescript
readonly __webgl2: boolean

constructor(canvas: HTMLCanvasElement, projection: Projection, contextType: 'webgl' | 'webgl2' = 'webgl') {
  this.__webgl2 = contextType === 'webgl2'
  this._webgl = new WebGLContext(canvas, contextType)
  // ... rest unchanged
}
```

`createRenderer` (in `index.ts`) casts to `WebGL2RendererAPI` when `contextType: 'webgl2'`. TypeScript is satisfied because `Renderer` structurally satisfies `WebGL2RendererAPI` when `__webgl2` is `true` (narrowed at the cast site).

- [ ] **Step 3: Update `src/mini/renderer/index.ts` — add overloads and export**

```typescript
// src/mini/renderer/index.ts
import type { RendererAPI, WebGL2RendererAPI } from '../core/renderer-api.ts'
import type { Projection } from '../core/projection.ts'
import { Renderer } from './renderer.ts'
import { MercatorProjection } from './mercator.ts'

export type { RendererAPI, WebGL2RendererAPI, CustomLayer, CustomLayerRenderArgs } from '../core/renderer-api.ts'

export interface RendererOptions {
  /** Custom projection — defaults to MercatorProjection (web mercator). */
  projection?: Projection
  /** WebGL context type — default 'webgl'. Use 'webgl2' for TerrainPlugin. */
  contextType?: 'webgl' | 'webgl2'
}

export async function createRenderer(
  canvas: HTMLCanvasElement,
  options: RendererOptions & { contextType: 'webgl2' },
): Promise<WebGL2RendererAPI>
export async function createRenderer(
  canvas: HTMLCanvasElement,
  options?: RendererOptions,
): Promise<RendererAPI>
export async function createRenderer(
  canvas: HTMLCanvasElement,
  options?: RendererOptions,
): Promise<RendererAPI> {
  const renderer = new Renderer(
    canvas,
    options?.projection ?? new MercatorProjection(),
    options?.contextType ?? 'webgl',
  )
  return renderer as unknown as RendererAPI
}
```

- [ ] **Step 4: Update `src/mini/core/map.ts` — generic MapGL + Plugin<R> + call onAdd**

Replace the entire file:

```typescript
import type { CameraState, AnimationOptions } from './types.ts'
import type { RendererAPI, LayerInstance, CustomLayer } from './renderer-api.ts'
import { CameraController } from './camera.ts'

/** Structural type — a plugin is compatible if its onAdd accepts R. */
export type Plugin<R extends RendererAPI = RendererAPI> = {
  getElevation?: (lngLat: import('./types.ts').LngLat) => number
  readonly renderExtension?: import('./render-extension.ts').RenderExtension
  onAdd?: (map: MapGL<R>, renderer: R) => void
}

export interface MapGLOptions<R extends RendererAPI = RendererAPI> {
  renderer: R
  initialCamera?: Partial<CameraState>
}

export class MapGL<R extends RendererAPI = RendererAPI> {
  readonly renderer: R
  private _camera: CameraController
  private _listeners: globalThis.Map<string, Set<Function>> = new globalThis.Map()

  constructor(options: MapGLOptions<R>) {
    this.renderer = options.renderer
    this._camera = new CameraController(
      options.initialCamera ?? {},
      {
        onChange: (state) => {
          this.renderer.setCamera(state)
          this._emit('move', state)
        },
      },
    )
    this.renderer.setCamera(this._camera.getState())
  }

  addLayer(layer: LayerInstance | CustomLayer, beforeId?: string): void {
    this.renderer.addLayer(layer, beforeId)
  }

  removeLayer(id: string): void {
    this.renderer.removeLayer(id)
  }

  addSource(id: string, source: Record<string, unknown>): void {
    this.renderer.addSource(id, source as any)
  }

  removeSource(id: string): void {
    this.renderer.removeSource(id)
  }

  getCamera(): CameraState {
    return this._camera.getState()
  }

  setCamera(state: Partial<CameraState>, options?: AnimationOptions): void {
    this._camera.setCamera(state, options)
  }

  addPlugin(plugin: Plugin<R>): void {
    if (plugin.getElevation) {
      this._camera.setElevationProvider({ getElevation: plugin.getElevation.bind(plugin) })
    }
    if (plugin.renderExtension) {
      this.renderer.addRenderExtension(plugin.renderExtension)
    }
    if (plugin.onAdd) {
      plugin.onAdd(this, this.renderer)
    }
  }

  on(event: string, handler: Function): void {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set())
    this._listeners.get(event)!.add(handler)
  }

  off(event: string, handler: Function): void {
    this._listeners.get(event)?.delete(handler)
  }

  private _emit(event: string, data: unknown): void {
    this._listeners.get(event)?.forEach((fn) => fn(data))
  }
}
```

- [ ] **Step 5: Delete `src/mini/core/plugin.ts`**

```bash
git rm src/mini/core/plugin.ts
```

- [ ] **Step 6: Type-check**

```bash
node_modules/.bin/tsc --noEmit
```

Expected: no errors. If there are import errors for `plugin.ts` elsewhere, fix them by updating the import to use `Plugin` from `map.ts`.

- [ ] **Step 7: Verify demo still builds**

```bash
node_modules/.bin/vite build demo/phase6 --outDir ../../demo-dist-phase6 --emptyOutDir --base ./
```

- [ ] **Step 8: Commit**

Note: `git rm src/mini/core/plugin.ts` (Step 5) already staged the deletion. The commit includes both staged additions and the staged deletion.

```bash
git add src/mini/core/renderer-api.ts src/mini/core/map.ts \
        src/mini/renderer/renderer.ts src/mini/renderer/index.ts
git commit -m "feat(mini): generic MapGL<R> + WebGL2RendererAPI brand + Plugin<R> type"
```

---

### Task 4: TileManager.getRetainedKeys()

**Files:**
- Modify: `src/mini/renderer/tile-manager.ts`

- [ ] **Step 1: Add `getRetainedKeys()` to `TileManager`**

`TileManager` already has `private _retainSet = new globalThis.Set<string>()` — verified against the current source. After the existing `getReadyTiles()` method, add:

```typescript
getRetainedKeys(): Set<string> {
  return this._retainSet
}
```

- [ ] **Step 2: Type-check**

```bash
node_modules/.bin/tsc --noEmit
```

Expected: no errors. The `RendererInternals.tileManagers` type already required `getRetainedKeys()`, so this resolves any structural mismatch.

- [ ] **Step 3: Commit**

```bash
git add src/mini/renderer/tile-manager.ts
git commit -m "feat(mini): add TileManager.getRetainedKeys()"
```

---

### Task 5: Terrain shaders and terrain mesh

**Files:**
- Create: `src/mini/layers/terrain/terrain-shaders.ts`
- Create: `src/mini/layers/terrain/terrain-mesh.ts`

- [ ] **Step 1: Create `src/mini/layers/terrain/terrain-shaders.ts`**

```typescript
// src/mini/layers/terrain/terrain-shaders.ts
// No #version directives here — _ensureProgram in TerrainPlugin prepends '#version 300 es\n'
// so it is always the absolute first line. GLSL ES 3.00 vertex shaders default to highp float.

export const TERRAIN_VERT = /* glsl */`
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
`

export const TERRAIN_FRAG = /* glsl */`
precision mediump float;
uniform sampler2D u_map_texture;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  fragColor = texture(u_map_texture, v_uv);
}
`
```

- [ ] **Step 2: Create `src/mini/layers/terrain/terrain-mesh.ts`**

Generates a 32×32 grid of unit-square quads. Positions in `[0,1]×[0,1]` tile space.

```typescript
// src/mini/layers/terrain/terrain-mesh.ts

const GRID_SIZE = 32  // number of quads per side; 32×32 = 1024 quads, 1089 vertices

/** Build a shared 32×32 grid mesh in [0,1]×[0,1] tile space. */
export function buildTerrainMesh(): { vertices: Float32Array; indices: Uint32Array } {
  const n = GRID_SIZE + 1  // vertices per side
  const vertices = new Float32Array(n * n * 2)
  let vi = 0
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      vertices[vi++] = x / GRID_SIZE
      vertices[vi++] = y / GRID_SIZE
    }
  }

  const indices = new Uint32Array(GRID_SIZE * GRID_SIZE * 6)
  let ii = 0
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const tl = y * n + x
      const tr = tl + 1
      const bl = tl + n
      const br = bl + 1
      indices[ii++] = tl; indices[ii++] = tr; indices[ii++] = bl
      indices[ii++] = tr; indices[ii++] = br; indices[ii++] = bl
    }
  }

  return { vertices, indices }
}
```

- [ ] **Step 3: Type-check**

```bash
node_modules/.bin/tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/mini/layers/terrain/terrain-shaders.ts src/mini/layers/terrain/terrain-mesh.ts
git commit -m "feat(mini/terrain): terrain shaders and 32×32 grid mesh"
```

---

### Task 6: RTT pool

**Files:**
- Create: `src/mini/layers/terrain/rtt-pool.ts`

- [ ] **Step 1: Create `src/mini/layers/terrain/rtt-pool.ts`**

One FBO per tile key. Evicts FBOs for keys no longer retained.

```typescript
// src/mini/layers/terrain/rtt-pool.ts
import type { FramebufferObject, RendererInternals } from '../../core/surface.ts'

const FBO_SIZE = 512

export class RTTPool {
  private _pool = new globalThis.Map<string, FramebufferObject>()
  // Stored from first getOrCreate call so evict() can destroy without needing internals.
  private _destroyFn: ((fb: FramebufferObject) => void) | null = null

  getOrCreate(key: string, internals: RendererInternals): FramebufferObject {
    if (!this._destroyFn) this._destroyFn = (fb) => internals.destroyFramebuffer(fb)
    const cached = this._pool.get(key)
    if (cached) return cached
    const fbo = internals.createFramebuffer(FBO_SIZE, FBO_SIZE)
    this._pool.set(key, fbo)
    return fbo
  }

  /** Matches spec signature — no internals param. Destroyable because _destroyFn is stored. */
  evict(retainedKeys: Set<string>): void {
    for (const [key, fbo] of this._pool) {
      if (!retainedKeys.has(key)) {
        this._destroyFn?.(fbo)
        this._pool.delete(key)
      }
    }
  }

  /** Uses stored _destroyFn — no internals arg needed, matches Surface.destroy() signature. */
  destroy(): void {
    for (const fbo of this._pool.values()) {
      this._destroyFn?.(fbo)
    }
    this._pool.clear()
    this._destroyFn = null
  }
}
```

- [ ] **Step 2: Type-check**

```bash
node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/mini/layers/terrain/rtt-pool.ts
git commit -m "feat(mini/terrain): RTT FBO pool"
```

---

### Task 7: TerrainPlugin

**Files:**
- Create: `src/mini/layers/terrain/terrain-plugin.ts`

- [ ] **Step 1: Create `src/mini/layers/terrain/terrain-plugin.ts`**

This is the largest piece. Three passes:
1. RTT: for each tile, render all tile-based layers to a per-tile FBO
2. Terrain mesh: draw 3D mesh with DEM displacement, draping FBO texture
3. Custom layers: render direct (same as flat)

```typescript
// src/mini/layers/terrain/terrain-plugin.ts
import type { LngLat, TileID } from '../../core/types.ts'
import type { RendererInternals } from '../../core/surface.ts'
import type { MapGL } from '../../core/map.ts'
import type { WebGL2RendererAPI } from '../../core/renderer-api.ts'
import type { Plugin } from '../../core/map.ts'
import { RTTPool } from './rtt-pool.ts'
import { buildTerrainMesh } from './terrain-mesh.ts'
import { TERRAIN_VERT, TERRAIN_FRAG } from './terrain-shaders.ts'
// ELEVATION_PRELUDE defines projectTileWithElevation used by TERRAIN_VERT
import { ELEVATION_PRELUDE } from '../../renderer/flat-render-tiles.ts'

const FBO_SIZE = 512
const WORLD_TILE = { z: 0, x: 0, y: 0, key: '0/0/0' }

export interface TerrainPluginOptions {
  /** Source ID of the terrain-RGB raster DEM source. */
  source: string
  /** Height exaggeration multiplier. Default 1.0. */
  exaggeration?: number
}

export class TerrainPlugin implements Plugin<WebGL2RendererAPI> {
  readonly shaderDefines = ['#define TERRAIN3D']

  private _source: string
  private _exaggeration: number
  private _rttPool = new RTTPool()
  private _terrainProgram: WebGL2Program | null = null
  private _meshVert: WebGLBuffer | null = null
  private _meshIdx: WebGLBuffer | null = null
  private _meshIndexCount = 0
  private _gl: WebGL2RenderingContext | null = null  // set on first renderTiles call

  constructor(opts: TerrainPluginOptions) {
    this._source = opts.source
    this._exaggeration = opts.exaggeration ?? 1.0
  }

  // ElevationProvider — duck-typed by CameraController
  getElevation(_lngLat: LngLat): number {
    // TODO: decode DEM pixel from cached tile data for lngLat mercator position.
    // Returns 0 until implemented; camera clamping still works (just flat).
    return 0
  }

  // Surface — set on renderer via onAdd
  renderTiles(internals: RendererInternals): void {
    const { gl } = internals
    this._gl = gl  // store for destroy()

    this._ensureMesh(gl)
    this._ensureProgram(internals)

    const demManager = internals.tileManagers.get(this._source)
    if (!demManager) return

    // Compute union of retained keys for FBO eviction
    const allRetained = new globalThis.Set<string>()
    for (const tm of internals.tileManagers.values()) {
      for (const key of tm.getRetainedKeys()) allRetained.add(key)
    }
    this._rttPool.evict(allRetained)

    const demTiles = demManager.getReadyTiles()

    // ── Pass 1: RTT ──────────────────────────────────────────────────────────
    // Render all tile-based layers to per-tile FBOs. No stencil needed (one FBO = one tile).
    for (const { tileID } of demTiles) {
      const fbo = this._rttPool.getOrCreate(tileID.key, internals)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.framebuffer)
      gl.viewport(0, 0, FBO_SIZE, FBO_SIZE)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

      for (const [sourceId, tileManager] of internals.tileManagers) {
        if (sourceId === this._source) continue  // DEM source — not a visual layer
        const sourceLayers = internals.tileLayers.get(sourceId) ?? []
        const sourceType = internals.sourceTypes.get(sourceId) ?? 'raster'
        const readyTiles = tileManager.getReadyTiles()

        for (const { tileID: srcTileID, data } of readyTiles) {
          if (srcTileID.key !== tileID.key) continue  // only the matching tile

          const mesh = internals.projection.getMeshForTile(srcTileID)
          const meshBuffers = internals.getOrCreateMeshBuffers(srcTileID.key, mesh)

          let tileTexture: WebGLTexture | undefined
          if (sourceType === 'raster') {
            tileTexture = internals.getOrCreateTexture(srcTileID.key, data as ImageBitmap)
          }

          for (const layer of sourceLayers) {
            const paint = internals.evaluate(layer, internals.camera.zoom)
            const program = internals.programs.get((layer.constructor as any).programs?.[0]?.name)
            if (program) {
              gl.useProgram(program)
              internals.projection.setTileUniforms(
                gl as any, program, srcTileID, internals.camera, internals.viewport,
              )
            }
            ;(layer as any).draw({
              gl,
              programs: internals.programs,
              tileID: srcTileID,
              meshBuffers,
              zoom: internals.camera.zoom,
              paint,
              frameIndex: internals.frameIndex,
              tileTexture,
              tileData: sourceType === 'vector' ? data : undefined,
              imageAtlas: {},
              lineDashAtlas: {},
            })
          }
        }
      }
    }

    // Restore default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, internals.viewport.width, internals.viewport.height)

    // ── Pass 2: Terrain mesh ─────────────────────────────────────────────────
    // Draw 3D terrain mesh per tile, draping FBO texture over DEM displacement.
    const prog = this._terrainProgram!
    gl.useProgram(prog)

    gl.enable(gl.STENCIL_TEST)
    gl.clear(gl.STENCIL_BUFFER_BIT)
    let nextRef = 1

    for (const { tileID, data: demData } of demTiles) {
      const fbo = this._rttPool.getOrCreate(tileID.key, internals)

      // Write stencil for this tile using terrain mesh bounds
      const mesh = internals.projection.getMeshForTile(tileID)
      const meshBuffers = internals.getOrCreateMeshBuffers(tileID.key, mesh)
      internals.writeTileStencil(
        internals.stencilProgram, meshBuffers.vert, meshBuffers.idx, meshBuffers.indexCount, nextRef,
      )
      gl.stencilFunc(gl.EQUAL, nextRef, 0xFF)
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP)
      gl.stencilMask(0x00)
      nextRef++
      if (nextRef > 255) nextRef = 1

      internals.projection.setTileUniforms(gl as any, prog, tileID, internals.camera, internals.viewport)

      // u_map_texture = FBO color texture (rendered tile layers)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, fbo.texture)
      gl.uniform1i(gl.getUniformLocation(prog, 'u_map_texture'), 0)

      // u_dem = DEM tile texture
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, internals.getOrCreateTexture(tileID.key + ':dem', demData as ImageBitmap))
      gl.uniform1i(gl.getUniformLocation(prog, 'u_dem'), 1)

      gl.uniform1f(gl.getUniformLocation(prog, 'u_exaggeration'), this._exaggeration)
      // u_elevation_scale: convert meters to tile units (rough constant; refine if needed)
      gl.uniform1f(gl.getUniformLocation(prog, 'u_elevation_scale'), 1.0 / 4096.0)

      // Draw terrain mesh
      gl.bindBuffer(gl.ARRAY_BUFFER, this._meshVert!)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._meshIdx!)
      const aPos = gl.getAttribLocation(prog, 'a_pos')
      gl.enableVertexAttribArray(aPos)
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
      gl.drawElements(gl.TRIANGLES, this._meshIndexCount, gl.UNSIGNED_INT, 0)
    }

    gl.disable(gl.STENCIL_TEST)

    // ── Pass 3: Custom layers ────────────────────────────────────────────────
    if (internals.customLayers.length > 0) {
      for (const layer of internals.customLayers) {
        layer.render({
          gl: gl as any,
          camera: internals.camera,
          viewport: internals.viewport,
          vertexShaderPrelude: internals.projection.vertexShaderPrelude,
          setProjectionUniforms: (program: WebGLProgram) => {
            gl.useProgram(program)
            internals.projection.setTileUniforms(gl as any, program, WORLD_TILE, internals.camera, internals.viewport)
          },
        })
      }
    }
  }

  destroy(): void {
    // Free RTT FBOs — RTTPool.destroy() uses internally stored _destroyFn (no internals needed).
    this._rttPool.destroy()
    // Free mesh buffers and program if we have the gl context from a previous renderTiles call.
    if (this._gl) {
      if (this._meshVert) this._gl.deleteBuffer(this._meshVert)
      if (this._meshIdx) this._gl.deleteBuffer(this._meshIdx)
      if (this._terrainProgram) this._gl.deleteProgram(this._terrainProgram)
    }
    this._terrainProgram = null
    this._meshVert = null
    this._meshIdx = null
    this._gl = null
  }

  // Plugin<WebGL2RendererAPI> lifecycle
  onAdd(_map: MapGL<WebGL2RendererAPI>, renderer: WebGL2RendererAPI): void {
    // Runtime guard — spec requires a descriptive error if WebGL2 is unavailable.
    if (!renderer.__webgl2) {
      throw new Error(
        'TerrainPlugin requires a WebGL2 renderer. ' +
        'Create the renderer with { contextType: "webgl2" }.',
      )
    }
    renderer.setSurface(this)
  }

  private _ensureMesh(gl: WebGL2RenderingContext): void {
    if (this._meshVert) return
    const { vertices, indices } = buildTerrainMesh()

    const vert = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, vert)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

    const idx = gl.createBuffer()!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)

    this._meshVert = vert
    this._meshIdx = idx
    this._meshIndexCount = indices.length
  }

  private _ensureProgram(internals: RendererInternals): void {
    if (this._terrainProgram) return
    const { gl } = internals
    // Assemble prelude: shaderDefines + projection prelude + ELEVATION_PRELUDE.
    // ELEVATION_PRELUDE defines projectTileWithElevation which TERRAIN_VERT calls.
    // '#version 300 es' must be the FIRST line — prepend before everything.
    const prelude = this.shaderDefines.join('\n') + '\n' +
                    internals.projection.vertexShaderPrelude + '\n' +
                    ELEVATION_PRELUDE
    const vert = this._compileShader(gl, gl.VERTEX_SHADER, '#version 300 es\n' + prelude + '\n' + TERRAIN_VERT)
    const frag = this._compileShader(gl, gl.FRAGMENT_SHADER, '#version 300 es\n' + TERRAIN_FRAG)
    const prog = gl.createProgram()!
    gl.attachShader(prog, vert)
    gl.attachShader(prog, frag)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Terrain program link error: ${gl.getProgramInfoLog(prog)}`)
    }
    this._terrainProgram = prog as unknown as WebGL2Program
  }

  private _compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Terrain shader compile error: ${gl.getShaderInfoLog(shader)}`)
    }
    return shader
  }
}

// Internal alias — WebGLProgram works at runtime; alias avoids confusion with WebGL1 programs
type WebGL2Program = WebGLProgram
```

> **Note on DEM texture key:** DEM tiles are stored in the texture cache with key `tileID.key + ':dem'` to avoid collision with raster tile textures that use the same `tileID.key`. This is important when a raster source and the DEM source share tile coordinates.

> **Note:** `terrain-shaders.ts` (created in Task 5) already omits `#version 300 es` from both strings — `_ensureProgram` prepends it above so it's always the first line. GLSL ES 3.00 vertex shaders default to highp float so no `precision` directive is needed in the vert string.

- [ ] **Step 2: Update `flat-render-tiles.ts` — add `#ifdef TERRAIN3D` guard to `projectTileWithElevation`**

The `ELEVATION_PRELUDE` exported from `flat-render-tiles.ts` should use `#ifdef` so the flat path compiles cleanly even when `TERRAIN3D` is not defined:

```typescript
export const ELEVATION_PRELUDE = /* glsl */`
vec4 projectTileWithElevation(vec2 posInTile, float elevation) {
#ifdef TERRAIN3D
  // elevation offset along tile-space y axis
  return projectTile(posInTile + vec2(0.0, elevation * u_elevation_scale));
#else
  return projectTile(posInTile);
#endif
}
`
```

- [ ] **Step 3: Type-check**

```bash
node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/mini/layers/terrain/terrain-plugin.ts \
        src/mini/renderer/flat-render-tiles.ts
git commit -m "feat(mini/terrain): TerrainPlugin with RTT pipeline"
```

---

### Task 8: Demo phase7

A simple mercator map with a raster base layer + terrain DEM plugin.

**Files:**
- Create: `demo/phase7/index.html`
- Create: `demo/phase7/main.ts`

> **Note:** You will need a MapTiler API key or alternative terrain-RGB tile source. The demo uses a placeholder `YOUR_MAPTILER_KEY` — replace with a real key or a public terrain-RGB endpoint before running.

- [ ] **Step 1: Create `demo/phase7/index.html`**

Copy `demo/phase6/index.html`, update title and phase badge to "Phase 7 — 3D Terrain".

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Phase 7 — 3D Terrain</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #111; color: #eee; font-family: system-ui, sans-serif; display: flex; height: 100vh; }
    canvas { display: block; flex: 1; }
    #sidebar {
      width: 220px; padding: 16px; background: #1a1a1a;
      border-left: 1px solid #2a2a2a; display: flex; flex-direction: column; gap: 16px;
    }
    .back { font-size: 11px; opacity: 0.4; text-decoration: none; color: inherit; }
    .back:hover { opacity: 0.8; }
    .phase-badge { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.3; }
    h2 { font-size: 14px; }
    label { font-size: 12px; opacity: 0.6; display: block; margin-bottom: 4px; }
    input[type=range] { width: 100%; accent-color: #4af; }
    .field { display: flex; flex-direction: column; gap: 2px; }
    .value { font-size: 11px; opacity: 0.4; }
    #status { font-size: 11px; opacity: 0.35; margin-top: auto; }
  </style>
</head>
<body>
  <canvas id="map"></canvas>
  <div id="sidebar">
    <a class="back" href="../">← all demos</a>
    <div>
      <div class="phase-badge">Phase 7</div>
      <h2>3D Terrain</h2>
    </div>
    <div class="field">
      <label>Zoom</label>
      <input type="range" id="zoom" min="4" max="12" step="0.1" value="8" />
      <span class="value" id="zoom-val">8.0</span>
    </div>
    <div class="field">
      <label>Pitch</label>
      <input type="range" id="pitch" min="0" max="75" step="1" value="45" />
      <span class="value" id="pitch-val">45°</span>
    </div>
    <div class="field">
      <label>Exaggeration</label>
      <input type="range" id="exaggeration" min="0.5" max="4" step="0.1" value="1.5" />
      <span class="value" id="exaggeration-val">1.5×</span>
    </div>
    <div id="status">Initializing…</div>
  </div>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create `demo/phase7/main.ts`**

```typescript
import { createRenderer } from '../../src/mini/renderer/index.ts'
import { MapGL } from '../../src/mini/core/map.ts'
import { BackgroundLayer } from '../../src/mini/layers/background.ts'
import { RasterLayer } from '../../src/mini/layers/raster.ts'
import { TerrainPlugin } from '../../src/mini/layers/terrain/terrain-plugin.ts'

const canvas = document.getElementById('map') as HTMLCanvasElement
const status = document.getElementById('status')!

function resize() {
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * devicePixelRatio
  canvas.height = rect.height * devicePixelRatio
}
resize()
window.addEventListener('resize', resize)

// WebGL2 context required for terrain
const renderer = await createRenderer(canvas, { contextType: 'webgl2' })
const map = new MapGL({
  renderer,
  initialCamera: {
    // Swiss Alps — good terrain showcase
    center: { lng: 8.0, lat: 46.5 },
    zoom: 8,
    bearing: 0,
    pitch: 45,
    groundElevation: 0,
  },
})

map.addLayer(new BackgroundLayer({ color: '#87CEEB', opacity: 1 }))

map.addSource('osm', {
  type: 'raster',
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
})
map.addLayer(new RasterLayer({ source: 'osm', opacity: 1.0 }))

// DEM source — terrain-RGB encoded elevation
// Replace YOUR_MAPTILER_KEY with a real key from maptiler.com
map.addSource('dem', {
  type: 'raster',
  url: 'https://api.maptiler.com/tiles/terrain-rgb/{z}/{x}/{y}.png?key=YOUR_MAPTILER_KEY',
})

const terrain = new TerrainPlugin({ source: 'dem', exaggeration: 1.5 })
map.addPlugin(terrain)

status.textContent = 'Ready — 3D terrain'

// Controls
const zoomInput = document.getElementById('zoom') as HTMLInputElement
const zoomVal = document.getElementById('zoom-val')!
const pitchInput = document.getElementById('pitch') as HTMLInputElement
const pitchVal = document.getElementById('pitch-val')!
const exaggerationInput = document.getElementById('exaggeration') as HTMLInputElement
const exaggerationVal = document.getElementById('exaggeration-val')!

zoomInput.addEventListener('input', () => {
  map.setCamera({ zoom: parseFloat(zoomInput.value) })
  zoomVal.textContent = parseFloat(zoomInput.value).toFixed(1)
})

pitchInput.addEventListener('input', () => {
  map.setCamera({ pitch: parseFloat(pitchInput.value) })
  pitchVal.textContent = parseFloat(pitchInput.value).toFixed(0) + '°'
})

exaggerationInput.addEventListener('input', () => {
  const v = parseFloat(exaggerationInput.value)
  exaggerationVal.textContent = v.toFixed(1) + '×'
  // TerrainPlugin doesn't support live exaggeration update yet — reload to see change
})

map.on('move', (state: { zoom: number; pitch: number }) => {
  zoomInput.value = String(state.zoom.toFixed(1))
  zoomVal.textContent = state.zoom.toFixed(1)
  pitchInput.value = String(state.pitch.toFixed(0))
  pitchVal.textContent = state.pitch.toFixed(0) + '°'
})
```

- [ ] **Step 3: Build demo**

```bash
node_modules/.bin/vite build demo/phase7 --outDir ../../demo-dist-phase7 --emptyOutDir --base ./
```

Expected: builds successfully.

- [ ] **Step 4: Type-check the whole project**

```bash
node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add demo/phase7/
git commit -m "feat(mini): phase7 demo — 3D terrain with MapTiler DEM"
```

---

## Final verification

- [ ] All files type-check: `node_modules/.bin/tsc --noEmit`
- [ ] Phase 6 demo still builds: `node_modules/.bin/vite build demo/phase6 --outDir ../../demo-dist-phase6 --emptyOutDir --base ./`
- [ ] Phase 7 demo builds: `node_modules/.bin/vite build demo/phase7 --outDir ../../demo-dist-phase7 --emptyOutDir --base ./`
- [ ] Tree-shaking check: a bundle that only imports `createRenderer`, `MapGL`, `RasterLayer` (no `TerrainPlugin`) contains zero terrain code
- [ ] `git log --oneline` shows 8 clean commits

## Known limitations / future work

These are explicitly out of scope per the spec and can be added without touching any files outside `terrain-plugin.ts`:

- `getElevation()` stub returns 0 — implement proper DEM tile lookup for camera elevation clamping
- Live exaggeration change — add a setter on `TerrainPlugin` that updates the uniform
- Occlusion queries, elevation animation smoothing, symbol terrain draping
