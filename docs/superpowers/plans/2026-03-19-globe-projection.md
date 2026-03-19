# Globe Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add globe projection to maplibre-mini so raster tiles render on a 3D sphere, using MapLibre's subdivision and shader math copied verbatim.

**Architecture:** A new `Projection` interface method trio (`vertexShaderPrelude`, `setTileUniforms`, `getMeshForTile`) lets the renderer stay projection-agnostic. Programs are compiled per-projection instance (WeakMap cache) with the prelude prepended to every vertex shader. The stencil mask and raster tile rendering use subdivided tile meshes from the projection so the globe surface looks correct at all zoom levels.

**Tech Stack:** WebGL 1, TypeScript, Vitest, MapLibre subdivision math (copied verbatim)

**Spec:** `docs/superpowers/specs/2026-03-19-globe-projection-design.md`
**MapLibre source:** `/Users/puckey/rg/maplibre-gl-js`

---

## File Map

### New files
```
src/mini/renderer/globe/
  subdivision_granularity_settings.ts  — copied verbatim from MapLibre
  subdivision.ts                        — copied, patch EXTENT=4096, stub CanonicalTileID
  globe-utils.ts                        — copied, replace gl-matrix/util imports with inline helpers
  globe-prelude.glsl.ts                 — copied _projection_globe.vertex.glsl, add missing uniform decl
  globe-transform.ts                    — extract globe camera matrix math from MapLibre (not full class)
  globe-projection.ts                   — GlobeProjection class (~150 lines)
demo/phase6/index.html                  — globe demo with raster tiles
```

### Modified files
```
src/mini/core/types.ts                  — add TileMesh; remove matrix from DrawContext; add meshBuffers
src/mini/core/render-extension.ts       — remove TileMesh (moved to types.ts), re-export it
src/mini/core/projection.ts             — expand Projection interface (3 new members)
src/mini/renderer/mercator.ts           — add vertexShaderPrelude, setTileUniforms, getMeshForTile
src/mini/renderer/mercator.test.ts      — tests for the 3 new methods
src/mini/renderer/webgl-context.ts      — compilePrograms(prelude), compileStencilProgram, getOrCreateMeshBuffers, new writeTileStencil
src/mini/renderer/webgl-context.test.ts — update mock + tests
src/mini/renderer/renderer.ts           — WeakMap program cache, meshBuffers in DrawContext, setTileUniforms
src/mini/renderer/renderer.test.ts      — update mock + assertions
src/mini/integration.test.ts            — update mock
src/mini/layers/raster.ts              — use projectTile() shader, v_uv=a_pos/4096, use meshBuffers, remove onAdd
src/mini/layers/raster.test.ts          — update tests
src/mini/layers/fill.ts                 — use projectTile() shader, remove u_matrix uniform set
src/mini/layers/fill.test.ts            — update tests
src/mini/layers/line.ts                 — use projectTile() shader, remove u_matrix uniform set
src/mini/layers/line.test.ts            — update tests
```

---

## Task 1: Copy + adapt MapLibre files

**Files:**
- Create: `src/mini/renderer/globe/subdivision_granularity_settings.ts`
- Create: `src/mini/renderer/globe/subdivision.ts`
- Create: `src/mini/renderer/globe/globe-utils.ts`
- Create: `src/mini/renderer/globe/globe-prelude.glsl.ts`

No tests for copied files. Run type-check after.

- [ ] **Step 1: Copy `subdivision_granularity_settings.ts` verbatim**

```bash
cp /Users/puckey/rg/maplibre-gl-js/src/render/subdivision_granularity_settings.ts \
   src/mini/renderer/globe/subdivision_granularity_settings.ts
```

- [ ] **Step 2: Copy and patch `subdivision.ts`**

```bash
cp /Users/puckey/rg/maplibre-gl-js/src/render/subdivision.ts \
   src/mini/renderer/globe/subdivision.ts
```

Open `src/mini/renderer/globe/subdivision.ts` and apply these patches:

**Replace the imports block** (everything at the top before the first `export`) with:
```typescript
import earcut from 'earcut'  // keep — used internally by subdividePolygon
import Point from '@mapbox/point-geometry'
import type { SubdivisionGranularityExpression } from './subdivision_granularity_settings.ts'

// Mini uses 4096 tile extent (MVT default); MapLibre uses 8192
const EXTENT = 4096

// Minimal CanonicalTileID stub matching MapLibre's interface
interface CanonicalTileID { z: number; x: number; y: number }
```

Remove lines that import from `'../data/extent'`, `'../source/tile_id'`, or `'./subdivision_granularity_settings'` (the last one is now local).

**Also remove the `register` import and its call sites:**
- Delete: `import {register} from '../util/web_worker_transfer'`
- Delete any `register(...)` call lines at the bottom of the file (they register types for worker transfer — not needed in mini)

- [ ] **Step 3: Create `globe-utils.ts` — copy and adapt**

Read `/Users/puckey/rg/maplibre-gl-js/src/geo/projection/globe_utils.ts`. Copy it to `src/mini/renderer/globe/globe-utils.ts`.

Replace the import block at the top with:
```typescript
import {vec3, mat4} from 'gl-matrix'
import type {LngLat} from '../../core/types.ts'

// Inline helpers from MapLibre's util.ts
function clamp(n: number, lo: number, hi: number): number { return Math.min(Math.max(n, lo), hi) }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }
function wrap(n: number, min: number, max: number): number {
  const d = max - min
  const w = ((n - min) % d + d) % d + min
  return w === min ? max : w
}
const mercatorYfromLat = (lat: number) =>
  -Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI

const DEG_TO_RAD = Math.PI / 180
```

Remove any remaining imports that reference MapLibre internals (`../../util/util`, `../mercator_coordinate`, `../../source/tile_id`, etc.). Inline the imported functions if used, or remove unused imports.

**Important:** Explicitly preserve `getGlobeRadiusPixels(worldSize: number, latitudeDegrees: number): number` — it is used by `globe-transform.ts`. Do not remove it during the cleanup sweep.

Add `gl-matrix` as a dependency if not already present:
```bash
npm install gl-matrix
```

- [ ] **Step 4: Create `globe-prelude.glsl.ts`**

This wraps MapLibre's globe vertex shader snippet as a TypeScript string. It also adds the missing `u_projection_matrix` uniform declaration (normally injected from MapLibre's `_prelude.vertex.glsl`).

Copy the content of `/Users/puckey/rg/maplibre-gl-js/src/shaders/_projection_globe.vertex.glsl` and create:

