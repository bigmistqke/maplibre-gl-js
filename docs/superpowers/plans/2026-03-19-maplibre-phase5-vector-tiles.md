# MapLibre Clean-Room — Phase 5: Vector Tiles

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add vector tile rendering. `TileManager` is generalised from `imageBitmap`-specific to generic `Transferable` data. A `VectorTileService` fetches raw PBF bytes on the main thread; a `WorkerVectorTileService` does the same in a Comlink worker. `FillLayer` tessellates polygons with earcut and renders them. `LineLayer` renders polylines with `gl.LINES`. The renderer gains a `vector` source path. Browser tests cover the worker. A Phase 5 demo renders a real MVT endpoint.

**Architecture:** The key insight is that `TileManager` must be source-type-agnostic. `TileEntry.imageBitmap` becomes `data: Transferable`, and `getReadyTiles()` returns `{ tileID, data }`. The renderer checks the source type at render time: raster sources cast `data` to `ImageBitmap` for texture upload; vector sources pass `data` as `tileData` in `DrawContext`. Vector layers decode the `ArrayBuffer` lazily on first `draw()` call per tile, cache GPU geometry buffers keyed by `tileID.key`, and free them when the tile is evicted (via `destroyGeometryBuffers` called from the renderer on eviction).

**Tech Stack:** `@mapbox/vector-tile` + `pbf` (already installed) for MVT parsing, `earcut` (already installed) for polygon tessellation, Comlink for worker RPC.

---

## File Map

| File | Change | Responsibility |
|------|--------|----------------|
| `src/mini/core/render-extension.ts` | Modify | `DrawContext`: `tileTexture` optional, add `tileData?: Transferable` |
| `src/mini/renderer/tile-manager.ts` | Modify | `TileEntry.imageBitmap` → `data?: Transferable`; `getReadyTiles()` returns `{ tileID, data }` |
| `src/mini/renderer/tile-manager.test.ts` | Modify | Update `getReadyTiles()` assertions to use `data` field |
| `src/mini/renderer/webgl-context.ts` | Modify | Add `createGeometryBuffer(key, data, target)` + `destroyGeometryBuffers(prefix)` |
| `src/mini/renderer/webgl-context.test.ts` | Modify | Add geometry buffer tests |
| `src/mini/renderer/renderer.ts` | Modify | Add `VectorSourceDefinition`, `vector` branch in `addSource`; update `renderFrame` to pass `tileData`; wire `destroyGeometryBuffers` on eviction |
| `src/mini/renderer/renderer.test.ts` | Modify | Add vector source + layer tests |
| `src/mini/layers/fill.ts` | Create | `VectorTileService` (main-thread PBF fetch) + `FillLayer` (GLSL + earcut tessellation + draw) |
| `src/mini/layers/fill.test.ts` | Create | Node tests: VectorTileService, tessellation correctness, draw() GL calls |
| `src/mini/layers/line.ts` | Create | `LineLayer` (GLSL + gl.LINES draw) |
| `src/mini/layers/line.test.ts` | Create | Node tests: draw() GL calls |
| `src/mini/layers/vector-worker-service.ts` | Create | `WorkerVectorTileService` — Comlink main-thread wrapper |
| `src/mini/workers/vector-worker.ts` | Create | `VectorWorker` — fetch PBF, return `ArrayBuffer` via Comlink |
| `src/mini/workers/vector-worker-service.browser.test.ts` | Create | Browser tests for `WorkerVectorTileService` |
| `demo/phase5/index.html` | Create | Phase 5 demo HTML |
| `demo/phase5/main.ts` | Create | Phase 5 demo: FillLayer + LineLayer over demotiles.maplibre.org |
| `demo/index.html` | Modify | Add Phase 5 card |
| `vite.config.demo.ts` | Modify | Add `phase5` entry |
| `vitest.config.mini.browser.ts` | Modify | Add PBF tile endpoint to test server plugin |

---

## Task 1: Generalise `DrawContext` — make `tileTexture` optional, add `tileData`

**Files:**
- Modify: `src/mini/core/render-extension.ts`

- [ ] **Step 1: Update `DrawContext` interface**

In `src/mini/core/render-extension.ts`, find the `DrawContext` interface and update:

```ts
export interface DrawContext {
  gl: WebGLRenderingContext
  programs: ProgramCache
  tileID: TileID
  matrix: Float32Array
  zoom: number
  paint: ResolvedPaintProperties
  frameIndex: number
  imageAtlas: ImageAtlas
  lineDashAtlas: LineDashAtlas
  /** Texture for raster layers. Optional — vector layers will not have this. */
  tileTexture?: WebGLTexture
  /** Raw tile data (ArrayBuffer for vector tiles). Optional — raster layers will not have this. */
  tileData?: Transferable
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p /Users/puckey/rg/maplibre-mini/.worktrees/mini-clean/tsconfig.json
```

Expected: `RasterLayer.draw()` uses its own `RasterDrawContext` which extends `DrawContext` and declares `tileTexture: WebGLTexture` (non-optional). No new errors expected.

- [ ] **Step 3: Commit**

```bash
git add src/mini/core/render-extension.ts
git commit -m "feat(mini/p5): DrawContext — tileTexture optional, add tileData transferable"
```

---

## Task 2: Generalise `TileManager` — `imageBitmap` → `data`

**Files:**
- Modify: `src/mini/renderer/tile-manager.ts`
- Modify: `src/mini/renderer/tile-manager.test.ts`

- [ ] **Step 1: Write failing test first**

In `src/mini/renderer/tile-manager.test.ts`, change all occurrences of `.imageBitmap` to `.data` in assertions and mock objects. Also change `tiles.set('tile-A', { status: 'ready', imageBitmap: ... })` → `tiles.set('tile-A', { status: 'ready', data: ... })` throughout the eviction describe block.

- [ ] **Step 2: Run failing test**

```bash
npx vitest --config /Users/puckey/rg/maplibre-mini/.worktrees/mini-clean/vitest.config.mini.ts run --reporter=verbose 2>&1 | grep -E "FAIL|imageBitmap|\.data"
```

Expected: tests fail — `Cannot read properties of undefined (reading 'data')`.

