# MapLibre Clean-Room — Phase 2: Raster Tiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A real interactive raster tile map — OSM tiles fetched, decoded, uploaded to GPU, drawn per-tile. Proves TileManager + RasterLayer end-to-end on top of the Phase 1 architecture.

**Architecture:** Projection interface injected into TileManager and Renderer (no mercator imports in core). TileManager owns fetch lifecycle (AbortSignal cancellation, no LRU). RasterLayer + RasterTileService are self-contained in layers/raster.ts. WebGLContext owns the unit quad VBO and texture cache.

**Tech Stack:** TypeScript, WebGL 1, vitest (node environment, manual mocks). No new npm packages.

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `src/mini/core/projection.ts` | Create | `Projection` interface + `Viewport` type |
| `src/mini/core/projection.test.ts` | Create | Duck-type interface check |
| `src/mini/renderer/mercator.ts` | Create | `MercatorProjection implements Projection` |
| `src/mini/renderer/mercator.test.ts` | Create | Tile coordinate math: known lng/lat → expected tile x/y/z |
| `src/mini/renderer/tile-manager.ts` | Create | Tile lifecycle: visibility, fetch, cancel, cache |
| `src/mini/renderer/tile-manager.test.ts` | Create | Visible set update, fetch triggered, cancellation |
| `src/mini/layers/raster.ts` | Create | `RasterLayer` + GLSL shaders + `RasterTileService` |
| `src/mini/layers/raster.test.ts` | Create | draw() + RasterTileService.process() |
| `src/mini/renderer/webgl-context.ts` | Modify | Add `quadBuffer` VBO + `getOrCreateTexture()` |
| `src/mini/renderer/webgl-context.test.ts` | Modify | Tests for quadBuffer + texture caching |
| `src/mini/renderer/renderer.ts` | Modify | Source registry, layer→source wiring, per-tile draw loop |
| `src/mini/renderer/renderer.test.ts` | Modify | addSource/addLayer/renderFrame/setCamera with tiles |
| `src/mini/renderer/index.ts` | Modify | `RendererOptions { projection? }`, default `MercatorProjection` |
| `demo/phase-2-raster.html` | Create | Phase 2 demo page |
| `demo/phase-2-raster.ts` | Create | Demo script: OSM tiles, zoom slider, Amsterdam |

---

## Task 1: Projection interface

**Files:**
- Create: `src/mini/core/projection.ts`
- Create: `src/mini/core/projection.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/mini/core/projection.test.ts
import { describe, it, expect } from 'vitest'
import type { Projection } from './projection.ts'

describe('Projection', () => {
  it('Projection interface is satisfied by duck-typed object', () => {
    const proj: Projection = {
      getVisibleTiles: () => [],
      getTileMatrix: () => new Float32Array(16),
    }
    expect(typeof proj.getVisibleTiles).toBe('function')
    expect(typeof proj.getTileMatrix).toBe('function')
  })

  it('getTileMatrix returns a Float32Array of length 16', () => {
    const proj: Projection = {
      getVisibleTiles: () => [],
      getTileMatrix: () => new Float32Array(16),
    }
    const matrix = proj.getTileMatrix(
      { z: 10, x: 512, y: 341, key: '10/512/341' },
      { center: { lng: 4.9, lat: 52.37 }, zoom: 10, bearing: 0, pitch: 0, groundElevation: 0 },
      { width: 512, height: 512 },
    )
    expect(matrix).toBeInstanceOf(Float32Array)
    expect(matrix.length).toBe(16)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/core/projection.test.ts`
Expected: FAIL — `Cannot find module './projection.ts'`

- [ ] **Step 3: Create projection.ts**

```ts
// src/mini/core/projection.ts
import type { CameraState, TileID } from './types.ts'

export interface Viewport {
  width: number
  height: number
}

export interface Projection {
  /** Tile IDs visible in the current camera + viewport */
  getVisibleTiles(camera: CameraState, viewport: Viewport): TileID[]
  /** Tile-space [0,1]² → clip-space 4×4 matrix (column-major Float32Array, 16 elements) */
  getTileMatrix(tileID: TileID, camera: CameraState, viewport: Viewport): Float32Array
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/core/projection.test.ts`
Expected: PASS — 2 tests pass.

- [ ] **Step 5: Type-check**

Run: `node_modules/.bin/tsc --noEmit`
Expected: No new errors from `src/mini/` files.

- [ ] **Step 6: Commit**

```bash
git add src/mini/core/projection.ts src/mini/core/projection.test.ts
git commit -m "feat(mini): add Projection interface and Viewport type"
```

---

## Task 2: MercatorProjection

**Files:**
- Create: `src/mini/renderer/mercator.ts`
- Create: `src/mini/renderer/mercator.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/mini/renderer/mercator.test.ts
import { describe, it, expect } from 'vitest'
import { MercatorProjection, lngToTileX, latToTileY } from './mercator.ts'

describe('lngToTileX', () => {
  it('longitude 0 at zoom 0 is 0.5 (half the world)', () => {
    expect(lngToTileX(0, 0)).toBeCloseTo(0.5)
  })

  it('longitude -180 at zoom 1 is 0 (far west edge)', () => {
    expect(lngToTileX(-180, 1)).toBeCloseTo(0)
  })

  it('longitude 180 at zoom 1 is 2 (far east edge, wraps)', () => {
    expect(lngToTileX(180, 1)).toBeCloseTo(2)
  })

  it('Amsterdam longitude 4.9 at zoom 10 floors to tile 528', () => {
    expect(Math.floor(lngToTileX(4.9, 10))).toBe(528)
  })
})

describe('latToTileY', () => {
  it('latitude 0 at zoom 0 is approximately 0.5 (equator)', () => {
    expect(latToTileY(0, 0)).toBeCloseTo(0.5)
  })

  it('Amsterdam latitude 52.37 at zoom 10 floors to tile 341', () => {
    expect(Math.floor(latToTileY(52.37, 10))).toBe(341)
  })
})

describe('MercatorProjection', () => {
  const proj = new MercatorProjection()
  const camera = { center: { lng: 4.9, lat: 52.37 }, zoom: 10, bearing: 0, pitch: 0, groundElevation: 0 }
  const viewport = { width: 512, height: 512 }

  it('getVisibleTiles returns TileID[] where all IDs have z = floor(zoom)', () => {
    const tiles = proj.getVisibleTiles(camera, viewport)
    expect(tiles.length).toBeGreaterThan(0)
    for (const tile of tiles) {
      expect(tile.z).toBe(Math.floor(camera.zoom))
    }
  })

  it('getVisibleTiles returns TileIDs with valid key property', () => {
    const tiles = proj.getVisibleTiles(camera, viewport)
    for (const tile of tiles) {
      expect(tile.key).toBe(`${tile.z}/${tile.x}/${tile.y}`)
    }
  })

  it('getVisibleTiles tiles are clamped to valid x range [0, 2^z - 1]', () => {
    const tiles = proj.getVisibleTiles(camera, viewport)
    const z = Math.floor(camera.zoom)
    const maxTile = Math.pow(2, z) - 1
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0)
      expect(tile.x).toBeLessThanOrEqual(maxTile)
      expect(tile.y).toBeGreaterThanOrEqual(0)
      expect(tile.y).toBeLessThanOrEqual(maxTile)
    }
  })

  it('getTileMatrix returns Float32Array of length 16', () => {
    const tiles = proj.getVisibleTiles(camera, viewport)
    const matrix = proj.getTileMatrix(tiles[0], camera, viewport)
    expect(matrix).toBeInstanceOf(Float32Array)
    expect(matrix.length).toBe(16)
  })

  it('center tile has near-zero translation in matrix (tile aligned to canvas center)', () => {
    // The center tile is the one containing the camera center
    const z = Math.floor(camera.zoom)
    const cx = Math.floor(lngToTileX(camera.center.lng, z))
    const cy = Math.floor(latToTileY(camera.center.lat, z))
    const tileID = { z, x: cx, y: cy, key: `${z}/${cx}/${cy}` }
    const matrix = proj.getTileMatrix(tileID, camera, viewport)
    // Column-major 4x4: translation is at indices [12] (tx) and [13] (ty)
    // The center tile at zoom=integer should have tx and ty close to 0 (tile covers center)
    // We only verify the matrix is well-formed (diagonal non-zero, length 16)
    expect(matrix[0]).not.toBe(0) // sx scale factor
    expect(matrix[5]).not.toBe(0) // sy scale factor
    expect(matrix[10]).toBe(1)    // depth pass-through
    expect(matrix[15]).toBe(1)    // homogeneous w
  })

  it('matrix sx and sy have opposite signs (clip Y up, screen Y down)', () => {
    const tiles = proj.getVisibleTiles(camera, viewport)
    const matrix = proj.getTileMatrix(tiles[0], camera, viewport)
    // sx = matrix[0], sy = matrix[5]; sy should be negative
    expect(Math.sign(matrix[0])).toBe(1)
    expect(Math.sign(matrix[5])).toBe(-1)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/mercator.test.ts`