```typescript
// src/mini/renderer/globe/globe-prelude.glsl.ts
// Copied verbatim from MapLibre's _projection_globe.vertex.glsl.
// u_projection_matrix declaration added (normally comes from MapLibre's _prelude.vertex.glsl).

export const GLOBE_PRELUDE = /* glsl */`
#define PI 3.141592653589793
#define GLOBE_RADIUS 6371008.8

uniform highp mat4 u_projection_matrix;
uniform highp vec4 u_projection_tile_mercator_coords;
uniform highp vec4 u_projection_clipping_plane;
uniform highp float u_projection_transition;
uniform mat4 u_projection_fallback_matrix;

` + /* paste full content of _projection_globe.vertex.glsl here */ `
`
```

Paste the complete contents of `_projection_globe.vertex.glsl` into the template literal above, replacing the comment.

- [ ] **Step 5: Type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | head -40
```

Fix any import errors introduced by the copied files. Common issues:
- Missing `@mapbox/point-geometry` types → already a dependency, check `package.json`
- `gl-matrix` not installed → `npm install gl-matrix`
- Remaining MapLibre-specific types → replace with inline stubs

- [ ] **Step 6: Commit**

```bash
git add src/mini/renderer/globe/
git commit -m "feat(globe): copy + adapt MapLibre subdivision and globe math files"
```

---

## Task 2: Expand core types and Projection interface

**Files:**
- Modify: `src/mini/core/types.ts`
- Modify: `src/mini/core/render-extension.ts`
- Modify: `src/mini/core/projection.ts`

- [ ] **Step 1: Move `TileMesh` to `types.ts`**

Add to `src/mini/core/types.ts`:
```typescript
export interface TileMesh {
  vertices: Float32Array  // MVT coords [0,4096], interleaved xy
  indices: Uint16Array
}
```

- [ ] **Step 2: Update `DrawContext` in `render-extension.ts`**

Replace `matrix: Float32Array` with `meshBuffers`:

```typescript
// render-extension.ts — DrawContext
export interface DrawContext {
  gl: WebGLRenderingContext
  programs: ProgramCache
  tileID: TileID
  /** Vertex + index buffers for the tile mesh (flat quad for mercator, subdivided for globe). */
  meshBuffers: { vert: WebGLBuffer; idx: WebGLBuffer; indexCount: number }
  zoom: number
  paint: ResolvedPaintProperties
  frameIndex: number
  imageAtlas: ImageAtlas
  lineDashAtlas: LineDashAtlas
  tileTexture?: WebGLTexture
  tileData?: Transferable
}
```

Also replace the `TileMesh` definition in `render-extension.ts` with a re-export:
```typescript
export type { TileMesh } from './types.ts'
```

- [ ] **Step 3: Expand `Projection` interface**

Replace `src/mini/core/projection.ts` with:
```typescript
import type { CameraState, TileID, TileMesh } from './types.ts'

export interface Viewport {
  width: number
  height: number
}

export interface Projection {
  /**
   * GLSL prepended to every layer vertex shader AND the stencil shader.
   * Must define: vec4 projectTile(vec2 pos)
   */
  readonly vertexShaderPrelude: string

  /** Tile IDs visible in the current camera + viewport */
  getVisibleTiles(camera: CameraState, viewport: Viewport): TileID[]

  /**
   * Set all projection-specific uniforms for a tile on a compiled program.
   * Called by the renderer before each layer.draw() and before writeTileStencil.
   * Mercator: sets u_matrix.
   * Globe: sets u_projection_matrix, u_projection_tile_mercator_coords,
   *        u_projection_clipping_plane, u_projection_transition.
   */
  setTileUniforms(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    tileID: TileID,
    camera: CameraState,
    viewport: Viewport,
  ): void

  /**
   * Returns the tile mesh for this tile.
   * Mercator: static flat quad [0,4096]² (no allocation per call).
   * Globe: subdivided curved mesh, cached by tileID.key.
   */
  getMeshForTile(tileID: TileID): TileMesh
}
```

- [ ] **Step 4: Run type-check — expect errors in mercator.ts and renderer.ts (interface not yet implemented)**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep -v node_modules | head -30
```

These errors are expected and will be fixed in Tasks 3–5.

- [ ] **Step 5: Commit**

```bash
git add src/mini/core/
git commit -m "refactor(mini): expand Projection interface + TileMesh in types, meshBuffers in DrawContext"
```

---

## Task 3: Update `WebGLContext`

The three changes here are:
1. `compilePrograms(defs, vertexPrelude?)` — returns a `ProgramCache` instead of storing globally
2. `compileStencilProgram(vertexPrelude)` — compiles the stencil shader with the given prelude
3. `getOrCreateMeshBuffers(key, mesh)` — creates/caches VBO+IBO for a TileMesh
4. `writeTileStencil(program, vertBuf, idxBuf, indexCount, ref)` — uses external buffers + program

**Files:**
- Modify: `src/mini/renderer/webgl-context.ts`
- Modify: `src/mini/renderer/webgl-context.test.ts`

- [ ] **Step 1: Write failing tests for new WebGLContext API**

Add to `src/mini/renderer/webgl-context.test.ts`. The mock already has the required GL methods from the stencil work. Add these missing constants + methods to the mock helper at the top of the file:
```typescript
// Add to the gl mock in makeGLMock() or the constructor test section:
ELEMENT_ARRAY_BUFFER: 34963,
UNSIGNED_SHORT: 5123,
TRIANGLES: 4,
drawElements: vi.fn(),
```