- [ ] **Step 3: Update `TileEntry` interface**

```ts
interface TileEntry {
  status: 'loading' | 'ready' | 'error'
  data?: Transferable
}
```

- [ ] **Step 4: Update `update()` — store `data`**

Change `entry.imageBitmap = transferables[0] as ImageBitmap` → `entry.data = transferables[0]`

- [ ] **Step 5: Update `_evict()` — guard `.close()` call**

```ts
if (entry.data && typeof (entry.data as ImageBitmap).close === 'function') {
  ;(entry.data as ImageBitmap).close()
}
```

- [ ] **Step 6: Update `getReadyTiles()` return type and body**

```ts
getReadyTiles(): Array<{ tileID: TileID; data: Transferable }> {
  const result: Array<{ tileID: TileID; data: Transferable }> = []
  for (const key of this._visibleSet) {
    const entry = this._tiles.get(key)
    if (entry && entry.status === 'ready' && entry.data !== undefined) {
      const [z, x, y] = key.split('/').map(Number)
      result.push({ tileID: { z, x, y, key }, data: entry.data })
    }
  }
  return result
}
```

- [ ] **Step 7: Update `destroy()` — same `.close()` guard**

Same pattern as `_evict()`.

- [ ] **Step 8: Run tests — all pass**

```bash
npx vitest --config /Users/puckey/rg/maplibre-mini/.worktrees/mini-clean/vitest.config.mini.ts run
```

- [ ] **Step 9: Type-check**

```bash
npx tsc --noEmit -p /Users/puckey/rg/maplibre-mini/.worktrees/mini-clean/tsconfig.json
```

Expected: `renderer.ts` will error where it accesses `.imageBitmap` — fix in Task 4.

- [ ] **Step 10: Commit**

```bash
git add src/mini/renderer/tile-manager.ts src/mini/renderer/tile-manager.test.ts
git commit -m "feat(mini/p5): TileManager — generalise TileEntry.data (was imageBitmap)"
```

---

## Task 3: Add geometry buffer management to `WebGLContext`

**Files:**
- Modify: `src/mini/renderer/webgl-context.ts`
- Modify: `src/mini/renderer/webgl-context.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/mini/renderer/webgl-context.test.ts`:

```ts
describe('WebGLContext — geometry buffers', () => {
  let gl: any
  let canvas: { getContext: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    const base = makeGLMock()
    gl = Object.assign(base, {
      createBuffer: vi.fn().mockReturnValue({ _buf: true }),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      deleteBuffer: vi.fn(),
      ARRAY_BUFFER: 34962,
      ELEMENT_ARRAY_BUFFER: 34963,
      STATIC_DRAW: 35044,
    }) as any
    canvas = { getContext: vi.fn().mockReturnValue(gl) }
  })

  it('createGeometryBuffer returns a WebGLBuffer', () => {
    const ctx = new WebGLContext(canvas as any)
    const buf = ctx.createGeometryBuffer('tile:10/1/2:fill:verts', new Float32Array([0, 0, 1, 0, 0.5, 1]), gl.ARRAY_BUFFER)
    expect(buf).toBeDefined()
    expect(gl.createBuffer).toHaveBeenCalled()
    expect(gl.bufferData).toHaveBeenCalled()
  })

  it('createGeometryBuffer returns same buffer for same key', () => {
    const ctx = new WebGLContext(canvas as any)
    const data = new Float32Array([0, 0, 1, 0])
    const b1 = ctx.createGeometryBuffer('key1', data, gl.ARRAY_BUFFER)
    const b2 = ctx.createGeometryBuffer('key1', data, gl.ARRAY_BUFFER)
    expect(b1).toBe(b2)
  })

  it('destroyGeometryBuffers removes all buffers with matching prefix', () => {
    const ctx = new WebGLContext(canvas as any)
    const data = new Float32Array([0, 0, 1, 0])
    ctx.createGeometryBuffer('tile:10/1/2:fill:verts', data, gl.ARRAY_BUFFER)
    ctx.createGeometryBuffer('tile:10/1/2:fill:idx', data, gl.ARRAY_BUFFER)
    ctx.createGeometryBuffer('tile:10/5/5:fill:verts', data, gl.ARRAY_BUFFER)
    ctx.destroyGeometryBuffers('tile:10/1/2')
    expect(gl.deleteBuffer).toHaveBeenCalledTimes(2)
  })

  it('destroyGeometryBuffers is a no-op for unknown prefix', () => {
    const ctx = new WebGLContext(canvas as any)
    expect(() => ctx.destroyGeometryBuffers('nonexistent')).not.toThrow()
    expect(gl.deleteBuffer).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run failing tests**

```bash
npx vitest --config /Users/puckey/rg/maplibre-mini/.worktrees/mini-clean/vitest.config.mini.ts run --reporter=verbose 2>&1 | grep -E "FAIL|geometry"
```

Expected: 4 tests fail with `ctx.createGeometryBuffer is not a function`.

- [ ] **Step 3: Implement geometry buffer methods**

Add to `WebGLContext`:

```ts
private _geometryBuffers = new globalThis.Map<string, WebGLBuffer>()

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
```

- [ ] **Step 4: Run tests — all pass**

```bash
npx vitest --config /Users/puckey/rg/maplibre-mini/.worktrees/mini-clean/vitest.config.mini.ts run
```

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit -p /Users/puckey/rg/maplibre-mini/.worktrees/mini-clean/tsconfig.json
git add src/mini/renderer/webgl-context.ts src/mini/renderer/webgl-context.test.ts
git commit -m "feat(mini/p5): WebGLContext — geometry buffer create/destroy API"
```

---

## Task 4: Update `Renderer` — wire `vector` source type and update `renderFrame`

**Files:**
- Modify: `src/mini/renderer/renderer.ts`
- Modify: `src/mini/renderer/renderer.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/mini/renderer/renderer.test.ts` (hoist `makeCanvas` and `makeProjection` to module scope first):