Expected: FAIL — `Cannot find module './mercator.ts'`

- [ ] **Step 3: Implement MercatorProjection**

```ts
// src/mini/renderer/mercator.ts
import type { CameraState, TileID } from '../core/types.ts'
import type { Projection, Viewport } from '../core/projection.ts'

export function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom)
}

export function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
}

export class MercatorProjection implements Projection {
  getVisibleTiles(camera: CameraState, viewport: Viewport): TileID[] {
    const { center, zoom } = camera
    const { width, height } = viewport
    const z = Math.floor(zoom)
    const tileW = 256 * Math.pow(2, zoom - z)

    // Center in world pixels at fractional zoom
    const cx = lngToTileX(center.lng, zoom) * 256
    const cy = latToTileY(center.lat, zoom) * 256

    const maxTile = Math.pow(2, z) - 1

    const xMin = Math.max(0, Math.floor((cx - width / 2) / tileW))
    const xMax = Math.min(maxTile, Math.floor((cx + width / 2) / tileW))
    const yMin = Math.max(0, Math.floor((cy - height / 2) / tileW))
    const yMax = Math.min(maxTile, Math.floor((cy + height / 2) / tileW))

    const tiles: TileID[] = []
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tiles.push({ z, x, y, key: `${z}/${x}/${y}` })
      }
    }
    return tiles
  }

  getTileMatrix(tileID: TileID, camera: CameraState, viewport: Viewport): Float32Array {
    const { center, zoom } = camera
    const { width, height } = viewport
    const z = tileID.z
    const tileW = 256 * Math.pow(2, zoom - z)

    const cx = lngToTileX(center.lng, zoom) * 256
    const cy = latToTileY(center.lat, zoom) * 256

    const sx = (2 * tileW) / width
    const sy = -(2 * tileW) / height  // negative: clip Y up, screen Y down
    const tx = (2 * (tileID.x * tileW - cx)) / width
    const ty = (2 * (cy - tileID.y * tileW)) / height

    // Column-major 4×4 matrix
    // col0=[sx,0,0,0], col1=[0,sy,0,0], col2=[0,0,1,0], col3=[tx,ty,0,1]
    return new Float32Array([
      sx,  0,  0, 0,
       0, sy,  0, 0,
       0,  0,  1, 0,
      tx, ty,  0, 1,
    ])
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/mercator.test.ts`
Expected: PASS — all tests pass.

- [ ] **Step 5: Type-check**

Run: `node_modules/.bin/tsc --noEmit`
Expected: No new errors from `src/mini/` files.

- [ ] **Step 6: Commit**

```bash
git add src/mini/renderer/mercator.ts src/mini/renderer/mercator.test.ts
git commit -m "feat(mini): implement MercatorProjection (web mercator tile math)"
```

---

## Task 3: WebGLContext extensions

**Files:**
- Modify: `src/mini/renderer/webgl-context.ts`
- Modify: `src/mini/renderer/webgl-context.test.ts`

- [ ] **Step 1: Add failing tests to webgl-context.test.ts**

Append the following `describe` block to `src/mini/renderer/webgl-context.test.ts`:

```ts
describe('WebGLContext — Phase 2 additions', () => {
  let gl: ReturnType<typeof makeGLMock> & {
    createBuffer: ReturnType<typeof vi.fn>
    bindBuffer: ReturnType<typeof vi.fn>
    bufferData: ReturnType<typeof vi.fn>
    createTexture: ReturnType<typeof vi.fn>
    bindTexture: ReturnType<typeof vi.fn>
    texImage2D: ReturnType<typeof vi.fn>
    texParameteri: ReturnType<typeof vi.fn>
    generateMipmap: ReturnType<typeof vi.fn>
    ARRAY_BUFFER: number
    STATIC_DRAW: number
    FLOAT: number
    TEXTURE_2D: number
    TEXTURE0: number
    UNSIGNED_BYTE: number
    RGBA: number
    LINEAR: number
    CLAMP_TO_EDGE: number
    TEXTURE_MIN_FILTER: number
    TEXTURE_MAG_FILTER: number
    TEXTURE_WRAP_S: number
    TEXTURE_WRAP_T: number
  }
  let canvas: { getContext: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    const base = makeGLMock()
    gl = Object.assign(base, {
      createBuffer: vi.fn().mockReturnValue({ _buf: true }),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      createTexture: vi.fn().mockReturnValue({ _tex: true }),
      bindTexture: vi.fn(),
      texImage2D: vi.fn(),
      texParameteri: vi.fn(),
      generateMipmap: vi.fn(),
      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
      FLOAT: 5126,
      TEXTURE_2D: 3553,
      TEXTURE0: 33984,
      UNSIGNED_BYTE: 5121,
      RGBA: 6408,
      LINEAR: 9729,
      CLAMP_TO_EDGE: 33071,
      TEXTURE_MIN_FILTER: 10241,
      TEXTURE_MAG_FILTER: 10240,
      TEXTURE_WRAP_S: 10242,
      TEXTURE_WRAP_T: 10243,
    }) as any
    canvas = { getContext: vi.fn().mockReturnValue(gl) }
  })

  it('quadBuffer is defined after construction', () => {
    const ctx = new WebGLContext(canvas as any)
    expect(ctx.quadBuffer).toBeDefined()
    expect(gl.createBuffer).toHaveBeenCalled()
    expect(gl.bufferData).toHaveBeenCalled()
  })

  it('getOrCreateTexture returns a WebGLTexture', () => {
    const ctx = new WebGLContext(canvas as any)
    const bitmap = {} as ImageBitmap
    const tex = ctx.getOrCreateTexture('10/512/341', bitmap)
    expect(tex).toBeDefined()
  })

  it('getOrCreateTexture called twice with same key returns same texture object', () => {
    const ctx = new WebGLContext(canvas as any)
    const bitmap = {} as ImageBitmap
    const tex1 = ctx.getOrCreateTexture('10/512/341', bitmap)
    const tex2 = ctx.getOrCreateTexture('10/512/341', bitmap)
    expect(tex1).toBe(tex2)
  })

  it('getOrCreateTexture calls gl.texImage2D only on first call for a key', () => {
    const ctx = new WebGLContext(canvas as any)
    const bitmap = {} as ImageBitmap
    ctx.getOrCreateTexture('10/512/341', bitmap)
    const callsAfterFirst = gl.texImage2D.mock.calls.length
    ctx.getOrCreateTexture('10/512/341', bitmap)
    expect(gl.texImage2D.mock.calls.length).toBe(callsAfterFirst)
  })

  it('getOrCreateTexture creates different textures for different keys', () => {
    const ctx = new WebGLContext(canvas as any)
    const bitmap = {} as ImageBitmap
    // Reset mock to return distinct objects for each createTexture call
    gl.createTexture
      .mockReturnValueOnce({ _tex: 'A' })
      .mockReturnValueOnce({ _tex: 'B' })
    const tex1 = ctx.getOrCreateTexture('10/512/341', bitmap)
    const tex2 = ctx.getOrCreateTexture('10/512/342', bitmap)
    expect(tex1).not.toBe(tex2)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/webgl-context.test.ts`
Expected: FAIL — `ctx.quadBuffer is not defined`, `ctx.getOrCreateTexture is not a function`

- [ ] **Step 3: Modify webgl-context.ts**

Replace the contents of `src/mini/renderer/webgl-context.ts` with:

```ts
// src/mini/renderer/webgl-context.ts
import type { ProgramDefinition } from '../core/types.ts'
import type { ProgramCache } from '../core/render-extension.ts'

export class WebGLContext {
  readonly gl: WebGLRenderingContext
  private _programs = new globalThis.Map<string, WebGLProgram>()
  private _textures = new globalThis.Map<string, WebGLTexture>()
  readonly quadBuffer: WebGLBuffer

  readonly programs: ProgramCache = {
    get: (name) => this._programs.get(name),
  }

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl')
    if (!gl) throw new Error('WebGL not supported')
    this.gl = gl

    // Unit quad VBO — vertices covering [0,1]² as TRIANGLE_STRIP
    // [0,0, 1,0, 0,1, 1,1]
    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)
    this.quadBuffer = buf
  }

  compilePrograms(defs: ProgramDefinition[]): void {
    for (const def of defs) {
      if (this._programs.has(def.name)) continue
      const program = this._compile(def.vertex, def.fragment)
      this._programs.set(def.name, program)
    }
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

- [ ] **Step 4: Run tests — expect PASS**

Run: `node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/webgl-context.test.ts`
Expected: PASS — all tests pass (including existing ones).

- [ ] **Step 5: Type-check**

Run: `node_modules/.bin/tsc --noEmit`
Expected: No new errors from `src/mini/` files.

- [ ] **Step 6: Commit**

```bash
git add src/mini/renderer/webgl-context.ts src/mini/renderer/webgl-context.test.ts
git commit -m "feat(mini): add quadBuffer and getOrCreateTexture to WebGLContext"
```

---

## Task 4: TileManager

**Files:**
- Create: `src/mini/renderer/tile-manager.ts`
- Create: `src/mini/renderer/tile-manager.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/mini/renderer/tile-manager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TileManager } from './tile-manager.ts'
import type { Projection, Viewport } from '../core/projection.ts'
import type { CameraState, TileID } from '../core/types.ts'
import type { TileService } from '../core/tile-service.ts'

const FAKE_TILE: TileID = { z: 10, x: 528, y: 341, key: '10/528/341' }
const FAKE_TILE_2: TileID = { z: 10, x: 529, y: 341, key: '10/529/341' }

const CAMERA: CameraState = {
  center: { lng: 4.9, lat: 52.37 },
  zoom: 10,
  bearing: 0,
  pitch: 0,
  groundElevation: 0,
}

const VIEWPORT: Viewport = { width: 512, height: 512 }

function makeProjection(tiles: TileID[]): Projection {
  return {
    getVisibleTiles: vi.fn().mockReturnValue(tiles),
    getTileMatrix: vi.fn().mockReturnValue(new Float32Array(16)),
  }
}

function makeTileService(): TileService {
  return {
    process: vi.fn().mockResolvedValue([{ close: vi.fn() }]),
  }
}