Add test cases:
```typescript
describe('compilePrograms with prelude', () => {
  it('prepends prelude to vertex shader before compiling', () => {
    const ctx = new WebGLContext(canvas as any)
    const prelude = 'vec4 projectTile(vec2 p) { return vec4(p, 0.0, 1.0); }'
    const def = { name: 'test', vertex: 'void main(){}', fragment: 'void main(){}' }
    const cache = ctx.compilePrograms([def], prelude)
    expect(cache.get('test')).toBeDefined()
    // vertex source passed to shaderSource should contain the prelude
    const calls = (gl.shaderSource as any).mock.calls
    const vertCall = calls.find((c: any[]) => c[1].includes('projectTile'))
    expect(vertCall).toBeDefined()
  })

  it('returns ProgramCache with the compiled program', () => {
    const ctx = new WebGLContext(canvas as any)
    const cache = ctx.compilePrograms([{ name: 'p', vertex: '', fragment: '' }], '')
    expect(typeof cache.get).toBe('function')
    expect(cache.get('p')).toBeDefined()
  })
})

describe('compileStencilProgram', () => {
  it('returns a WebGLProgram', () => {
    const ctx = new WebGLContext(canvas as any)
    const prog = ctx.compileStencilProgram('vec4 projectTile(vec2 p){return vec4(p,0,1);}')
    expect(prog).toBeDefined()
  })
})

describe('getOrCreateMeshBuffers', () => {
  it('creates vertex and index buffers for a mesh', () => {
    const ctx = new WebGLContext(canvas as any)
    const mesh = {
      vertices: new Float32Array([0, 0, 4096, 0, 0, 4096, 4096, 4096]),
      indices: new Uint16Array([0, 1, 2, 1, 3, 2]),
    }
    const bufs = ctx.getOrCreateMeshBuffers('test-tile', mesh)
    expect(bufs.vert).toBeDefined()
    expect(bufs.idx).toBeDefined()
    expect(bufs.indexCount).toBe(6)
  })

  it('returns the same buffers on second call (cached)', () => {
    const ctx = new WebGLContext(canvas as any)
    const mesh = { vertices: new Float32Array([0,0,4096,0,0,4096,4096,4096]), indices: new Uint16Array([0,1,2,1,3,2]) }
    const a = ctx.getOrCreateMeshBuffers('k', mesh)
    const b = ctx.getOrCreateMeshBuffers('k', mesh)
    expect(a.vert).toBe(b.vert)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/webgl-context.test.ts 2>&1 | tail -15
```

Expected: failures on `compilePrograms with prelude`, `compileStencilProgram`, `getOrCreateMeshBuffers`.

- [ ] **Step 3: Implement the changes in `webgl-context.ts`**

Replace the full file with:

```typescript
import type { ProgramDefinition, TileMesh } from '../core/types.ts'
import type { ProgramCache } from '../core/render-extension.ts'

export class WebGLContext {
  readonly gl: WebGLRenderingContext
  private _textures = new globalThis.Map<string, WebGLTexture>()
  private _geometryBuffers = new globalThis.Map<string, WebGLBuffer>()
  private _meshBuffers = new globalThis.Map<string, { vert: WebGLBuffer; idx: WebGLBuffer; indexCount: number }>()
  readonly quadBuffer: WebGLBuffer

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { antialias: true, stencil: true })
    if (!gl) throw new Error('WebGL not supported')
    gl.getExtension?.('OES_element_index_uint')
    this.gl = gl

    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)
    this.quadBuffer = buf
  }

  /**
   * Compile programs with a projection vertex shader prelude prepended.
   * Returns a fresh ProgramCache — caller owns it (one per projection instance).
   */
  compilePrograms(defs: ProgramDefinition[], vertexPrelude = ''): ProgramCache {
    const map = new globalThis.Map<string, WebGLProgram>()
    for (const def of defs) {
      map.set(def.name, this._compile(vertexPrelude + '\n' + def.vertex, def.fragment))
    }
    return { get: (name) => map.get(name) }
  }

  /**
   * Compile the stencil mask shader with the given projection prelude.
   * Stencil vertex shader calls projectTile(a_pos) — defined by the prelude.
   */
  compileStencilProgram(vertexPrelude: string): WebGLProgram {
    const vert = vertexPrelude + '\n' +
      'attribute vec2 a_pos;\nvoid main() { gl_Position = projectTile(a_pos); }'
    const frag = 'precision mediump float; void main() { gl_FragColor = vec4(0.0); }'
    return this._compile(vert, frag)
  }

  /**
   * Write tile stencil mask using a projection-specific program and mesh.
   * setTileUniforms must be called on the program before this (to set u_matrix / globe uniforms).
   */
  writeTileStencil(
    program: WebGLProgram,
    vertBuf: WebGLBuffer,
    idxBuf: WebGLBuffer,
    indexCount: number,
    ref: number,
  ): void {
    const { gl } = this
    gl.colorMask(false, false, false, false)
    gl.stencilFunc(gl.ALWAYS, ref, 0xFF)
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)
    gl.stencilMask(0xFF)
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBuf)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf)
    const aPos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0)
    gl.colorMask(true, true, true, true)
    gl.stencilMask(0x00)
  }

  getOrCreateMeshBuffers(
    key: string,
    mesh: TileMesh,
  ): { vert: WebGLBuffer; idx: WebGLBuffer; indexCount: number } {
    const cached = this._meshBuffers.get(key)
    if (cached) return cached
    const { gl } = this
    const vert = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, vert)
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW)
    const idx = gl.createBuffer()!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW)
    const entry = { vert, idx, indexCount: mesh.indices.length }
    this._meshBuffers.set(key, entry)
    return entry
  }

  destroyMeshBuffers(key: string): void {
    const entry = this._meshBuffers.get(key)
    if (!entry) return
    this.gl.deleteBuffer(entry.vert)
    this.gl.deleteBuffer(entry.idx)
    this._meshBuffers.delete(key)
  }

  getOrCreateTexture(key: string, bitmap: ImageBitmap): WebGLTexture {
    const cached = this._textures.get(key)
    if (cached) return cached
    const { gl } = this
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap as any)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this._textures.set(key, tex)
    return tex
  }

  destroyTexture(key: string): void {
    const tex = this._textures.get(key)
    if (!tex) return
    this.gl.deleteTexture(tex)
    this._textures.delete(key)
  }

  createGeometryBuffer(key: string, data: ArrayBufferView, target: number): WebGLBuffer {
    const cached = this._geometryBuffers.get(key)
    if (cached) return cached
    const { gl } = this
    const buf = gl.createBuffer()!
    gl.bindBuffer(target, buf)
    gl.bufferData(target, data, gl.STATIC_DRAW)
    this._geometryBuffers.set(key, buf)
    return buf
  }

  destroyGeometryBuffers(prefix: string): void {
    const { gl } = this
    for (const [key, buf] of this._geometryBuffers) {
      if (key.startsWith(prefix)) {
        gl.deleteBuffer(buf)
        this._geometryBuffers.delete(key)
      }
    }
  }

  private _compile(vertSrc: string, fragSrc: string): WebGLProgram {
    const { gl } = this
    const vert = this._compileShader(gl.VERTEX_SHADER, vertSrc)
    const frag = this._compileShader(gl.FRAGMENT_SHADER, fragSrc)
    const program = gl.createProgram()!
    gl.attachShader(program, vert)
    gl.attachShader(program, frag)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`)
    }
    return program
  }

  private _compileShader(type: number, src: string): WebGLShader {
    const { gl } = this
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`)
    }
    return shader
  }
}
```

Note: `_tileQuadBuffer`, `_stencilProgram`, and the old `writeTileStencil`/`compilePrograms` are removed. The global `programs` property is also removed — programs are now returned from `compilePrograms()`.

- [ ] **Step 4: Run tests**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/webgl-context.test.ts 2>&1 | tail -10
```

Fix any remaining test failures. The existing `renderer.test.ts` and `integration.test.ts` will likely fail due to the removed `programs` property — those are fixed in Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/mini/renderer/webgl-context.ts src/mini/renderer/webgl-context.test.ts
git commit -m "feat(mini): update WebGLContext for projection-aware program compilation and mesh buffers"
```

---

## Task 4: Update `MercatorProjection`

Implement the three new Projection interface methods. `getTileMatrix` becomes private.

**Files:**
- Modify: `src/mini/renderer/mercator.ts`
- Modify: `src/mini/renderer/mercator.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/mini/renderer/mercator.test.ts`:

```typescript
describe('MercatorProjection — new Projection interface methods', () => {
  const proj = new MercatorProjection()
  const camera = { center: { lng: 4.9, lat: 52.37 }, zoom: 10, bearing: 0, pitch: 0, groundElevation: 0 }
  const viewport = { width: 512, height: 512 }
  const tileID = { z: 10, x: 525, y: 336, key: '10/525/336' }

  it('vertexShaderPrelude defines projectTile function', () => {
    expect(proj.vertexShaderPrelude).toContain('projectTile')
    expect(proj.vertexShaderPrelude).toContain('u_matrix')
  })

  it('setTileUniforms calls uniformMatrix4fv with u_matrix', () => {
    const gl = { getUniformLocation: vi.fn().mockReturnValue({}), uniformMatrix4fv: vi.fn() } as any
    proj.setTileUniforms(gl, {} as any, tileID, camera, viewport)
    expect(gl.uniformMatrix4fv).toHaveBeenCalledOnce()
  })

  it('getMeshForTile returns a flat quad with 4 vertices and 6 indices', () => {
    const mesh = proj.getMeshForTile(tileID)
    expect(mesh.vertices.length).toBe(8)   // 4 vertices × 2 floats
    expect(mesh.indices.length).toBe(6)    // 2 triangles × 3 indices
  })

  it('getMeshForTile always returns the same object (singleton)', () => {
    expect(proj.getMeshForTile(tileID)).toBe(proj.getMeshForTile({ z:0, x:0, y:0, key:'0/0/0' }))
  })

  it('getMeshForTile vertices are [0,0, 4096,0, 0,4096, 4096,4096]', () => {
    const mesh = proj.getMeshForTile(tileID)
    expect(Array.from(mesh.vertices)).toEqual([0, 0, 4096, 0, 0, 4096, 4096, 4096])
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/mercator.test.ts 2>&1 | tail -10
```

- [ ] **Step 3: Implement**

Replace `src/mini/renderer/mercator.ts`:

```typescript
import type { CameraState, TileID, TileMesh } from '../core/types.ts'
import type { Projection, Viewport } from '../core/projection.ts'

export function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom)
}

export function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
}

// Static flat quad mesh [0,4096]² — shared across all tiles, no allocation per call
const FLAT_QUAD_MESH: TileMesh = {
  vertices: new Float32Array([0, 0, 4096, 0, 0, 4096, 4096, 4096]),
  indices: new Uint16Array([0, 1, 2, 1, 3, 2]),
}

export class MercatorProjection implements Projection {
  readonly vertexShaderPrelude = /* glsl */`
    uniform mat4 u_matrix;
    vec4 projectTile(vec2 pos) { return u_matrix * vec4(pos, 0.0, 1.0); }
  `

  getVisibleTiles(camera: CameraState, viewport: Viewport): TileID[] {
    const { center, zoom } = camera
    const { width, height } = viewport
    const z = Math.floor(zoom)
    const tileW = 256 * Math.pow(2, zoom - z)
    const cx = lngToTileX(center.lng, zoom) * 256
    const cy = latToTileY(center.lat, zoom) * 256
    const maxTile = Math.pow(2, z) - 1
    const xMin = Math.max(0, Math.floor((cx - width / 2) / tileW))
    const xMax = Math.min(maxTile, Math.floor((cx + width / 2) / tileW))
    const yMin = Math.max(0, Math.floor((cy - height / 2) / tileW))
    const yMax = Math.min(maxTile, Math.floor((cy + height / 2) / tileW))
    const tiles: TileID[] = []
    for (let x = xMin; x <= xMax; x++)
      for (let y = yMin; y <= yMax; y++)
        tiles.push({ z, x, y, key: `${z}/${x}/${y}` })
    return tiles
  }

  setTileUniforms(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    tileID: TileID,
    camera: CameraState,
    viewport: Viewport,
  ): void {
    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'u_matrix'),
      false,
      this._getTileMatrix(tileID, camera, viewport),
    )
  }

  getMeshForTile(_tileID: TileID): TileMesh {
    return FLAT_QUAD_MESH
  }

  /** @internal Used by setTileUniforms and tests */
  _getTileMatrix(tileID: TileID, camera: CameraState, viewport: Viewport): Float32Array {
    const { center, zoom } = camera
    const { width, height } = viewport
    const z = tileID.z
    const tileW = 256 * Math.pow(2, zoom - z)
    const cx = lngToTileX(center.lng, zoom) * 256
    const cy = latToTileY(center.lat, zoom) * 256
    const MVT = 4096
    const sx = (2 * tileW) / (width * MVT)
    const sy = -(2 * tileW) / (height * MVT)
    const tx = (2 * (tileID.x * tileW - cx)) / width
    const ty = (2 * (cy - tileID.y * tileW)) / height
    return new Float32Array([sx, 0, 0, 0,  0, sy, 0, 0,  0, 0, 1, 0,  tx, ty, 0, 1])
  }
}
```

Note: `getTileMatrix` is renamed to `_getTileMatrix` (private convention). The existing `mercator.test.ts` tests that call `getTileMatrix` must be updated to call `_getTileMatrix`.

- [ ] **Step 4: Update old tests that called `getTileMatrix`**

In `mercator.test.ts`, replace all `proj.getTileMatrix(` with `proj._getTileMatrix(`.

- [ ] **Step 5: Run tests**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/mercator.test.ts 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/mini/renderer/mercator.ts src/mini/renderer/mercator.test.ts
git commit -m "feat(mini): MercatorProjection implements expanded Projection interface"
```

---

## Task 5: Implement `GlobeProjection`

This is the core new class. It implements the full globe math using the copied MapLibre files.

**Files:**
- Create: `src/mini/renderer/globe/globe-transform.ts`
- Create: `src/mini/renderer/globe/globe-projection.ts`
- Create: `src/mini/renderer/globe/globe-projection.test.ts`

- [ ] **Step 1: Create `globe-transform.ts` — globe camera matrix**

This extracts the matrix math from MapLibre's `globe_transform.ts`. The key function computes the `u_projection_matrix` that transforms 3D unit-sphere positions to clip space.

Create `src/mini/renderer/globe/globe-transform.ts`:

```typescript
// Adapted from MapLibre's src/geo/projection/globe_transform.ts
// Extracts only the camera matrix computation needed for globe rendering.
import { mat4, vec3 } from 'gl-matrix'
import type { CameraState } from '../../core/types.ts'
import type { Viewport } from '../../core/projection.ts'
import { getGlobeRadiusPixels } from './globe-utils.ts'

const DEG_TO_RAD = Math.PI / 180

/**
 * Compute the globe projection matrix:
 * transforms 3D unit-sphere coordinates → clip space.
 *
 * The globe center sits at world origin. Camera is positioned above the
 * viewer's center point on the sphere at a distance that matches the
 * desired zoom level. A standard perspective projection is applied.
 */
export function computeGlobeMatrix(
  camera: CameraState,
  viewport: Viewport,
): Float32Array {
  const { center, zoom } = camera
  const { width, height } = viewport

  // Globe radius in pixels at this zoom
  const worldSize = 256 * Math.pow(2, zoom)
  const globeRadius = worldSize / (2 * Math.PI)

  // Camera center as unit vector on sphere surface
  const lngRad = center.lng * DEG_TO_RAD
  const latRad = center.lat * DEG_TO_RAD
  const cosLat = Math.cos(latRad)
  const camDir = vec3.fromValues(
    Math.sin(lngRad) * cosLat,
    Math.sin(latRad),
    Math.cos(lngRad) * cosLat,
  )

  // Camera sits above the globe center along camDir.
  // NOTE: This camera distance formula is a custom approximation, NOT copied from MapLibre.
  // MapLibre's actual distance is computed in globe_transform.ts using a more complex
  // zoom-dependent formula. This approximation gives a reasonable globe view for MVP.
  // Revisit when implementing the animated mercator↔globe transition.
  const cameraDist = globeRadius / Math.sin(0.5)  // ~2× radius
  const cameraPos = vec3.scale(vec3.create(), camDir, cameraDist)

  // View matrix: look from cameraPos toward origin (globe center), up = world up approximation
  const up = vec3.fromValues(0, 1, 0)
  // Avoid gimbal lock at poles
  if (Math.abs(center.lat) > 85) {
    vec3.set(up, Math.cos(lngRad + Math.PI / 2), 0, Math.sin(lngRad + Math.PI / 2))
  }
  const viewMatrix = mat4.create()
  mat4.lookAt(viewMatrix, cameraPos, vec3.fromValues(0, 0, 0), up)

  // Scale matrix: expand unit sphere to pixel radius
  const scaleMatrix = mat4.create()
  mat4.scale(scaleMatrix, scaleMatrix, [globeRadius, globeRadius, globeRadius])

  // Perspective matrix
  const fov = 0.5  // radians, ~28.6°
  const aspect = width / height
  const near = globeRadius * 0.01
  const far = cameraDist + globeRadius * 2
  const projMatrix = mat4.create()
  mat4.perspective(projMatrix, fov * 2, aspect, near, far)

  // Combined: proj × view × scale
  const combined = mat4.create()
  mat4.multiply(combined, projMatrix, viewMatrix)
  mat4.multiply(combined, combined, scaleMatrix)

  return combined as Float32Array
}

/**
 * Compute the clipping plane for a globe tile — used to hide the backfacing side.
 * Returns vec4 (nx, ny, nz, d) where dot(spherePos, normal) + d < 0 means clipped.
 */
export function computeGlobeClippingPlane(camera: CameraState): Float32Array {
  const lngRad = camera.center.lng * DEG_TO_RAD
  const latRad = camera.center.lat * DEG_TO_RAD
  const cosLat = Math.cos(latRad)
  // Normal points toward the viewer's center
  return new Float32Array([
    Math.sin(lngRad) * cosLat,
    Math.sin(latRad),
    Math.cos(lngRad) * cosLat,
    -0.02,  // slight offset so horizon tiles are not clipped too aggressively
  ])
}

/**
 * Tile mercator coordinates for the globe prelude uniform.
 * Returns vec4: (mercatorX0, mercatorY0, mercatorWidth, mercatorHeight)
 * where mercator coords are in [0,1] range.
 */
export function computeTileMercatorCoords(
  z: number, x: number, y: number,
): Float32Array {
  const scale = 1 / Math.pow(2, z)
  const EXTENT = 4096
  return new Float32Array([
    x * scale,                   // mercatorX of left edge
    y * scale,                   // mercatorY of top edge
    scale / EXTENT,              // width per MVT unit
    scale / EXTENT,              // height per MVT unit
  ])
}
```

- [ ] **Step 2: Write failing tests for GlobeProjection**

Create `src/mini/renderer/globe/globe-projection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { GlobeProjection } from './globe-projection.ts'

const camera = { center: { lng: 4.9, lat: 52.37 }, zoom: 3, bearing: 0, pitch: 0, groundElevation: 0 }
const viewport = { width: 512, height: 512 }
const tileID = { z: 3, x: 4, y: 2, key: '3/4/2' }

describe('GlobeProjection', () => {
  it('vertexShaderPrelude contains projectTile function', () => {
    const proj = new GlobeProjection()
    expect(proj.vertexShaderPrelude).toContain('projectTile')
    expect(proj.vertexShaderPrelude).toContain('u_projection_matrix')
  })

  it('getVisibleTiles returns non-empty array', () => {
    const proj = new GlobeProjection()
    const tiles = proj.getVisibleTiles(camera, viewport)
    expect(tiles.length).toBeGreaterThan(0)
  })

  it('getVisibleTiles returns TileIDs with valid keys', () => {
    const proj = new GlobeProjection()
    for (const tile of proj.getVisibleTiles(camera, viewport)) {
      expect(tile.key).toBe(`${tile.z}/${tile.x}/${tile.y}`)
    }
  })

  it('getMeshForTile returns a mesh with more than 4 vertices (subdivided)', () => {
    const proj = new GlobeProjection()
    const mesh = proj.getMeshForTile(tileID)
    expect(mesh.vertices.length).toBeGreaterThan(8)  // more than flat quad
    expect(mesh.indices.length).toBeGreaterThan(6)
  })

  it('getMeshForTile caches by tileID.key (same object returned)', () => {
    const proj = new GlobeProjection()
    const a = proj.getMeshForTile(tileID)
    const b = proj.getMeshForTile(tileID)
    expect(a).toBe(b)
  })

  it('getMeshForTile returns different meshes for different zoom levels', () => {
    const proj = new GlobeProjection()
    const low = proj.getMeshForTile({ z: 0, x: 0, y: 0, key: '0/0/0' })
    const high = proj.getMeshForTile({ z: 5, x: 0, y: 0, key: '5/0/0' })
    // Low zoom has more subdivision (larger tiles need more vertices)
    expect(low.vertices.length).toBeGreaterThanOrEqual(high.vertices.length)
  })

  it('setTileUniforms sets u_projection_matrix', () => {
    const proj = new GlobeProjection()
    const gl = {
      getUniformLocation: vi.fn().mockReturnValue({}),
      uniformMatrix4fv: vi.fn(),
      uniform4fv: vi.fn(),
      uniform1f: vi.fn(),
    } as any
    proj.setTileUniforms(gl, {} as any, tileID, camera, viewport)
    const locations = (gl.getUniformLocation as any).mock.calls.map((c: any[]) => c[1])
    expect(locations).toContain('u_projection_matrix')
    expect(locations).toContain('u_projection_tile_mercator_coords')
    expect(locations).toContain('u_projection_clipping_plane')
    expect(locations).toContain('u_projection_transition')
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/globe/globe-projection.test.ts 2>&1 | tail -10
```

- [ ] **Step 4: Implement `globe-projection.ts`**

Create `src/mini/renderer/globe/globe-projection.ts`:

```typescript
import type { CameraState, TileID, TileMesh } from '../../core/types.ts'
import type { Projection, Viewport } from '../../core/projection.ts'
import { GLOBE_PRELUDE } from './globe-prelude.glsl.ts'
import { SubdivisionGranularityExpression, SubdivisionGranularitySetting } from './subdivision_granularity_settings.ts'
import { getSubdivision } from './subdivision.ts'  // adjust import to match actual exported function
import { computeGlobeMatrix, computeGlobeClippingPlane, computeTileMercatorCoords } from './globe-transform.ts'

// Copied from MapLibre's vertical_perspective_projection.ts (granularitySettingsGlobe)
const GLOBE_GRANULARITY = new SubdivisionGranularitySetting({
  fill:    new SubdivisionGranularityExpression(128, 2),
  line:    new SubdivisionGranularityExpression(512, 0),
  tile:    new SubdivisionGranularityExpression(128, 32),
  stencil: new SubdivisionGranularityExpression(128, 1),
  circle:  3,
})

export class GlobeProjection implements Projection {
  readonly vertexShaderPrelude = GLOBE_PRELUDE

  private _meshCache = new globalThis.Map<string, TileMesh>()

  getVisibleTiles(camera: CameraState, viewport: Viewport): TileID[] {
    // MVP: reuse mercator tile coverage; back-facing tiles are discarded by clipping plane in shader
    const { MercatorProjection } = await import('../mercator.ts') // static import at top of file
    return new MercatorProjection().getVisibleTiles(camera, viewport)
  }

  setTileUniforms(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    tileID: TileID,
    camera: CameraState,
    viewport: Viewport,
  ): void {
    const matrix = computeGlobeMatrix(camera, viewport)
    const clippingPlane = computeGlobeClippingPlane(camera)
    const mercatorCoords = computeTileMercatorCoords(tileID.z, tileID.x, tileID.y)

    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_projection_matrix'), false, matrix)
    gl.uniform4fv(gl.getUniformLocation(program, 'u_projection_clipping_plane'), clippingPlane)
    gl.uniform4fv(gl.getUniformLocation(program, 'u_projection_tile_mercator_coords'), mercatorCoords)
    gl.uniform1f(gl.getUniformLocation(program, 'u_projection_transition'), 1.0)
    // u_projection_fallback_matrix is only needed during transition (not yet implemented)
    // Set to identity to avoid undefined uniform warnings
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_projection_fallback_matrix'), false,
      new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]))
  }

  getMeshForTile(tileID: TileID): TileMesh {
    const cached = this._meshCache.get(tileID.key)
    if (cached) return cached

    const granularity = GLOBE_GRANULARITY.tile.getGranularityForZoomLevel(tileID.z)
    // Call subdivision.ts to generate mesh for this tile
    // The exact API depends on what subdivision.ts exports — check after copying
    const mesh = generateTileMesh(tileID, granularity)
    this._meshCache.set(tileID.key, mesh)
    return mesh
  }
}

/**
 * Generate a subdivided tile mesh for globe rendering.
 * Wraps subdivision.ts which was copied from MapLibre.
 * Adjust the call to match subdivision.ts's actual exported API after copying.
 */
function generateTileMesh(tileID: TileID, granularity: number): TileMesh {
  // subdivision.ts from MapLibre exports functions to subdivide tile geometry.
  // Check the actual API after copying — likely something like:
  //   getSubdivision(canonical, geometry, granularity) → {vertexBuffer, indexBuffer}
  // For now use a flat quad as fallback until subdivision API is wired:
  const EXTENT = 4096
  const vertices = new Float32Array([0, 0, EXTENT, 0, 0, EXTENT, EXTENT, EXTENT])
  const indices = new Uint16Array([0, 1, 2, 1, 3, 2])
  return { vertices, indices }
}
```

**Note on subdivision API:** After copying `subdivision.ts`, read the file to find the actual exported function(s). The main function in MapLibre's `subdivision.ts` is likely `getSubdivision` or similar — check and update `generateTileMesh` to call it correctly with the tile's canonical ID and the granularity value. The function should return vertex/index data that forms a subdivided grid over `[0,4096]²`.

**Fix the dynamic import** — change `getVisibleTiles` to use a static import at the top of the file:
```typescript
import { MercatorProjection } from '../mercator.ts'
```

- [ ] **Step 5: Wire subdivision API**

`subdivision.ts` exports `subdividePolygon(polygon, canonical, granularity, addBorderVertices)` which takes a polygon ring (array of `Point` objects) and returns `{ verticesFlattened: number[], indicesTriangles: number[] }`.

Replace the placeholder `generateTileMesh` function with:

```typescript
import Point from '@mapbox/point-geometry'
import { subdividePolygon } from './subdivision.ts'

function generateTileMesh(tileID: TileID, granularity: number): TileMesh {
  const EXTENT = 4096
  // Rectangle covering the full tile extent
  const ring = [
    new Point(0, 0),
    new Point(EXTENT, 0),
    new Point(EXTENT, EXTENT),
    new Point(0, EXTENT),
  ]
  const canonical = { z: tileID.z, x: tileID.x, y: tileID.y }
  const result = subdividePolygon([ring], canonical, granularity, false)
  return {
    vertices: new Float32Array(result.verticesFlattened),
    indices: new Uint16Array(result.indicesTriangles),
  }
}
```

If `granularity` is 1 (no subdivision, high zoom), `subdividePolygon` returns the flat quad — so this works correctly at all zoom levels.

- [ ] **Step 6: Run tests**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/globe/globe-projection.test.ts 2>&1 | tail -15
```

- [ ] **Step 7: Run full type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep -v node_modules | head -30
```

- [ ] **Step 8: Commit**

```bash
git add src/mini/renderer/globe/
git commit -m "feat(mini): implement GlobeProjection with subdivision mesh and sphere uniforms"
```

---

## Task 6: Update `Renderer`

Replace the current ad-hoc program compilation and matrix passing with projection-aware equivalents.

**Files:**
- Modify: `src/mini/renderer/renderer.ts`
- Modify: `src/mini/renderer/renderer.test.ts`
- Modify: `src/mini/integration.test.ts`

- [ ] **Step 1: Update renderer.test.ts and integration.test.ts mocks**

**GL mock additions** — add to both mocks:
```typescript
ELEMENT_ARRAY_BUFFER: 34963,
UNSIGNED_SHORT: 5123,
TRIANGLES: 4,
drawElements: vi.fn(),
deleteProgram: vi.fn(),
```

**Projection mock** — every `makeProjection()` or inline projection mock in `renderer.test.ts` and `integration.test.ts` uses `getTileMatrix`. Replace ALL occurrences with the three new interface methods:
```typescript
// Before:
{ getVisibleTiles: vi.fn().mockReturnValue([]), getTileMatrix: vi.fn().mockReturnValue(new Float32Array(16)) }

// After:
{
  vertexShaderPrelude: 'vec4 projectTile(vec2 p){return vec4(p,0.0,1.0);}',
  getVisibleTiles: vi.fn().mockReturnValue([]),
  setTileUniforms: vi.fn(),
  getMeshForTile: vi.fn().mockReturnValue({
    vertices: new Float32Array([0,0,4096,0,0,4096,4096,4096]),
    indices: new Uint16Array([0,1,2,1,3,2]),
  }),
}
```

**`RenderContext.programs`** — `this._webgl.programs` no longer exists after Task 3. In `renderer.ts`, update the `renderCtx` construction to pass the current layer programs:
```typescript
const { layers: programs, stencil: stencilProg } = this._getOrCompilePrograms()

const renderCtx: RenderContext = {
  gl,
  programs,   // ← use projection-compiled programs, not this._webgl.programs
  camera,
  visibleTiles: [],
  frameIndex: this._frameIndex,
}
```

Also update `renderer.test.ts` assertions that check `layer.draw` is called with `matrix` — change to check for `meshBuffers` instead.

- [ ] **Step 2: Update `renderer.ts`**

Key changes to `renderFrame()` and `addLayer()`:

```typescript
// Add at class level:
private _compiledPrograms = new WeakMap<Projection, {
  layers: ProgramCache
  stencil: WebGLProgram
}>()
private _allPrograms: WebGLProgram[] = []  // for destroy() cleanup

private _getOrCompilePrograms(): { layers: ProgramCache; stencil: WebGLProgram } {
  if (!this._compiledPrograms.has(this._projection)) {
    const prelude = this._projection.vertexShaderPrelude
    const defs = this._layers.flatMap(e => (e.layer.constructor as any).programs ?? [])
    const layers = this._webgl.compilePrograms(defs, prelude)
    const stencil = this._webgl.compileStencilProgram(prelude)
    // Track for cleanup
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

In `addLayer()`, remove the `this._webgl.compilePrograms(programs)` call — programs are compiled lazily in `_getOrCompilePrograms()`.

In `renderFrame()`, replace the tile draw loop:

```typescript
const { layers: programs, stencil: stencilProg } = this._getOrCompilePrograms()

// ... (background layers unchanged) ...

gl.enable(gl.STENCIL_TEST)
gl.clear(gl.STENCIL_BUFFER_BIT)
let nextStencilRef = 1

const viewport: Viewport = { width: this._width, height: this._height }
for (const [sourceId, tileManager] of this._tileManagers) {
  const readyTiles = tileManager.getReadyTiles()
  const layers = this._tileLayers.get(sourceId) ?? []
  const sourceType = this._sourceTypes.get(sourceId) ?? 'raster'

  for (const { tileID, data } of readyTiles) {
    const mesh = this._projection.getMeshForTile(tileID)
    const meshBuffers = this._webgl.getOrCreateMeshBuffers(tileID.key, mesh)

    const ref = nextStencilRef++
    if (nextStencilRef > 255) nextStencilRef = 1

    // Phase 1: write stencil with projection-specific program + mesh.
    // IMPORTANT: setTileUniforms MUST come before writeTileStencil —
    // uniforms must be set on the program before gl.drawElements is called inside writeTileStencil.
    // (The spec pseudocode has these reversed — follow this plan's order, not the spec.)
    this._projection.setTileUniforms(gl, stencilProg, tileID, camera, viewport)
    this._webgl.writeTileStencil(stencilProg, meshBuffers.vert, meshBuffers.idx, meshBuffers.indexCount, ref)

    // Phase 2: draw layers
    gl.stencilFunc(gl.EQUAL, ref, 0xFF)
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP)
    gl.stencilMask(0x00)

    let tileTexture: WebGLTexture | undefined
    if (sourceType === 'raster') {
      tileTexture = this._webgl.getOrCreateTexture(tileID.key, data as ImageBitmap)
    }

    for (const layer of layers) {
      const paint = this._styleEvaluator.evaluate(layer, camera.zoom)
      const program = programs.get((layer.constructor as any).programs?.[0]?.name)
      if (program) this._projection.setTileUniforms(gl, program, tileID, camera, viewport)
      ;(layer as any).draw({
        gl,
        programs,
        tileID,
        meshBuffers,
        zoom: camera.zoom,
        paint,
        frameIndex: this._frameIndex,
        tileTexture,
        tileData: sourceType === 'vector' ? data : undefined,
        imageAtlas: {},
        lineDashAtlas: {},
      })
    }
  }
}

gl.disable(gl.STENCIL_TEST)
```

Update `destroy()` to delete GPU programs:
```typescript
destroy(): void {
  this._frameLoop.stop()
  for (const tm of this._tileManagers.values()) tm.destroy()
  const { gl } = this._webgl
  for (const prog of this._allPrograms) gl.deleteProgram?.(prog)
}
```

- [ ] **Step 3: Run tests**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/renderer.test.ts src/mini/integration.test.ts 2>&1 | tail -15
```

Fix any failures. Common issues: mock missing `deleteProgram`, assertion changes for `matrix` → `meshBuffers`.

- [ ] **Step 4: Commit**

```bash
git add src/mini/renderer/renderer.ts src/mini/renderer/renderer.test.ts src/mini/integration.test.ts
git commit -m "feat(mini): renderer uses projection-aware program cache, mesh buffers, and setTileUniforms"
```

---

## Task 7: Update layer shaders

Three layers need: (1) call `projectTile(a_pos)` instead of `u_matrix * vec4(a_pos,...)`, (2) remove `u_matrix` uniform and its `gl.uniformMatrix4fv` call from `draw()`.

Raster also needs: use `meshBuffers` from DrawContext instead of the quad buffer, change UV to `a_pos / 4096.0`, switch to `gl.drawElements`.

**Files:**
- Modify: `src/mini/layers/raster.ts`, `fill.ts`, `line.ts` and their tests

- [ ] **Step 1: Update `raster.ts`**

```typescript
const rasterVert = /* glsl */`
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  gl_Position = projectTile(a_pos);
  v_uv = a_pos / 4096.0;
}
`

const rasterFrag = /* glsl */`
precision mediump float;
uniform sampler2D u_texture;
uniform float u_opacity;
varying vec2 v_uv;
void main() {
  gl_FragColor = texture2D(u_texture, v_uv) * u_opacity;
}
`
```

In `RasterLayer.draw()`:
- Remove `onAdd()` entirely (no longer needs quadBuffer)
- Remove `matrix` from destructuring
- Use `meshBuffers` from context:

```typescript
draw(ctx: DrawContext): void {
  const { gl, programs, meshBuffers, paint, tileTexture } = ctx
  if (!tileTexture) return
  const program = programs.get('raster')
  if (!program) return

  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffers.vert)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshBuffers.idx)
  const aPos = gl.getAttribLocation(program, 'a_pos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  // u_matrix / projection uniforms set by renderer before draw()
  gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0)
  const opacity = typeof paint['opacity'] === 'number' ? paint['opacity'] : this.opacity
  gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), opacity)

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, tileTexture)
  gl.drawElements(gl.TRIANGLES, meshBuffers.indexCount, gl.UNSIGNED_SHORT, 0)
}
```

- [ ] **Step 2: Update `fill.ts` vertex shader and draw()**

```glsl
// fill vertex shader — before:
attribute vec2 a_pos;
uniform mat4 u_matrix;
void main() { gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0); }