```ts
describe('Renderer — Phase 5 vector pipeline', () => {
  it('addSource with type "vector" creates a TileManager internally', () => {
    const renderer = new Renderer(makeCanvas(), makeProjection())
    renderer.addSource('mvt', {
      type: 'vector',
      url: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
      tileService: makeFakeTileService(),
    })
    expect((renderer as any)._tileManagers.has('mvt')).toBe(true)
  })

  it('renderFrame passes tileData (not tileTexture) to vector layer draw()', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(cb, 16))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))

    const fakeBuffer = new ArrayBuffer(100)
    const tileService = {
      request: vi.fn().mockResolvedValue([fakeBuffer]),
      cancel: vi.fn(),
      destroy: vi.fn(),
    }
    const renderer = new Renderer(makeCanvas(), makeProjection())
    renderer.addSource('mvt', { type: 'vector', url: 'https://t/{z}/{x}/{y}.pbf', tileService })
    const layer = { id: 'fill', type: 'fill', source: 'mvt', draw: vi.fn() }
    renderer.addLayer(layer as any)
    renderer.setCamera({ center: { lng: 0, lat: 0 }, zoom: 5, bearing: 0, pitch: 0, groundElevation: 0 })

    await vi.waitFor(() => {
      const tm = (renderer as any)._tileManagers.get('mvt')
      if (tm.getReadyTiles().length === 0) throw new Error('not ready')
    })
    renderer.renderFrame()

    expect(layer.draw).toHaveBeenCalled()
    const ctx = layer.draw.mock.calls[0][0]
    expect(ctx.tileData).toBe(fakeBuffer)
    expect(ctx.tileTexture).toBeUndefined()

    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Run failing tests**

```bash
npx vitest --config /Users/puckey/rg/maplibre-mini/.worktrees/mini-clean/vitest.config.mini.ts run --reporter=verbose 2>&1 | grep -E "FAIL|vector|tileData"
```

- [ ] **Step 3: Add `VectorSourceDefinition` and `_sourceTypes` map to renderer**

```ts
interface VectorSourceDefinition extends SourceDefinition {
  type: 'vector'
  url: string
  tileSize?: number
  tileService?: TileService  // defaults to WorkerVectorTileService (wired in Task 8)
}

// Add field:
private _sourceTypes = new globalThis.Map<string, 'raster' | 'vector'>()
```

- [ ] **Step 4: Add `vector` branch in `addSource()`**

After the existing raster block, add:

```ts
if (source.type === 'vector') {
  const vectorSource = source as VectorSourceDefinition
  const svc = vectorSource.tileService
  if (!svc) throw new Error('vector source requires tileService (WorkerVectorTileService not yet wired)')
  const tm = new TileManager(
    vectorSource.url,
    svc,
    this._projection,
    () => this._frameLoop.markDirty(),
    (key) => this._webgl.destroyGeometryBuffers(`tile:${key}`),
  )
  this._tileManagers.set(id, tm)
  this._sourceTypes.set(id, 'vector')
  if (this._camera) {
    const viewport: Viewport = { width: this._width, height: this._height }
    tm.updateCacheSize(viewport)
    tm.update(this._camera, viewport)
  }
}
```

Also add `this._sourceTypes.set(id, 'raster')` in the raster branch and `this._sourceTypes.delete(id)` in `removeSource()`.

- [ ] **Step 5: Update `renderFrame()` per-tile loop**

```ts
for (const [sourceId, tileManager] of this._tileManagers) {
  const readyTiles = tileManager.getReadyTiles()
  const layers = this._tileLayers.get(sourceId) ?? []
  const sourceType = this._sourceTypes.get(sourceId) ?? 'raster'

  for (const { tileID, data } of readyTiles) {
    const matrix = this._projection.getTileMatrix(tileID, camera, viewport)

    let tileTexture: WebGLTexture | undefined
    if (sourceType === 'raster') {
      tileTexture = this._webgl.getOrCreateTexture(tileID.key, data as ImageBitmap)
    }

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
        tileData: sourceType === 'vector' ? data : undefined,
        imageAtlas: {},
        lineDashAtlas: {},
      })
    }
  }
}
```

- [ ] **Step 6: Run tests — all pass**

```bash
npx vitest --config /Users/puckey/rg/maplibre-mini/.worktrees/mini-clean/vitest.config.mini.ts run
```

- [ ] **Step 7: Type-check and commit**

```bash
npx tsc --noEmit -p /Users/puckey/rg/maplibre-mini/.worktrees/mini-clean/tsconfig.json
git add src/mini/renderer/renderer.ts src/mini/renderer/renderer.test.ts
git commit -m "feat(mini/p5): Renderer — vector source type, split raster/vector render paths"
```

---

## Task 5: `VectorTileService` (main-thread PBF fetch)

**Files:**
- Create: `src/mini/layers/fill.ts` (service only)
- Create: `src/mini/layers/fill.test.ts` (service tests)

- [ ] **Step 1: Write failing tests**

Create `src/mini/layers/fill.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VectorTileService } from './fill.ts'
import type { TileID } from '../core/types.ts'

const FAKE_TILE: TileID = { z: 10, x: 1, y: 2, key: '10/1/2' }
const FAKE_URL = 'https://tiles.example.com/10/1/2.pbf'

describe('VectorTileService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(42)),
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('request() returns [ArrayBuffer] on success', async () => {
    const result = await new VectorTileService().request(FAKE_TILE, FAKE_URL)
    expect(result).toHaveLength(1)
    expect(result[0]).toBeInstanceOf(ArrayBuffer)
  })

  it('request() returns [] when fetch fails (HTTP 404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const result = await new VectorTileService().request(FAKE_TILE, FAKE_URL)
    expect(result).toHaveLength(0)
  })

  it('request() returns [] when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const result = await new VectorTileService().request(FAKE_TILE, FAKE_URL)
    expect(result).toHaveLength(0)
  })

  it('cancel() causes request() to return []', async () => {
    let resolve!: (v: any) => void
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(r => { resolve = r })))
    const service = new VectorTileService()
    const promise = service.request(FAKE_TILE, FAKE_URL)
    service.cancel(FAKE_TILE.key)
    resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(42)) })
    expect(await promise).toHaveLength(0)
  })

  it('destroy() aborts all in-flight requests', async () => {
    let resolve!: (v: any) => void
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(r => { resolve = r })))
    const service = new VectorTileService()
    const promise = service.request(FAKE_TILE, FAKE_URL)
    service.destroy()
    resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(42)) })
    expect(await promise).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run failing tests** (expect module not found)