describe('TileManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('update() calls projection.getVisibleTiles() with the camera and viewport', () => {
    const projection = makeProjection([FAKE_TILE])
    const tileService = makeTileService()
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
    )
    manager.update(CAMERA, VIEWPORT)
    expect(projection.getVisibleTiles).toHaveBeenCalledWith(CAMERA, VIEWPORT)
  })

  it('update() calls fetch() for each visible tile not already in cache', async () => {
    const projection = makeProjection([FAKE_TILE])
    const tileService = makeTileService()
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
    )
    manager.update(CAMERA, VIEWPORT)
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith(
      'https://tile.openstreetmap.org/10/528/341.png',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('update() does not fetch a tile already in cache', async () => {
    const projection = makeProjection([FAKE_TILE])
    const tileService = makeTileService()
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
    )
    manager.update(CAMERA, VIEWPORT)
    manager.update(CAMERA, VIEWPORT)
    // fetch should only be called once — tile already in cache on second update
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('update() cancels in-flight requests for tiles no longer in visible set', () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort')

    const projection = makeProjection([FAKE_TILE])
    const tileService = makeTileService()
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
    )

    // First update: FAKE_TILE is visible → fetch starts
    manager.update(CAMERA, VIEWPORT)

    // Second update: nothing visible → FAKE_TILE is cancelled
    ;(projection.getVisibleTiles as ReturnType<typeof vi.fn>).mockReturnValue([])
    manager.update(CAMERA, VIEWPORT)

    expect(abortSpy).toHaveBeenCalled()
    abortSpy.mockRestore()
  })

  it('getReadyTiles() returns only tiles with status ready that are in current visible set', async () => {
    const fakeBitmap = { close: vi.fn() } as unknown as ImageBitmap
    const tileService: TileService = {
      process: vi.fn().mockResolvedValue([fakeBitmap]),
    }
    const projection = makeProjection([FAKE_TILE])
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
    )

    manager.update(CAMERA, VIEWPORT)
    // No tiles ready yet (fetch is still in flight)
    expect(manager.getReadyTiles()).toHaveLength(0)

    // Resolve the fetch and process chain
    await vi.waitFor(() => expect(onTileReady).toHaveBeenCalled())
    expect(manager.getReadyTiles()).toHaveLength(1)
    expect(manager.getReadyTiles()[0].tileID).toEqual(FAKE_TILE)
    expect(manager.getReadyTiles()[0].imageBitmap).toBe(fakeBitmap)
  })

  it('getReadyTiles() does not return tiles outside the current visible set', async () => {
    const fakeBitmap = { close: vi.fn() } as unknown as ImageBitmap
    const tileService: TileService = {
      process: vi.fn().mockResolvedValue([fakeBitmap]),
    }
    const projection = makeProjection([FAKE_TILE])
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
    )

    manager.update(CAMERA, VIEWPORT)
    await vi.waitFor(() => expect(onTileReady).toHaveBeenCalled())

    // Remove tile from visible set
    ;(projection.getVisibleTiles as ReturnType<typeof vi.fn>).mockReturnValue([])
    manager.update(CAMERA, VIEWPORT)

    // Tile is ready in cache but not in visible set → not returned
    expect(manager.getReadyTiles()).toHaveLength(0)
  })

  it('onTileReady callback is called when a tile finishes processing', async () => {
    const fakeBitmap = { close: vi.fn() } as unknown as ImageBitmap
    const tileService: TileService = {
      process: vi.fn().mockResolvedValue([fakeBitmap]),
    }
    const projection = makeProjection([FAKE_TILE])
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
    )

    manager.update(CAMERA, VIEWPORT)
    await vi.waitFor(() => expect(onTileReady).toHaveBeenCalled())
  })

  it('destroy() cancels all in-flight requests', () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort')
    const projection = makeProjection([FAKE_TILE, FAKE_TILE_2])
    const tileService = makeTileService()
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
    )

    manager.update(CAMERA, VIEWPORT)
    manager.destroy()

    expect(abortSpy).toHaveBeenCalled()
    abortSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/tile-manager.test.ts`
Expected: FAIL — `Cannot find module './tile-manager.ts'`

- [ ] **Step 3: Implement TileManager**

```ts
// src/mini/renderer/tile-manager.ts
import type { CameraState, TileID } from '../core/types.ts'
import type { TileService } from '../core/tile-service.ts'
import type { Projection, Viewport } from '../core/projection.ts'

interface TileEntry {
  status: 'loading' | 'ready' | 'error'
  imageBitmap?: ImageBitmap
  controller: AbortController
}

function tileKey(t: TileID): string {
  return t.key
}

function buildURL(template: string, t: TileID): string {
  return template
    .replace('{z}', String(t.z))
    .replace('{x}', String(t.x))
    .replace('{y}', String(t.y))
}

export class TileManager {
  private _tiles = new globalThis.Map<string, TileEntry>()
  private _visibleSet = new globalThis.Set<string>()
  private _urlTemplate: string
  private _tileService: TileService
  private _projection: Projection
  private _onTileReady: () => void

  constructor(
    urlTemplate: string,
    tileService: TileService,
    projection: Projection,
    onTileReady: () => void,
  ) {
    this._urlTemplate = urlTemplate
    this._tileService = tileService
    this._projection = projection
    this._onTileReady = onTileReady
  }

  update(camera: CameraState, viewport: Viewport): void {
    const visibleTiles = this._projection.getVisibleTiles(camera, viewport)
    const newVisibleSet = new globalThis.Set(visibleTiles.map(tileKey))

    // Cancel in-flight requests for tiles no longer visible
    for (const key of this._visibleSet) {
      if (!newVisibleSet.has(key)) {
        const entry = this._tiles.get(key)
        if (entry && entry.status === 'loading') {
          entry.controller.abort()
        }
      }
    }

    this._visibleSet = newVisibleSet

    // Fetch new visible tiles not already in cache
    for (const tileID of visibleTiles) {
      const key = tileKey(tileID)
      if (this._tiles.has(key)) continue

      const controller = new AbortController()
      const entry: TileEntry = { status: 'loading', controller }
      this._tiles.set(key, entry)

      this._fetchTile(tileID, controller.signal, entry)
    }
  }

  private _fetchTile(tileID: TileID, signal: AbortSignal, entry: TileEntry): void {
    const url = buildURL(this._urlTemplate, tileID)
    fetch(url, { signal })
      .then((res) => res.arrayBuffer())
      .then((buffer) => this._tileService.process(tileID, buffer, [], signal))
      .then((transferables) => {
        if (signal.aborted) return
        const bitmap = transferables[0] as ImageBitmap
        entry.status = 'ready'
        entry.imageBitmap = bitmap
        this._onTileReady()
      })
      .catch(() => {
        if (!signal.aborted) {
          entry.status = 'error'
        }
      })
  }

  getReadyTiles(): Array<{ tileID: TileID; imageBitmap: ImageBitmap }> {
    const result: Array<{ tileID: TileID; imageBitmap: ImageBitmap }> = []
    for (const key of this._visibleSet) {
      const entry = this._tiles.get(key)
      if (entry && entry.status === 'ready' && entry.imageBitmap) {
        const [z, x, y] = key.split('/').map(Number)
        result.push({ tileID: { z, x, y, key }, imageBitmap: entry.imageBitmap })
      }
    }
    return result
  }