// after:
attribute vec2 a_pos;
void main() { gl_Position = projectTile(a_pos); }
```

In `FillLayer.draw()`, remove the `u_matrix` uniform lookup and `gl.uniformMatrix4fv` call. Remove `matrix` from destructured context.

- [ ] **Step 3: Update `line.ts` vertex shader and draw()**

Same pattern as fill — replace `u_matrix * vec4(...)` with `projectTile(a_pos)`, remove matrix uniform from draw().

- [ ] **Step 4: Update layer tests**

In `raster.test.ts`, `fill.test.ts`, `line.test.ts`:
- Remove `matrix` from mock draw context, add `meshBuffers`:
  ```typescript
  meshBuffers: {
    vert: {} as WebGLBuffer,
    idx: {} as WebGLBuffer,
    indexCount: 6,
  }
  ```
- Update gl mock to include `drawElements: vi.fn()`, `ELEMENT_ARRAY_BUFFER: 34963`, `UNSIGNED_SHORT: 5123`, `TRIANGLES: 4`
- Update assertions: `drawArrays` → `drawElements` for raster layer

- [ ] **Step 5: Run all mini tests**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 6: Type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

- [ ] **Step 7: Commit**

```bash
git add src/mini/layers/
git commit -m "feat(mini): update layer shaders to use projectTile() from projection prelude"
```

---

## Task 8: Globe demo

**Files:**
- Create: `demo/phase6/index.html`
- Modify: `vite.config.demo.ts`

- [ ] **Step 1: Add entry to `vite.config.demo.ts`**

```typescript
'phase6': resolve(__dirname, 'demo/phase6/index.html'),
```

- [ ] **Step 2: Create demo**

Create `demo/phase6/index.html` — a minimal demo using GlobeProjection with raster tiles (e.g., OSM or demotiles).

```html
<!DOCTYPE html>
<html>
<head>
  <title>Phase 6 — Globe Projection</title>
  <style>
    body { margin: 0; }
    canvas { display: block; width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <canvas id="map"></canvas>
  <script type="module">
    import { createRenderer } from '../../src/mini/renderer/index.ts'
    import { GlobeProjection } from '../../src/mini/renderer/globe/globe-projection.ts'
    import { RasterLayer } from '../../src/mini/layers/raster.ts'

    const canvas = document.getElementById('map')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const renderer = createRenderer(canvas, new GlobeProjection())

    renderer.addSource('osm', {
      type: 'raster',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    })
    renderer.addLayer(new RasterLayer({ source: 'osm', opacity: 1.0 }))
    renderer.setCamera({
      center: { lng: 0, lat: 20 },
      zoom: 2,
      bearing: 0, pitch: 0, groundElevation: 0,
    })
  </script>
</body>
</html>
```

- [ ] **Step 3: Start dev server and verify visually**

```bash
npm run dev:demo
```

Open `http://localhost:4000/phase6/` and confirm:
- Globe renders (sphere visible, not flat map)
- Raster tiles load and texture the sphere correctly
- No tile seams or grid lines
- The visible portion of the globe is textured; back side is clipped

- [ ] **Step 4: Commit**

```bash
git add demo/phase6/ vite.config.demo.ts
git commit -m "feat(mini): add phase6 globe demo"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run all mini tests**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts 2>&1 | tail -10
```

Expected: all pass (same count as before, plus new globe tests).

- [ ] **Step 2: Type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep -v node_modules
```

Expected: no errors.

- [ ] **Step 3: Visual check — mercator still works**

Open `http://localhost:4000/phase5/` and confirm raster + vector tiles still render correctly with mercator projection (no regression).

- [ ] **Step 4: Visual check — globe renders correctly**

Open `http://localhost:4000/phase6/` and verify globe rendering looks correct.

- [ ] **Step 5: Commit if any cleanup needed, then finish branch**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts 2>&1 | tail -5
# If all green:
git add -p  # stage any final cleanup
git commit -m "chore(mini): final cleanup for globe projection"
```