- [ ] **Step 3: Implement `VectorTileService`**

Create `src/mini/layers/fill.ts`:

```ts
// src/mini/layers/fill.ts
import type { TileID } from '../core/types.ts'
import type { TileService } from '../core/tile-service.ts'

export class VectorTileService implements TileService {
  private _pending = new globalThis.Map<string, AbortController>()

  async request(tileID: TileID, url: string): Promise<Transferable[]> {
    const controller = new AbortController()
    this._pending.set(tileID.key, controller)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = await res.arrayBuffer()
      if (!this._pending.has(tileID.key)) return []
      this._pending.delete(tileID.key)
      return [buf]
    } catch {
      this._pending.delete(tileID.key)
      return []
    }
  }

  cancel(key: string): void {
    this._pending.get(key)?.abort()
    this._pending.delete(key)
  }

  destroy(): void {
    for (const c of this._pending.values()) c.abort()
    this._pending.clear()
  }
}
```

- [ ] **Step 4: Run tests — all pass**

- [ ] **Step 5: Type-check and commit**

```bash
git add src/mini/layers/fill.ts src/mini/layers/fill.test.ts
git commit -m "feat(mini/p5): VectorTileService — main-thread PBF fetch"
```

---

## Task 6: `FillLayer` — tessellation and draw

**Files:**
- Modify: `src/mini/layers/fill.ts`
- Modify: `src/mini/layers/fill.test.ts`

**MVT coordinates:** `@mapbox/vector-tile` returns points in tile space [0, 4096]. Vertex shader divides by 4096.0, then the tile matrix maps to clip space — same as the raster quad uses [0,1].

**Geometry buffer keys:** `tile:${key}:fill:verts` and `tile:${key}:fill:idx`. The prefix `tile:${key}` matches the eviction call `destroyGeometryBuffers('tile:' + key)` which cleans up all buffers for that tile.

- [ ] **Step 1: Write failing tests**

Add to `src/mini/layers/fill.test.ts`:

```ts
import { FillLayer, tessellatePolygon } from './fill.ts'
import type { DrawContext } from '../core/render-extension.ts'

function makeGLForFill() {
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
    uniform4f: vi.fn(),
    drawElements: vi.fn(),
    ARRAY_BUFFER: 34962,
    ELEMENT_ARRAY_BUFFER: 34963,
    STATIC_DRAW: 35044,
    FLOAT: 5126,
    TRIANGLES: 4,
    UNSIGNED_SHORT: 5123,
  } as unknown as WebGLRenderingContext
}

describe('tessellatePolygon', () => {
  it('returns 6 indices for a unit square', () => {
    const rings = [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]]
    const { vertices, indices } = tessellatePolygon(rings)
    expect(vertices).toBeInstanceOf(Float32Array)
    expect(indices).toBeInstanceOf(Uint16Array)
    expect(indices.length).toBe(6)
  })

  it('returns 3 indices for a triangle', () => {
    const rings = [[{ x: 0, y: 0 }, { x: 4096, y: 0 }, { x: 2048, y: 4096 }]]
    expect(tessellatePolygon(rings).indices.length).toBe(3)
  })
})

describe('FillLayer', () => {
  it('has type "fill"', () => {
    expect(new FillLayer({ source: 'mvt', sourceLayer: 'water' }).type).toBe('fill')
  })

  it('has static programs with a "fill" entry', () => {
    expect(FillLayer.programs[0].name).toBe('fill')
  })

  it('has static TileService pointing to VectorTileService', () => {
    expect(FillLayer.TileService).toBe(VectorTileService)
  })

  it('draw() with no tileData does nothing', () => {
    const gl = makeGLForFill()
    const layer = new FillLayer({ source: 'mvt', sourceLayer: 'water' })
    layer.onAdd({ _webgl: { createGeometryBuffer: vi.fn() } } as any)
    layer.draw({ gl, programs: { get: vi.fn().mockReturnValue({}) }, tileID: { z:0,x:0,y:0,key:'0/0/0' }, matrix: new Float32Array(16), zoom: 0, paint: {}, frameIndex: 0, imageAtlas: {}, lineDashAtlas: {}, tileData: undefined } as any)
    expect(gl.drawElements).not.toHaveBeenCalled()
  })

  it('draw() calls gl.drawElements for valid PBF data', () => {
    vi.mock('@mapbox/vector-tile', () => ({
      default: class {
        layers = { water: { length: 1, feature: () => ({ type: 3, loadGeometry: () => [[{ x:0,y:0 }, { x:4096,y:0 }, { x:4096,y:4096 }, { x:0,y:4096 }]] }) } }
      }
    }))
    const gl = makeGLForFill()
    const fakeWebgl = { createGeometryBuffer: vi.fn().mockReturnValue({}) }
    const layer = new FillLayer({ source: 'mvt', sourceLayer: 'water' })
    layer.onAdd({ _webgl: fakeWebgl } as any)
    layer.draw({ gl, programs: { get: vi.fn().mockReturnValue({}) }, tileID: { z:10,x:1,y:2,key:'10/1/2' }, matrix: new Float32Array(16), zoom: 10, paint: { 'fill-color': '#0000ff' }, frameIndex: 0, imageAtlas: {}, lineDashAtlas: {}, tileData: new ArrayBuffer(1) } as any)
    expect(gl.drawElements).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run failing tests**

- [ ] **Step 3: Implement `FillLayer`**

Append to `src/mini/layers/fill.ts`:

```ts
import type { ProgramDefinition } from '../core/types.ts'
import type { DrawContext } from '../core/render-extension.ts'
import type { RendererAPI } from '../core/renderer-api.ts'
import VectorTile from '@mapbox/vector-tile'
import Pbf from 'pbf'
import earcut from 'earcut'

// GLSL
const fillVert = `
attribute vec2 a_pos;
uniform mat4 u_matrix;
void main() {
  gl_Position = u_matrix * vec4(a_pos / 4096.0, 0.0, 1.0);
}
`
const fillFrag = `
precision mediump float;
uniform vec4 u_color;
void main() { gl_FragColor = u_color; }
`