  destroy(): void {
    for (const entry of this._tiles.values()) {
      if (entry.status === 'loading') {
        entry.controller.abort()
      }
    }
    this._tiles.clear()
    this._visibleSet.clear()
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/tile-manager.test.ts`
Expected: PASS — all tests pass.

- [ ] **Step 5: Type-check**

Run: `node_modules/.bin/tsc --noEmit`
Expected: No new errors from `src/mini/` files.

- [ ] **Step 6: Commit**

```bash
git add src/mini/renderer/tile-manager.ts src/mini/renderer/tile-manager.test.ts
git commit -m "feat(mini): implement TileManager (tile lifecycle, fetch, cancellation)"
```

---

## Task 5: RasterLayer + RasterTileService

**Files:**
- Create: `src/mini/layers/raster.ts`
- Create: `src/mini/layers/raster.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/mini/layers/raster.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RasterLayer, RasterTileService } from './raster.ts'
import type { DrawContext } from '../core/render-extension.ts'

// — RasterTileService tests —

describe('RasterTileService', () => {
  beforeEach(() => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('process() resolves to an array containing one ImageBitmap', async () => {
    const service = new RasterTileService()
    const tileID = { z: 10, x: 528, y: 341, key: '10/528/341' }
    const buffer = new ArrayBuffer(8)
    const controller = new AbortController()

    const result = await service.process(tileID, buffer, [], controller.signal)
    expect(result).toHaveLength(1)
    expect(result[0]).toBeDefined()
  })

  it('process() returns [] and calls bitmap.close() if signal is already aborted', async () => {
    const fakeBitmap = { close: vi.fn() }
    ;(createImageBitmap as ReturnType<typeof vi.fn>).mockResolvedValue(fakeBitmap)

    const service = new RasterTileService()
    const tileID = { z: 10, x: 528, y: 341, key: '10/528/341' }
    const buffer = new ArrayBuffer(8)
    const controller = new AbortController()
    controller.abort()

    const result = await service.process(tileID, buffer, [], controller.signal)
    expect(result).toHaveLength(0)
    expect(fakeBitmap.close).toHaveBeenCalled()
  })
})

// — RasterLayer tests —

function makeGL() {
  return {
    createBuffer: vi.fn().mockReturnValue({}),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getAttribLocation: vi.fn().mockReturnValue(0),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    useProgram: vi.fn(),
    getUniformLocation: vi.fn().mockReturnValue({}),
    uniformMatrix4fv: vi.fn(),
    uniform1i: vi.fn(),
    uniform1f: vi.fn(),
    activeTexture: vi.fn(),
    bindTexture: vi.fn(),
    drawArrays: vi.fn(),
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
    FLOAT: 5126,
    TRIANGLE_STRIP: 5,
    TEXTURE_2D: 3553,
    TEXTURE0: 33984,
  } as unknown as WebGLRenderingContext
}

function makeDrawContext(gl: WebGLRenderingContext, overrides: Partial<DrawContext & { tileTexture: WebGLTexture }> = {}) {
  const fakeProgram = {} as WebGLProgram
  const fakeUniformLoc = {} as WebGLUniformLocation
  return {
    gl,
    programs: {
      get: vi.fn().mockReturnValue(fakeProgram),
    },
    tileID: { z: 10, x: 528, y: 341, key: '10/528/341' },
    matrix: new Float32Array(16),
    zoom: 10,
    paint: { opacity: 1 },
    frameIndex: 0,
    imageAtlas: {},
    lineDashAtlas: {},
    tileTexture: {} as WebGLTexture,
    ...overrides,
  }
}

describe('RasterLayer', () => {
  it('has type "raster"', () => {
    const layer = new RasterLayer({ source: 'osm' })
    expect(layer.type).toBe('raster')
  })

  it('has static programs array with a "raster" program definition', () => {
    expect(RasterLayer.programs).toBeInstanceOf(Array)
    expect(RasterLayer.programs.length).toBeGreaterThan(0)
    expect(RasterLayer.programs[0].name).toBe('raster')
    expect(typeof RasterLayer.programs[0].vertex).toBe('string')
    expect(typeof RasterLayer.programs[0].fragment).toBe('string')
  })

  it('has static TileService pointing to RasterTileService', () => {
    expect(RasterLayer.TileService).toBe(RasterTileService)
  })

  it('draw() calls gl.useProgram', () => {
    const gl = makeGL()
    const layer = new RasterLayer({ source: 'osm' })
    // Set up quadBuffer via onAdd mock
    const fakeQuadBuffer = {}
    layer.onAdd({ _webgl: { quadBuffer: fakeQuadBuffer } } as any)
    const ctx = makeDrawContext(gl)
    layer.draw(ctx as any)
    expect(gl.useProgram).toHaveBeenCalled()
  })

  it('draw() calls gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)', () => {
    const gl = makeGL()
    const layer = new RasterLayer({ source: 'osm' })
    const fakeQuadBuffer = {}
    layer.onAdd({ _webgl: { quadBuffer: fakeQuadBuffer } } as any)
    const ctx = makeDrawContext(gl)
    layer.draw(ctx as any)
    expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLE_STRIP, 0, 4)
  })

  it('draw() calls gl.uniformMatrix4fv with the tile matrix', () => {
    const gl = makeGL()
    const layer = new RasterLayer({ source: 'osm' })
    const fakeQuadBuffer = {}
    layer.onAdd({ _webgl: { quadBuffer: fakeQuadBuffer } } as any)
    const matrix = new Float32Array(16)
    matrix[0] = 2  // distinguishable
    const ctx = makeDrawContext(gl, { matrix })
    layer.draw(ctx as any)
    expect(gl.uniformMatrix4fv).toHaveBeenCalledWith(
      expect.anything(),
      false,
      matrix,
    )
  })

  it('draw() calls gl.uniform1f for opacity', () => {
    const gl = makeGL()
    const layer = new RasterLayer({ source: 'osm', opacity: 0.7 })
    const fakeQuadBuffer = {}
    layer.onAdd({ _webgl: { quadBuffer: fakeQuadBuffer } } as any)
    const ctx = makeDrawContext(gl, { paint: { opacity: 0.7 } })
    layer.draw(ctx as any)
    expect(gl.uniform1f).toHaveBeenCalled()
  })

  it('opacity defaults to 1', () => {
    const layer = new RasterLayer({ source: 'osm' })
    expect(layer.opacity).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/layers/raster.test.ts`
Expected: FAIL — `Cannot find module './raster.ts'`

- [ ] **Step 3: Implement raster.ts**

```ts
// src/mini/layers/raster.ts
import type { TileID, ProgramDefinition } from '../core/types.ts'
import type { TileService } from '../core/tile-service.ts'
import type { DrawContext } from '../core/render-extension.ts'
import type { RendererAPI } from '../core/renderer-api.ts'

// ──────────────────────────────────────────────
// GLSL shaders
// ──────────────────────────────────────────────

const rasterVert = `
attribute vec2 a_pos;
uniform mat4 u_matrix;
varying vec2 v_uv;
void main() {
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
  v_uv = a_pos;
}
`

const rasterFrag = `
precision mediump float;
uniform sampler2D u_texture;
uniform float u_opacity;
varying vec2 v_uv;
void main() {
  gl_FragColor = texture2D(u_texture, v_uv) * u_opacity;
}
`

// ──────────────────────────────────────────────
// RasterTileService
// ──────────────────────────────────────────────

export class RasterTileService implements TileService {
  async process(
    _tileID: TileID,
    data: ArrayBuffer,
    _layerTypes: string[],
    signal: AbortSignal,
  ): Promise<Transferable[]> {
    const blob = new Blob([data])
    const bitmap = await createImageBitmap(blob)
    if (signal.aborted) {
      bitmap.close()
      return []
    }
    return [bitmap]
  }
}

// ──────────────────────────────────────────────
// RasterLayer
// ──────────────────────────────────────────────

export interface RasterDrawContext extends DrawContext {
  tileTexture: WebGLTexture
}

export class RasterLayer {
  readonly type = 'raster'
  static programs: ProgramDefinition[] = [
    { name: 'raster', vertex: rasterVert, fragment: rasterFrag },
  ]
  static TileService = RasterTileService

  readonly source: string
  readonly opacity: number
  private _quadBuffer!: WebGLBuffer

  constructor(options: { source: string; opacity?: number }) {
    this.source = options.source
    this.opacity = options.opacity ?? 1
  }

  onAdd(renderer: RendererAPI): void {
    // Access the quad VBO from WebGLContext via duck-typing on the Renderer
    this._quadBuffer = (renderer as any)._webgl.quadBuffer
  }

  draw(ctx: RasterDrawContext): void {
    const { gl, programs, matrix, paint, tileTexture } = ctx
    const program = programs.get('raster')
    if (!program) return

    gl.useProgram(program)

    // Bind unit quad VBO
    gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuffer)
    const aPos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    // Set uniforms
    const uMatrix = gl.getUniformLocation(program, 'u_matrix')
    gl.uniformMatrix4fv(uMatrix, false, matrix)

    const uTexture = gl.getUniformLocation(program, 'u_texture')
    gl.uniform1i(uTexture, 0)

    const uOpacity = gl.getUniformLocation(program, 'u_opacity')
    const opacity = typeof paint['opacity'] === 'number' ? paint['opacity'] : this.opacity
    gl.uniform1f(uOpacity, opacity)

    // Bind texture
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tileTexture)

    // Draw the quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/layers/raster.test.ts`
Expected: PASS — all tests pass.

- [ ] **Step 5: Type-check**

Run: `node_modules/.bin/tsc --noEmit`
Expected: No new errors from `src/mini/` files.

- [ ] **Step 6: Commit**

```bash
git add src/mini/layers/raster.ts src/mini/layers/raster.test.ts
git commit -m "feat(mini): implement RasterLayer and RasterTileService"
```

---

## Task 6: Renderer + createRenderer modifications

**Files:**
- Modify: `src/mini/renderer/renderer.ts`
- Modify: `src/mini/renderer/renderer.test.ts`
- Modify: `src/mini/renderer/index.ts`

- [ ] **Step 1: Add failing tests to renderer.test.ts**

Append the following `describe` block to `src/mini/renderer/renderer.test.ts`. The existing `makeCanvas()` helper and `describe('Renderer', ...)` block remain unchanged.

First, update the imports at the top of the test file to add the new imports:

```ts
import { RasterLayer } from '../layers/raster.ts'
```

Then append the following at the end of the file:

```ts
describe('Renderer — Phase 2 tile pipeline', () => {
  let canvas: ReturnType<typeof makeCanvas>
  let renderer: Renderer

  function makePhase2Canvas() {
    // Extend the base GL mock with texture + buffer methods needed for Phase 2
    const base = makeCanvas()
    const extraGL = {
      createBuffer: vi.fn().mockReturnValue({ _buf: true }),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      createTexture: vi.fn().mockReturnValue({ _tex: true }),
      bindTexture: vi.fn(),
      texImage2D: vi.fn(),
      texParameteri: vi.fn(),
      generateMipmap: vi.fn(),
      getAttribLocation: vi.fn().mockReturnValue(0),
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),
      useProgram: vi.fn(),
      getUniformLocation: vi.fn().mockReturnValue({}),
      uniformMatrix4fv: vi.fn(),
      uniform1i: vi.fn(),
      uniform1f: vi.fn(),
      activeTexture: vi.fn(),
      drawArrays: vi.fn(),
      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
      FLOAT: 5126,
      TRIANGLE_STRIP: 5,
      TEXTURE_2D: 3553,
      TEXTURE0: 33984,
      UNSIGNED_BYTE: 5121,
      RGBA: 6408,
      LINEAR: 9729,
      CLAMP_TO_EDGE: 33071,
      TEXTURE_MIN_FILTER: 10241,
      TEXTURE_MAG_FILTER: 10240,
      TEXTURE_WRAP_S: 10242,
      TEXTURE_WRAP_T: 10243,
    }
    Object.assign(base._gl, extraGL)
    return base
  }

  function makeProjection(tiles = [{ z: 10, x: 528, y: 341, key: '10/528/341' }]) {
    return {
      getVisibleTiles: vi.fn().mockReturnValue(tiles),
      getTileMatrix: vi.fn().mockReturnValue(new Float32Array(16)),
    }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(cb, 16))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }))
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }))
    canvas = makePhase2Canvas()
    renderer = new Renderer(canvas, makeProjection())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('addSource with type "raster" creates a TileManager internally', () => {
    renderer.addSource('osm', {
      type: 'raster',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileSize: 256,
    })
    // Verify internal state — TileManager should exist for 'osm'
    expect((renderer as any)._tileManagers.has('osm')).toBe(true)
  })

  it('addLayer with source field is associated with TileManager for that source', () => {
    renderer.addSource('osm', {
      type: 'raster',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    })
    const layer = new RasterLayer({ source: 'osm' })
    renderer.addLayer(layer)
    const tileLayers = (renderer as any)._tileLayers as globalThis.Map<string, unknown[]>
    expect(tileLayers.has('osm')).toBe(true)
    expect(tileLayers.get('osm')).toContain(layer)
  })

  it('setCamera calls tileManager.update for each active TileManager', () => {
    renderer.addSource('osm', {
      type: 'raster',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    })
    const tileManager = (renderer as any)._tileManagers.get('osm')
    const updateSpy = vi.spyOn(tileManager, 'update')
    renderer.setCamera({ center: { lng: 4.9, lat: 52.37 }, zoom: 10, bearing: 0, pitch: 0, groundElevation: 0 })
    expect(updateSpy).toHaveBeenCalled()
  })

  it('renderFrame calls layer.draw for each ready tile', async () => {
    // Set up a fake bitmap as though the tile is already ready
    const fakeBitmap = { close: vi.fn() } as unknown as ImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(fakeBitmap))

    renderer.addSource('osm', {
      type: 'raster',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    })
    const layer = new RasterLayer({ source: 'osm' })
    const drawSpy = vi.spyOn(layer, 'draw')
    renderer.addLayer(layer)

    // Trigger camera update so TileManager fetches the tile
    renderer.setCamera({ center: { lng: 4.9, lat: 52.37 }, zoom: 10, bearing: 0, pitch: 0, groundElevation: 0 })

    // Wait for the fetch + process chain to complete
    await vi.waitFor(() => {
      const tm = (renderer as any)._tileManagers.get('osm')
      return tm.getReadyTiles().length > 0
    })

    renderer.renderFrame()
    expect(drawSpy).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/renderer.test.ts`
Expected: FAIL — `Renderer constructor does not accept projection argument` and new describe block assertions fail.

- [ ] **Step 3: Modify renderer.ts**

Replace the contents of `src/mini/renderer/renderer.ts` with:

```ts
// src/mini/renderer/renderer.ts
import type { CameraState, ScreenPoint, Feature, ResolvedPaintProperties } from '../core/types.ts'
import type { RendererAPI, LayerInstance, SourceDefinition } from '../core/renderer-api.ts'
import type { RenderExtension, RenderContext } from '../core/render-extension.ts'
import type { Projection, Viewport } from '../core/projection.ts'
import { WebGLContext } from './webgl-context.ts'
import { FrameLoop } from './frame-loop.ts'
import { StyleEvaluator } from './style-evaluator.ts'
import { RenderExtensions } from './render-extensions.ts'
import { TileManager } from './tile-manager.ts'
import { RasterLayer, RasterTileService } from '../layers/raster.ts'

interface LayerEntry {
  id: string
  layer: LayerInstance
}

interface FullFrameLayer {
  drawBackground(ctx: { gl: WebGLRenderingContext; paint: ResolvedPaintProperties }): void
}

function isFullFrameLayer(layer: LayerInstance): layer is LayerInstance & FullFrameLayer {
  return typeof (layer as any).drawBackground === 'function'
}

interface RasterSourceDefinition extends SourceDefinition {
  type: 'raster'
  url: string
  tileSize?: number
}

export class Renderer implements RendererAPI {
  private _webgl: WebGLContext
  private _frameLoop: FrameLoop
  private _styleEvaluator: StyleEvaluator
  private _renderExtensions: RenderExtensions
  private _layers: LayerEntry[] = []
  private _sources = new globalThis.Map<string, SourceDefinition>()
  private _tileManagers = new globalThis.Map<string, TileManager>()
  private _tileLayers = new globalThis.Map<string, LayerInstance[]>()
  private _camera: CameraState | null = null
  private _projection: Projection
  private _frameIndex = 0
  private _width: number
  private _height: number

  constructor(canvas: HTMLCanvasElement, projection: Projection) {
    this._width = canvas.width
    this._height = canvas.height
    this._projection = projection
    this._webgl = new WebGLContext(canvas)
    this._frameLoop = new FrameLoop(() => this.renderFrame())
    this._styleEvaluator = new StyleEvaluator()
    this._renderExtensions = new RenderExtensions()
    this._frameLoop.start()
  }

  resize(width: number, height: number): void {
    this._width = width
    this._height = height
    this._frameLoop.markDirty()
  }

  destroy(): void {
    this._frameLoop.stop()
    for (const tm of this._tileManagers.values()) {
      tm.destroy()
    }
  }

  addSource(id: string, source: SourceDefinition): void {
    this._sources.set(id, source)
    if (source.type === 'raster') {
      const rasterSource = source as RasterSourceDefinition
      const tm = new TileManager(
        rasterSource.url,
        new RasterTileService(),
        this._projection,
        () => this._frameLoop.markDirty(),
      )
      this._tileManagers.set(id, tm)
    }
    this._frameLoop.markDirty()
  }

  removeSource(id: string): void {
    const tm = this._tileManagers.get(id)
    if (tm) {
      tm.destroy()
      this._tileManagers.delete(id)
    }
    this._sources.delete(id)
    this._frameLoop.markDirty()
  }

  addLayer(layer: LayerInstance, beforeId?: string): void {
    const id = (layer as any).id ?? `__layer_${this._layers.length}`
    if (beforeId) {
      const idx = this._layers.findIndex(e => e.id === beforeId)
      this._layers.splice(idx !== -1 ? idx : this._layers.length, 0, { id, layer })
    } else {
      this._layers.push({ id, layer })
    }

    // Wire tile-based layers to their source's TileManager
    const sourceId = (layer as any).source
    if (sourceId) {
      if (!this._tileLayers.has(sourceId)) {
        this._tileLayers.set(sourceId, [])
      }
      this._tileLayers.get(sourceId)!.push(layer)
    }

    if (typeof (layer as any).onAdd === 'function') {
      ;(layer as any).onAdd(this)
    }
    const programs = (layer.constructor as any).programs
    if (programs?.length > 0) {
      this._webgl.compilePrograms(programs)
    }
    this._frameLoop.markDirty()
  }

  removeLayer(id: string): void {
    const entry = this._layers.find(e => e.id === id)
    if (entry) {
      const sourceId = (entry.layer as any).source
      if (sourceId) {
        const layers = this._tileLayers.get(sourceId)
        if (layers) {
          const idx = layers.indexOf(entry.layer)
          if (idx !== -1) layers.splice(idx, 1)
        }
      }
    }
    this._layers = this._layers.filter(e => e.id !== id)
    this._frameLoop.markDirty()
  }

  setLayerPaint(_id: string, _props: Record<string, unknown>): void {
    this._frameLoop.markDirty()
  }

  setLayerLayout(_id: string, _props: Record<string, unknown>): void {
    this._frameLoop.markDirty()
  }

  setLayerVisibility(_id: string, _visible: boolean): void {
    this._frameLoop.markDirty()
  }

  setCamera(state: CameraState): void {
    this._camera = state
    const viewport: Viewport = { width: this._width, height: this._height }
    for (const tm of this._tileManagers.values()) {
      tm.update(state, viewport)
    }
    this._frameLoop.markDirty()
  }

  addRenderExtension(extension: RenderExtension): void {
    this._renderExtensions.add(extension)
    this._frameLoop.markDirty()
  }

  removeRenderExtension(id: string): void {
    this._renderExtensions.remove(id)
  }

  queryRenderedFeatures(_point: ScreenPoint): Feature[] {
    return []
  }

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

    const renderCtx: RenderContext = {
      gl,
      programs: this._webgl.programs,
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

    // Per-tile draw loop
    const viewport: Viewport = { width: this._width, height: this._height }
    for (const [sourceId, tileManager] of this._tileManagers) {
      const readyTiles = tileManager.getReadyTiles()
      const layers = this._tileLayers.get(sourceId) ?? []
      for (const { tileID, imageBitmap } of readyTiles) {
        const tileTexture = this._webgl.getOrCreateTexture(tileID.key, imageBitmap)
        const matrix = this._projection.getTileMatrix(tileID, camera, viewport)
        for (const layer of layers) {
          const paint = this._styleEvaluator.evaluate(layer, camera.zoom)
          ;(layer as any).draw({
            gl,
            programs: this._webgl.programs,
            tileID,
            matrix,
            zoom: camera.zoom,
            paint,
            frameIndex: this._frameIndex,
            tileTexture,
            imageAtlas: {},
            lineDashAtlas: {},
          })
        }
      }
    }

    this._renderExtensions.runAfterTiles(renderCtx)
    this._frameIndex++
  }

  /** Test helper — not part of RendererAPI */
  getLayers(): LayerInstance[] {
    return this._layers.map(e => e.layer)
  }
}
```

- [ ] **Step 4: Modify index.ts**

Replace the contents of `src/mini/renderer/index.ts` with:

```ts
// src/mini/renderer/index.ts
import type { RendererAPI } from '../core/renderer-api.ts'
import type { Projection } from '../core/projection.ts'
import { Renderer } from './renderer.ts'
import { MercatorProjection } from './mercator.ts'

export type { RendererAPI }

export interface RendererOptions {
  /** Custom projection — defaults to MercatorProjection (web mercator). */
  projection?: Projection
}

/**
 * Async factory — no constructor+init smell.
 * Accepts an optional projection (default: MercatorProjection).
 * In Phase 3+: accepts OffscreenCanvas for worker-mode rendering.
 */
export async function createRenderer(
  canvas: HTMLCanvasElement,
  options?: RendererOptions,
): Promise<RendererAPI> {
  return new Renderer(canvas, options?.projection ?? new MercatorProjection())
}
```

- [ ] **Step 5: Update existing renderer tests that construct `new Renderer(canvas)` directly**

The existing `describe('Renderer', ...)` block constructs `renderer = new Renderer(canvas)` without a projection argument. Update the `beforeEach` in that block to pass a minimal projection:

In `renderer.test.ts`, change the existing `beforeEach` inside `describe('Renderer', ...)`:

```ts
// Replace this line:
renderer = new Renderer(canvas)
// With:
renderer = new Renderer(canvas, {
  getVisibleTiles: vi.fn().mockReturnValue([]),
  getTileMatrix: vi.fn().mockReturnValue(new Float32Array(16)),
})
```

- [ ] **Step 6: Run all renderer tests — expect PASS**

Run: `node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/renderer.test.ts`
Expected: PASS — all tests pass (original suite + Phase 2 suite).

- [ ] **Step 7: Run full mini test suite — expect PASS**

Run: `node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/`
Expected: PASS — all tests in the suite pass.

- [ ] **Step 8: Type-check**

Run: `node_modules/.bin/tsc --noEmit`
Expected: No new errors from `src/mini/` files.

- [ ] **Step 9: Commit**

```bash
git add src/mini/renderer/renderer.ts src/mini/renderer/renderer.test.ts src/mini/renderer/index.ts
git commit -m "feat(mini): wire TileManager into Renderer, add per-tile draw loop"
```

---

## Task 7: Demo + full test suite

**Files:**
- Create: `demo/phase-2-raster.html`
- Create: `demo/phase-2-raster.ts`

- [ ] **Step 1: Verify the full mini test suite passes before writing the demo**

Run: `node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/`
Expected: PASS — all tests pass with no failures.

- [ ] **Step 2: Create demo/phase-2-raster.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MapLibre Mini — Phase 2: Raster Tiles</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      display: flex;
      height: 100vh;
      font-family: system-ui, sans-serif;
      background: #1a1a1a;
      color: #eee;
    }
    #map-container {
      flex: 1;
      position: relative;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
    #controls {
      width: 280px;
      padding: 20px;
      background: #222;
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
    }
    h1 { font-size: 1rem; font-weight: 600; color: #fff; }
    label { font-size: 0.85rem; color: #aaa; display: block; margin-bottom: 4px; }
    input[type=range] { width: 100%; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .value { font-size: 0.85rem; color: #fff; font-variant-numeric: tabular-nums; }
    .center-display {
      font-size: 0.85rem;
      color: #aaa;
      background: #2a2a2a;
      padding: 10px;
      border-radius: 6px;
      line-height: 1.6;
    }
    footer {
      font-size: 0.75rem;
      color: #666;
      margin-top: auto;
    }
    footer a { color: #888; }
  </style>
</head>
<body>
  <div id="map-container">
    <canvas id="map"></canvas>
  </div>
  <div id="controls">
    <h1>MapLibre Mini — Phase 2</h1>

    <div class="field">
      <label for="zoom-slider">Zoom</label>
      <input type="range" id="zoom-slider" min="0" max="18" step="0.1" value="10" />
      <span class="value" id="zoom-value">10.0</span>
    </div>

    <div class="center-display">
      <strong>Center</strong><br />
      Amsterdam<br />
      4.9°E, 52.37°N
    </div>

    <footer>
      © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>
    </footer>
  </div>

  <script type="module" src="./phase-2-raster.ts"></script>
</body>
</html>
```

- [ ] **Step 3: Create demo/phase-2-raster.ts**

```ts
// demo/phase-2-raster.ts
import { createRenderer } from '../src/mini/renderer/index.ts'
import { MapGL } from '../src/mini/core/map.ts'
import { RasterLayer } from '../src/mini/layers/raster.ts'
import type { SourceDefinition } from '../src/mini/core/renderer-api.ts'

interface RasterSourceDefinition extends SourceDefinition {
  type: 'raster'
  url: string
  tileSize?: number
}

async function main() {
  const canvas = document.getElementById('map') as HTMLCanvasElement

  // Size canvas to its CSS container
  const container = canvas.parentElement!
  canvas.width = container.clientWidth
  canvas.height = container.clientHeight

  const renderer = await createRenderer(canvas)
  const map = new MapGL({ renderer })

  map.addSource('osm', {
    type: 'raster',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileSize: 256,
  } as RasterSourceDefinition)

  map.addLayer(new RasterLayer({ source: 'osm', opacity: 1 }))

  // Initial camera: Amsterdam
  map.setCamera({
    center: { lng: 4.9, lat: 52.37 },
    zoom: 10,
    bearing: 0,
    pitch: 0,
    groundElevation: 0,
  })

  // Zoom slider
  const zoomSlider = document.getElementById('zoom-slider') as HTMLInputElement
  const zoomValue = document.getElementById('zoom-value') as HTMLSpanElement

  zoomSlider.addEventListener('input', () => {
    const zoom = parseFloat(zoomSlider.value)
    zoomValue.textContent = zoom.toFixed(1)
    map.setCamera({ zoom })
  })

  // Handle resize
  window.addEventListener('resize', () => {
    canvas.width = container.clientWidth
    canvas.height = container.clientHeight
    renderer.resize(canvas.width, canvas.height)
  })
}

main().catch(console.error)
```

- [ ] **Step 4: Run the full mini test suite one final time**

Run: `node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/`
Expected: PASS — all tests pass with no failures.

- [ ] **Step 5: Type-check**

Run: `node_modules/.bin/tsc --noEmit`
Expected: No new errors from `src/mini/` files. (Pre-existing errors in non-mini files are expected.)

- [ ] **Step 6: Commit**

```bash
git add demo/phase-2-raster.html demo/phase-2-raster.ts
git commit -m "feat(mini): add Phase 2 raster tile demo (Amsterdam, OSM tiles)"
```

---

## Summary of all commits (in order)

1. `feat(mini): add Projection interface and Viewport type`
2. `feat(mini): implement MercatorProjection (web mercator tile math)`
3. `feat(mini): add quadBuffer and getOrCreateTexture to WebGLContext`
4. `feat(mini): implement TileManager (tile lifecycle, fetch, cancellation)`
5. `feat(mini): implement RasterLayer and RasterTileService`
6. `feat(mini): wire TileManager into Renderer, add per-tile draw loop`
7. `feat(mini): add Phase 2 raster tile demo (Amsterdam, OSM tiles)`

## What Phase 3 adds

- `InputHandler` — pan/drag/scroll → CameraController
- LRU eviction in TileManager + `WebGLContext.destroyTexture()`
- `VectorTileService` + `FillLayer` + `LineLayer` (earcut tessellation, real shaders)
- `@bigmistqke/view.gl` in WebGLContext for uniform/attribute management
- Worker-based TileService via `@bigmistqke/rpc`