// Tessellation
interface Point { x: number; y: number }
export interface TessellationResult { vertices: Float32Array; indices: Uint16Array }

export function tessellatePolygon(rings: Point[][]): TessellationResult {
  const flat: number[] = []
  const holes: number[] = []
  let vi = 0
  for (let r = 0; r < rings.length; r++) {
    if (r > 0) holes.push(vi)
    for (const p of rings[r]) { flat.push(p.x, p.y); vi++ }
  }
  return {
    vertices: new Float32Array(flat),
    indices: new Uint16Array(earcut(flat, holes.length ? holes : undefined, 2)),
  }
}

function parseColor(c: string): [number, number, number, number] {
  const h = c.replace('#', '')
  if (h.length === 3) return [parseInt(h[0]+h[0],16)/255, parseInt(h[1]+h[1],16)/255, parseInt(h[2]+h[2],16)/255, 1]
  return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255, 1]
}

export interface FillLayerOptions {
  source: string
  sourceLayer: string
  color?: string
  opacity?: number
}

export class FillLayer {
  readonly type = 'fill' as const
  static programs: ProgramDefinition[] = [{ name: 'fill', vertex: fillVert, fragment: fillFrag }]
  static TileService = VectorTileService

  readonly source: string
  readonly sourceLayer: string
  readonly color: string
  readonly opacity: number

  private _tileBuffers = new globalThis.Map<string, { verts: WebGLBuffer; idx: WebGLBuffer; count: number }>()
  private _decoded = new globalThis.Set<string>()
  private _webgl!: { createGeometryBuffer(key: string, data: ArrayBufferView, target: number): WebGLBuffer }

  constructor(options: FillLayerOptions) {
    this.source = options.source
    this.sourceLayer = options.sourceLayer
    this.color = options.color ?? '#000000'
    this.opacity = options.opacity ?? 1
  }

  onAdd(renderer: RendererAPI): void {
    this._webgl = (renderer as any)._webgl
  }

  draw(ctx: DrawContext): void {
    const { gl, programs, matrix, paint, tileID, tileData } = ctx
    if (!tileData) return
    const program = programs.get('fill')
    if (!program) return

    const key = tileID.key
    if (!this._decoded.has(key)) {
      this._decoded.add(key)
      const tile = new VectorTile(new Pbf(tileData as ArrayBuffer))
      const layer = tile.layers[this.sourceLayer]
      if (!layer || layer.length === 0) return

      const allVerts: number[] = []
      const allIdx: number[] = []
      let vertOffset = 0

      for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i)
        if (feat.type !== 3) continue
        const { vertices, indices } = tessellatePolygon(feat.loadGeometry())
        for (const v of vertices) allVerts.push(v)
        for (const idx of indices) allIdx.push(idx + vertOffset)
        vertOffset += vertices.length / 2
      }

      if (allIdx.length === 0) return

      const vertBuf = this._webgl.createGeometryBuffer(`tile:${key}:fill:verts`, new Float32Array(allVerts), gl.ARRAY_BUFFER)
      const idxBuf = this._webgl.createGeometryBuffer(`tile:${key}:fill:idx`, new Uint16Array(allIdx), gl.ELEMENT_ARRAY_BUFFER)
      this._tileBuffers.set(key, { verts: vertBuf, idx: idxBuf, count: allIdx.length })
    }

    const bufs = this._tileBuffers.get(key)
    if (!bufs) return

    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.verts)
    const aPos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_matrix'), false, matrix)
    const [r, g, b, a] = parseColor((paint['fill-color'] as string | undefined) ?? this.color)
    gl.uniform4f(gl.getUniformLocation(program, 'u_color'), r, g, b, a * ((paint['fill-opacity'] as number | undefined) ?? this.opacity))
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.idx)
    gl.drawElements(gl.TRIANGLES, bufs.count, gl.UNSIGNED_SHORT, 0)
  }
}
```

- [ ] **Step 4: Run tests — all pass**

- [ ] **Step 5: Type-check and commit**

```bash
git add src/mini/layers/fill.ts src/mini/layers/fill.test.ts
git commit -m "feat(mini/p5): FillLayer — earcut tessellation, fill GLSL program"
```

---

## Task 7: `LineLayer` — line rendering

**Files:**
- Create: `src/mini/layers/line.ts`
- Create: `src/mini/layers/line.test.ts`

**Encoding:** Convert each ring `[p0, p1, p2, ..., pN-1]` into adjacent pairs `[p0,p1, p1,p2, ..., pN-2,pN-1]` and upload as a flat `Float32Array`. Draw with `gl.LINES`. This batches all features into one draw call per tile.

- [ ] **Step 1: Write failing tests**

Create `src/mini/layers/line.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { LineLayer } from './line.ts'

function makeGL() {
  return {
    createBuffer: vi.fn().mockReturnValue({}), bindBuffer: vi.fn(), bufferData: vi.fn(),
    getAttribLocation: vi.fn().mockReturnValue(0), enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(), useProgram: vi.fn(),
    getUniformLocation: vi.fn().mockReturnValue({}), uniformMatrix4fv: vi.fn(),
    uniform4f: vi.fn(), drawArrays: vi.fn(),
    ARRAY_BUFFER: 34962, STATIC_DRAW: 35044, FLOAT: 5126, LINES: 1,
  } as unknown as WebGLRenderingContext
}

describe('LineLayer', () => {
  it('has type "line"', () => expect(new LineLayer({ source: 'mvt', sourceLayer: 'roads' }).type).toBe('line'))
  it('has static programs with a "line" entry', () => expect(LineLayer.programs[0].name).toBe('line'))

  it('draw() with no tileData does nothing', () => {
    const gl = makeGL()
    const layer = new LineLayer({ source: 'mvt', sourceLayer: 'roads' })
    layer.onAdd({ _webgl: { createGeometryBuffer: vi.fn() } } as any)
    layer.draw({ gl, programs: { get: vi.fn().mockReturnValue({}) }, tileID: { z:0,x:0,y:0,key:'0/0/0' }, matrix: new Float32Array(16), zoom:0, paint:{}, frameIndex:0, imageAtlas:{}, lineDashAtlas:{}, tileData:undefined } as any)
    expect(gl.drawArrays).not.toHaveBeenCalled()
  })

  it('draw() calls gl.drawArrays(gl.LINES, ...) for valid PBF data', () => {
    vi.mock('@mapbox/vector-tile', () => ({
      default: class {
        layers = { roads: { length: 1, feature: () => ({ type: 2, loadGeometry: () => [[{ x:0,y:0 }, { x:2048,y:0 }, { x:4096,y:4096 }]] }) } }
      }
    }))
    const gl = makeGL()
    const layer = new LineLayer({ source: 'mvt', sourceLayer: 'roads' })
    layer.onAdd({ _webgl: { createGeometryBuffer: vi.fn().mockReturnValue({}) } } as any)
    layer.draw({ gl, programs: { get: vi.fn().mockReturnValue({}) }, tileID: { z:10,x:1,y:2,key:'10/1/2' }, matrix: new Float32Array(16), zoom:10, paint:{ 'line-color':'#ff0000' }, frameIndex:0, imageAtlas:{}, lineDashAtlas:{}, tileData: new ArrayBuffer(1) } as any)
    expect(gl.drawArrays).toHaveBeenCalledWith(gl.LINES, 0, expect.any(Number))
  })
})
```

- [ ] **Step 2: Run failing tests**

- [ ] **Step 3: Implement `LineLayer`**

Create `src/mini/layers/line.ts`:

```ts
// src/mini/layers/line.ts
import type { ProgramDefinition } from '../core/types.ts'
import type { DrawContext } from '../core/render-extension.ts'
import type { RendererAPI } from '../core/renderer-api.ts'
import VectorTile from '@mapbox/vector-tile'
import Pbf from 'pbf'

const lineVert = `
attribute vec2 a_pos;
uniform mat4 u_matrix;
void main() { gl_Position = u_matrix * vec4(a_pos / 4096.0, 0.0, 1.0); }
`
const lineFrag = `
precision mediump float;
uniform vec4 u_color;
void main() { gl_FragColor = u_color; }
`

function parseColor(c: string): [number, number, number, number] {
  const h = c.replace('#', '')
  if (h.length === 3) return [parseInt(h[0]+h[0],16)/255, parseInt(h[1]+h[1],16)/255, parseInt(h[2]+h[2],16)/255, 1]
  return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255, 1]
}

export interface LineLayerOptions { source: string; sourceLayer: string; color?: string; opacity?: number }

export class LineLayer {
  readonly type = 'line' as const
  static programs: ProgramDefinition[] = [{ name: 'line', vertex: lineVert, fragment: lineFrag }]

  readonly source: string
  readonly sourceLayer: string
  readonly color: string
  readonly opacity: number

  private _tileBuffers = new globalThis.Map<string, { verts: WebGLBuffer; count: number }>()
  private _decoded = new globalThis.Set<string>()
  private _webgl!: { createGeometryBuffer(key: string, data: ArrayBufferView, target: number): WebGLBuffer }

  constructor(options: LineLayerOptions) {
    this.source = options.source
    this.sourceLayer = options.sourceLayer
    this.color = options.color ?? '#000000'
    this.opacity = options.opacity ?? 1
  }

  onAdd(renderer: RendererAPI): void { this._webgl = (renderer as any)._webgl }

  draw(ctx: DrawContext): void {
    const { gl, programs, matrix, paint, tileID, tileData } = ctx
    if (!tileData) return
    const program = programs.get('line')
    if (!program) return

    const key = tileID.key
    if (!this._decoded.has(key)) {
      this._decoded.add(key)
      const tile = new VectorTile(new Pbf(tileData as ArrayBuffer))
      const layer = tile.layers[this.sourceLayer]
      if (!layer || layer.length === 0) return

      const verts: number[] = []
      for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i)
        if (feat.type !== 2) continue
        for (const ring of feat.loadGeometry()) {
          for (let j = 0; j < ring.length - 1; j++) {
            verts.push(ring[j].x, ring[j].y, ring[j+1].x, ring[j+1].y)
          }
        }
      }
      if (verts.length === 0) return

      const vertBuf = this._webgl.createGeometryBuffer(`tile:${key}:line:verts`, new Float32Array(verts), gl.ARRAY_BUFFER)
      this._tileBuffers.set(key, { verts: vertBuf, count: verts.length / 2 })
    }

    const bufs = this._tileBuffers.get(key)
    if (!bufs) return

    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.verts)
    const aPos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_matrix'), false, matrix)
    const [r, g, b, a] = parseColor((paint['line-color'] as string | undefined) ?? this.color)
    gl.uniform4f(gl.getUniformLocation(program, 'u_color'), r, g, b, a * ((paint['line-opacity'] as number | undefined) ?? this.opacity))
    gl.drawArrays(gl.LINES, 0, bufs.count)
  }
}
```

- [ ] **Step 4: Run tests — all pass**

- [ ] **Step 5: Type-check and commit**

```bash
git add src/mini/layers/line.ts src/mini/layers/line.test.ts
git commit -m "feat(mini/p5): LineLayer — gl.LINES rendering from MVT LineString features"
```

---

## Task 8: `VectorWorker` + `WorkerVectorTileService`

**Files:**
- Create: `src/mini/workers/vector-worker.ts`
- Create: `src/mini/layers/vector-worker-service.ts`
- Modify: `src/mini/renderer/renderer.ts` (uncomment import + default)

- [ ] **Step 1: Create `src/mini/workers/vector-worker.ts`**

```ts
import * as Comlink from 'comlink'

export class VectorWorker {
  private _pending = new globalThis.Map<string, AbortController>()

  async request(key: string, url: string): Promise<ArrayBuffer | null> {
    const controller = new AbortController()
    this._pending.set(key, controller)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = await res.arrayBuffer()
      if (!this._pending.has(key)) return null
      this._pending.delete(key)
      return buf
    } catch {
      this._pending.delete(key)
      return null
    }
  }

  cancel(key: string): void {
    this._pending.get(key)?.abort()
    this._pending.delete(key)
  }
}

Comlink.expose(new VectorWorker())
```

- [ ] **Step 2: Create `src/mini/layers/vector-worker-service.ts`**

```ts
import * as Comlink from 'comlink'
import type { Remote } from 'comlink'
import type { TileID } from '../core/types.ts'
import type { TileService } from '../core/tile-service.ts'

type VectorWorkerType = import('../workers/vector-worker.ts').VectorWorker

export class WorkerVectorTileService implements TileService {
  private _worker: Worker
  private _proxy: Remote<VectorWorkerType>

  constructor() {
    this._worker = new Worker(
      new URL('../workers/vector-worker.ts', import.meta.url),
      { type: 'module' },
    )
    this._proxy = Comlink.wrap<VectorWorkerType>(this._worker)
  }

  async request(tileID: TileID, url: string): Promise<Transferable[]> {
    const buf = await this._proxy.request(tileID.key, url)
    return buf ? [buf] : []
  }

  cancel(key: string): void { void this._proxy.cancel(key) }

  destroy(): void {
    this._proxy[Comlink.releaseProxy]()
    this._worker.terminate()
  }
}
```

- [ ] **Step 3: Wire as default in `renderer.ts`**

Add import:
```ts
import { WorkerVectorTileService } from '../layers/vector-worker-service.ts'
```

Change the guard in the `vector` branch of `addSource()`:
```ts
const svc = vectorSource.tileService ?? new WorkerVectorTileService()
```
Remove the `throw new Error(...)`.

- [ ] **Step 4: Run Node tests — all pass**

```bash
npx vitest --config /Users/puckey/rg/maplibre-mini/.worktrees/mini-clean/vitest.config.mini.ts run
```

- [ ] **Step 5: Type-check and commit**

```bash
git add src/mini/workers/vector-worker.ts src/mini/layers/vector-worker-service.ts src/mini/renderer/renderer.ts
git commit -m "feat(mini/p5): VectorWorker + WorkerVectorTileService (Comlink), wire as vector source default"
```

---

## Task 9: Browser tests for `WorkerVectorTileService`

**Files:**
- Create: `src/mini/workers/vector-worker-service.browser.test.ts`
- Modify: `vitest.config.mini.browser.ts`

- [ ] **Step 1: Add PBF endpoint to test tile server**

In `vitest.config.mini.browser.ts`, update `testTileServerPlugin` to serve an empty PBF for `.pbf` URLs:

```ts
const FAKE_PBF = Buffer.alloc(0)

// In configureServer handler, add before the else clause:
} else if (req.url.endsWith('.pbf')) {
  res.setHeader('Content-Type', 'application/x-protobuf')
  res.setHeader('Content-Length', '0')
  res.end(FAKE_PBF)
} else {
  // ... existing PNG handler
```

- [ ] **Step 2: Create browser test file**

Create `src/mini/workers/vector-worker-service.browser.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { WorkerVectorTileService } from '../layers/vector-worker-service.ts'
import type { TileID } from '../core/types.ts'

const FAKE_TILE: TileID = { z: 10, x: 1, y: 2, key: '10/1/2' }
const TILE_BASE = `${location.origin}/__test-tiles__`

describe('WorkerVectorTileService (browser)', () => {
  it('request() returns an ArrayBuffer for a valid PBF URL', async () => {
    const service = new WorkerVectorTileService()
    const result = await service.request(FAKE_TILE, `${TILE_BASE}/10/1/2.pbf`)
    expect(result).toHaveLength(1)
    expect(result[0]).toBeInstanceOf(ArrayBuffer)
    service.destroy()
  })

  it('request() returns [] for a failed fetch (HTTP 500)', async () => {
    const service = new WorkerVectorTileService()
    const result = await service.request(FAKE_TILE, `${TILE_BASE}/error/0/0.pbf`)
    expect(result).toHaveLength(0)
    service.destroy()
  })

  it('cancel() before result resolves returns []', async () => {
    const service = new WorkerVectorTileService()
    const promise = service.request(FAKE_TILE, `${TILE_BASE}/10/1/2.pbf`)
    service.cancel(FAKE_TILE.key)
    expect(await promise).toHaveLength(0)
    service.destroy()
  })

  it('destroy() does not throw', () => {
    expect(() => new WorkerVectorTileService().destroy()).not.toThrow()
  })
})
```

- [ ] **Step 3: Run browser tests** (from unsandboxed terminal)

```bash
npx vitest --config /Users/puckey/rg/maplibre-mini/.worktrees/mini-clean/vitest.config.mini.browser.ts run
```

Expected: 8 tests pass (4 raster + 4 vector).

- [ ] **Step 4: Run all Node tests — still pass**

- [ ] **Step 5: Commit**

```bash
git add src/mini/workers/vector-worker-service.browser.test.ts vitest.config.mini.browser.ts
git commit -m "test(mini/p5): browser tests for WorkerVectorTileService (Comlink PBF worker)"
```

---

## Task 10: Phase 5 demo

**Files:**
- Create: `demo/phase5/index.html`
- Create: `demo/phase5/main.ts`
- Modify: `demo/index.html`
- Modify: `vite.config.demo.ts`

**Tile source:** `https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf` — public, no API key. Schema has a `countries` source layer (Polygon + LineString features).

- [ ] **Step 1: Create `demo/phase5/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Phase 5 — Vector Tiles</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #111; color: #eee; font-family: system-ui, sans-serif; display: flex; height: 100vh; }
    canvas { display: block; flex: 1; }
    #sidebar { width: 220px; padding: 16px; background: #1a1a1a; border-left: 1px solid #2a2a2a; display: flex; flex-direction: column; gap: 16px; }
    .back { font-size: 11px; opacity: 0.4; text-decoration: none; color: inherit; }
    .back:hover { opacity: 0.8; }
    .phase-badge { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.3; }
    h2 { font-size: 14px; }
    label { font-size: 12px; opacity: 0.6; display: block; margin-bottom: 4px; }
    input[type=range] { width: 100%; accent-color: #4af; }
    .field { display: flex; flex-direction: column; gap: 2px; }
    .value { font-size: 11px; opacity: 0.4; }
    .layer-toggle { display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; }
    .layer-toggle input { accent-color: #4af; }
    #status { font-size: 11px; opacity: 0.35; margin-top: auto; }
  </style>
</head>
<body>
  <canvas id="map"></canvas>
  <div id="sidebar">
    <a class="back" href="../">← all demos</a>
    <div>
      <div class="phase-badge">Phase 5</div>
      <h2>Vector Tiles</h2>
    </div>
    <div class="field">
      <label>Zoom</label>
      <input type="range" id="zoom" min="0" max="8" step="0.1" value="1" />
      <span class="value" id="zoom-val">1.0</span>
    </div>
    <div class="field">
      <label>Layers</label>
      <label class="layer-toggle"><input type="checkbox" id="toggle-fill" checked /> Fill (countries)</label>
      <label class="layer-toggle"><input type="checkbox" id="toggle-lines" checked /> Lines (borders)</label>
    </div>
    <div id="status">Initializing…</div>
  </div>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create `demo/phase5/main.ts`**

```ts
import { createRenderer } from '../../src/mini/renderer/index.ts'
import { MapGL } from '../../src/mini/core/map.ts'
import { BackgroundLayer } from '../../src/mini/layers/background.ts'
import { FillLayer } from '../../src/mini/layers/fill.ts'
import { LineLayer } from '../../src/mini/layers/line.ts'

const canvas = document.getElementById('map') as HTMLCanvasElement
const status = document.getElementById('status')!

function resize() {
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * devicePixelRatio
  canvas.height = rect.height * devicePixelRatio
}
resize()
window.addEventListener('resize', resize)

const renderer = await createRenderer(canvas)
const map = new MapGL({
  renderer,
  initialCamera: { center: { lng: 0, lat: 20 }, zoom: 1 },
})

map.addLayer(new BackgroundLayer({ color: '#1a1a2e', opacity: 1 }))

map.addSource('mvt', {
  type: 'vector',
  url: 'https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf',
})

const fillLayer = new FillLayer({ source: 'mvt', sourceLayer: 'countries', color: '#2d4a7a', opacity: 0.85 })
const lineLayer = new LineLayer({ source: 'mvt', sourceLayer: 'countries', color: '#5b8ed6', opacity: 1 })
Object.assign(fillLayer, { id: 'fill' })
Object.assign(lineLayer, { id: 'lines' })

map.addLayer(fillLayer)
map.addLayer(lineLayer)
status.textContent = 'Ready — vector tiles (demotiles.maplibre.org)'

const zoomInput = document.getElementById('zoom') as HTMLInputElement
const zoomVal = document.getElementById('zoom-val')!

zoomInput.addEventListener('input', () => {
  const zoom = parseFloat(zoomInput.value)
  map.setCamera({ zoom })
  zoomVal.textContent = zoom.toFixed(1)
})

map.on('move', (state: { zoom: number }) => {
  zoomInput.value = state.zoom.toFixed(1)
  zoomVal.textContent = state.zoom.toFixed(1)
})

document.getElementById('toggle-fill')!.addEventListener('change', (e) => {
  map.setLayerVisibility('fill', (e.target as HTMLInputElement).checked)
})
document.getElementById('toggle-lines')!.addEventListener('change', (e) => {
  map.setLayerVisibility('lines', (e.target as HTMLInputElement).checked)
})
```

- [ ] **Step 3: Add Phase 5 card to `demo/index.html`**

Add inside `.grid`:
```html
<a class="card" href="./phase5/">
  <span class="card-phase">Phase 5</span>
  <span class="card-title">Vector Tiles</span>
  <span class="card-desc">MVT polygon fill and line rendering with earcut tessellation. Tile decode in a Comlink worker.</span>
</a>
```

- [ ] **Step 4: Add phase5 to `vite.config.demo.ts`**

```ts
phase5: resolve(__dirname, 'demo/phase5/index.html'),
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit -p /Users/puckey/rg/maplibre-mini/.worktrees/mini-clean/tsconfig.json
```

- [ ] **Step 6: Smoke-test**

Start the demo server and open `http://localhost:5173/phase5/`. Verify countries render as dark blue polygons with lighter blue borders.

- [ ] **Step 7: Commit**

```bash
git add demo/phase5/ demo/index.html vite.config.demo.ts
git commit -m "feat(mini/p5): Phase 5 demo — FillLayer + LineLayer over demotiles.maplibre.org MVT"
```

---

## Task 11: Final verification

- [ ] **Step 1: All Node tests pass**

```bash
npx vitest --config /Users/puckey/rg/maplibre-mini/.worktrees/mini-clean/vitest.config.mini.ts run
```

- [ ] **Step 2: All browser tests pass** (from unsandboxed terminal)

```bash
npx vitest --config /Users/puckey/rg/maplibre-mini/.worktrees/mini-clean/vitest.config.mini.browser.ts run
```

- [ ] **Step 3: Full type-check clean**

```bash
npx tsc --noEmit -p /Users/puckey/rg/maplibre-mini/.worktrees/mini-clean/tsconfig.json
```

---

## Key Design Decisions

**`data: Transferable` (not a union) in TileEntry** — TileManager stays generic. The renderer knows the source type and casts at the call site. Both `ImageBitmap` and `ArrayBuffer` satisfy `Transferable`.

**Geometry buffers in `WebGLContext`, not in layers** — The eviction callback fires `destroyGeometryBuffers('tile:' + key)`, cleaning up all layer buffers for that tile in one call, regardless of how many vector layers exist.

**Lazy decode in `draw()`** — `tileData` arrives asynchronously. There is no lifecycle event to hook into. The `_decoded` set ensures PBF parse + tessellation happens exactly once per tile per layer.

**`tessellatePolygon` exported** — Pure function with non-trivial earcut integration, tested independently for index count correctness.

**`gl.LINES` for LineLayer** — Multiple features batched into one draw call. `gl.LINE_STRIP` would connect ring ends, producing incorrect geometry. Width is limited to 1px on most drivers; true thick lines require triangle extrusion (future phase).

**`VectorTileService` co-located with `FillLayer` in `fill.ts`** — Mirrors how `RasterTileService` lives in `raster.ts`. Each layer module carries its main-thread service implementation.
