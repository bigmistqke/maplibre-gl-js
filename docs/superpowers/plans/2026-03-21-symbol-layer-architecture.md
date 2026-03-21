# Symbol Layer Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor three independent symbol layers into a shared base class + engine architecture with composable tile fetching and shared atlas resources.

**Architecture:** `SymbolLayerBase` abstract class with `TileFetcher<T>` composition and a lazily-created `SymbolEngine` (stored in a static `WeakMap`) that composes a `LayoutEngine` (collision/placement) and `ResourceManager` (atlas dedup). TextLayer, LineTextLayer, and IconLayer extend the base class.

**Tech Stack:** TypeScript strict, Vitest (`npx vitest run --config vitest.config.unit.ts <path>`), WebGL mocked via `vitest-webgl-canvas-mock`

**Spec:** `docs/superpowers/specs/2026-03-21-symbol-layer-architecture-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/modular/layers/symbol/base/tile-fetcher.ts` | Create | Generic async tile lifecycle helper |
| `src/modular/layers/symbol/base/tile-fetcher.test.ts` | Create | TileFetcher unit tests |
| `src/modular/layers/symbol/base/types.ts` | Create | GPUBucket, CollisionData, shared types |
| `src/modular/layers/symbol/base/symbol-layer-base.ts` | Create | Abstract base class |
| `src/modular/layers/symbol/base/symbol-layer-base.test.ts` | Create | Base class unit tests |
| `src/modular/layers/symbol/engine/layout-engine.ts` | Create | Collision/placement logic |
| `src/modular/layers/symbol/engine/layout-engine.test.ts` | Create | LayoutEngine unit tests |
| `src/modular/layers/symbol/engine/resource-manager.ts` | Create | Atlas dedup + listener fan-out |
| `src/modular/layers/symbol/engine/resource-manager.test.ts` | Create | ResourceManager unit tests |
| `src/modular/layers/symbol/engine/symbol-engine.ts` | Create | Thin coordinator |
| `src/modular/layers/symbol/engine/symbol-engine.test.ts` | Create | SymbolEngine lifecycle tests |
| `src/modular/layers/symbol/ensure-glyphs.ts` | Create | Shared glyph pre-scanning utility |
| `src/modular/layers/symbol/ensure-glyphs.test.ts` | Create | Glyph scanning tests |
| `src/modular/core/renderer-api.ts` | Modify | Add `getLayerOrder?()` and `onRemove?()` to interfaces |
| `src/modular/renderer/renderer.ts` | Modify | Implement `getLayerOrder()`, call `onRemove()` in `removeLayer()` |
| `src/modular/layers/symbol/text-layer.ts` | Rewrite | Extend SymbolLayerBase |
| `src/modular/layers/symbol/line-text-layer.ts` | Rewrite | Extend SymbolLayerBase |
| `src/modular/layers/symbol/icon-layer.ts` | Rewrite | Extend SymbolLayerBase |
| `src/modular/layers/symbol/glyph-manager.ts` | Modify | Replace `_onGlyphsLoaded` callback with subscriber list |
| `src/modular/layers/symbol/placement.ts` | Delete | Replaced by LayoutEngine |
| `src/modular/core/placement-participant.ts` | Delete | Replaced by SymbolLayerBase methods |
| `src/modular/core/placement-participant.test.ts` | Delete | Replaced by new tests |

---

### Task 1: TileFetcher\<T\>

Generic async tile lifecycle helper. No dependencies on symbol code — pure infrastructure.

**Files:**
- Create: `src/modular/layers/symbol/base/tile-fetcher.ts`
- Create: `src/modular/layers/symbol/base/tile-fetcher.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/modular/layers/symbol/base/tile-fetcher.test.ts
import { describe, it, expect, vi } from 'vitest'
import { TileFetcher } from './tile-fetcher.ts'

describe('TileFetcher', () => {
  function createFetcher<T>(fetchFn: (key: string, data: ArrayBuffer) => Promise<T | null>) {
    const onReady = vi.fn<(key: string, result: T) => void>()
    const fetcher = new TileFetcher<T>({ fetch: fetchFn, onReady })
    return { fetcher, onReady }
  }

  it('starts with no pending or ready keys', () => {
    const { fetcher } = createFetcher(async () => null)
    expect(fetcher.get('a')).toBeNull()
    expect(fetcher.hasPending('a')).toBe(false)
  })

  it('request() triggers fetch and calls onReady when resolved', async () => {
    const result = { data: 42 }
    const fetchFn = vi.fn(async () => result)
    const { fetcher, onReady } = createFetcher(fetchFn)

    fetcher.request('tile-1', new ArrayBuffer(8))
    expect(fetcher.hasPending('tile-1')).toBe(true)

    await vi.waitFor(() => expect(onReady).toHaveBeenCalledWith('tile-1', result))
    expect(fetcher.get('tile-1')).toBe(result)
    expect(fetcher.hasPending('tile-1')).toBe(false)
  })

  it('request() is a no-op if key is already fetching', async () => {
    const fetchFn = vi.fn(async () => ({ v: 1 }))
    const { fetcher } = createFetcher(fetchFn)

    fetcher.request('a', new ArrayBuffer(0))
    fetcher.request('a', new ArrayBuffer(0))

    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1))
  })

  it('request() is a no-op if key is already ready', async () => {
    const fetchFn = vi.fn(async () => ({ v: 1 }))
    const { fetcher } = createFetcher(fetchFn)

    fetcher.request('a', new ArrayBuffer(0))
    await vi.waitFor(() => expect(fetcher.get('a')).not.toBeNull())

    fetcher.request('a', new ArrayBuffer(0))
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('evict() removes ready result', async () => {
    const { fetcher } = createFetcher(async () => ({ v: 1 }))
    fetcher.request('a', new ArrayBuffer(0))
    await vi.waitFor(() => expect(fetcher.get('a')).not.toBeNull())

    fetcher.evict('a')
    expect(fetcher.get('a')).toBeNull()
    expect(fetcher.hasPending('a')).toBe(false)
  })

  it('evict() cancels in-flight fetch (onReady not called)', async () => {
    let resolve: () => void
    const fetchFn = vi.fn(() => new Promise<{ v: number }>(r => { resolve = () => r({ v: 1 }) }))
    const { fetcher, onReady } = createFetcher(fetchFn)

    fetcher.request('a', new ArrayBuffer(0))
    expect(fetcher.hasPending('a')).toBe(true)

    fetcher.evict('a')
    expect(fetcher.hasPending('a')).toBe(false)

    resolve!()
    await Promise.resolve()
    expect(onReady).not.toHaveBeenCalled()
  })

  it('invalidate() allows re-fetch while keeping old result', async () => {
    let callCount = 0
    const fetchFn = vi.fn(async () => ({ v: ++callCount }))
    const { fetcher, onReady } = createFetcher(fetchFn)

    fetcher.request('a', new ArrayBuffer(0))
    await vi.waitFor(() => expect(fetcher.get('a')).toEqual({ v: 1 }))

    fetcher.invalidate('a')
    // Old result still available
    expect(fetcher.get('a')).toEqual({ v: 1 })

    // New request triggers a fresh fetch
    fetcher.request('a', new ArrayBuffer(0))
    expect(fetcher.hasPending('a')).toBe(true)
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(2))
    expect(fetcher.get('a')).toEqual({ v: 2 })
  })

  it('null fetch result does not call onReady', async () => {
    const { fetcher, onReady } = createFetcher(async () => null)
    fetcher.request('a', new ArrayBuffer(0))
    await Promise.resolve()
    await Promise.resolve()
    expect(onReady).not.toHaveBeenCalled()
    expect(fetcher.get('a')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/base/tile-fetcher.test.ts
```

Expected: FAIL with `Cannot find module './tile-fetcher.ts'`

- [ ] **Step 3: Implement TileFetcher**

```ts
// src/modular/layers/symbol/base/tile-fetcher.ts

export interface TileFetcherOptions<T> {
  fetch: (key: string, data: ArrayBuffer) => Promise<T | null>
  onReady: (key: string, result: T) => void
}

type TileState = 'fetching' | 'ready' | 'invalidated'

export class TileFetcher<T> {
  private _fetch: TileFetcherOptions<T>['fetch']
  private _onReady: TileFetcherOptions<T>['onReady']
  private _state = new Map<string, TileState>()
  private _results = new Map<string, T>()
  /** Monotonic version per key — evict/invalidate bumps it to ignore stale resolves */
  private _version = new Map<string, number>()

  constructor(options: TileFetcherOptions<T>) {
    this._fetch = options.fetch
    this._onReady = options.onReady
  }

  request(key: string, data: ArrayBuffer): void {
    const state = this._state.get(key)
    if (state === 'fetching' || state === 'ready') return

    this._state.set(key, 'fetching')
    const ver = (this._version.get(key) ?? 0) + 1
    this._version.set(key, ver)

    this._fetch(key, data).then(result => {
      // Stale if evicted or invalidated+re-requested since we started
      if (this._version.get(key) !== ver) return
      if (result === null) {
        this._state.delete(key)
        return
      }
      this._state.set(key, 'ready')
      this._results.set(key, result)
      this._onReady(key, result)
    })
  }

  get(key: string): T | null {
    return this._results.get(key) ?? null
  }

  hasPending(key: string): boolean {
    return this._state.get(key) === 'fetching'
  }

  invalidate(key: string): void {
    if (!this._state.has(key)) return
    // Bump version to ignore any in-flight resolve
    this._version.set(key, (this._version.get(key) ?? 0) + 1)
    // Keep old result available, but mark as invalidated so request() works
    this._state.set(key, 'invalidated')
  }

  evict(key: string): void {
    this._version.set(key, (this._version.get(key) ?? 0) + 1)
    this._state.delete(key)
    this._results.delete(key)
  }

  evictAll(): void {
    for (const key of [...this._state.keys()]) this.evict(key)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/base/tile-fetcher.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/base/tile-fetcher.ts src/modular/layers/symbol/base/tile-fetcher.test.ts
git commit -m "feat(symbol): add TileFetcher<T> — generic async tile lifecycle helper"
```

---

### Task 2: Shared Types (CollisionData, GPUBucket)

**Files:**
- Create: `src/modular/layers/symbol/base/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/modular/layers/symbol/base/types.ts

/** Screen-space collision data for one tile, passed from layer to LayoutEngine */
export type CollisionData = {
  /** Tile cache key */
  tileKey: string
  /** Label anchor centres in screen pixels, one per placed label */
  anchors: Array<{ x: number; y: number }>
  /**
   * Screen-pixel AABBs [x1, y1, x2, y2] per label — parallel with anchors.
   * Invariant: the i-th element of the opacity Float32Array returned by
   * LayoutEngine corresponds to the i-th anchor/box in this array.
   */
  boxes: Array<[number, number, number, number]>
}

/** GPU-uploaded vertex/index buffers for one tile */
export type GPUBucket = {
  verts: WebGLBuffer
  idx: WebGLBuffer
  count: number
  /** Number of index-buffer indices per label (for per-label draw calls) */
  indicesPerLabel?: number[]
}
```

- [ ] **Step 2: Type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "base/types" || echo "No errors"
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/modular/layers/symbol/base/types.ts
git commit -m "feat(symbol): add shared types — CollisionData, GPUBucket"
```

---

### Task 3: RendererAPI Changes (getLayerOrder, onRemove)

**Files:**
- Modify: `src/modular/core/renderer-api.ts`
- Modify: `src/modular/renderer/renderer.ts`
- Modify: `src/modular/renderer/renderer.test.ts`

- [ ] **Step 1: Add `onRemove` and `getLayerOrder` to interfaces**

In `src/modular/core/renderer-api.ts`, add `onRemove?()` to `LayerInstance`:

```ts
export interface LayerInstance {
  readonly id?: string
  readonly type: string
  readonly source?: string
  readonly programs?: ProgramDefinition[]
  onAdd?(renderer: RendererAPI): void
  onRemove?(): void  // NEW
  draw?(ctx: DrawContext): void
  evictTile?(key: string): void
  drawBackground?(ctx: { gl: WebGLRenderingContext; paint: ResolvedPaintProperties }): void
}
```

Add `getLayerOrder` to `RendererAPI`:

```ts
export interface RendererAPI {
  // ... existing methods ...
  getLayerOrder?(): string[]  // NEW — returns layer IDs in render order
}
```

- [ ] **Step 2: Implement in renderer**

In `src/modular/renderer/renderer.ts`, modify `removeLayer()` to call `onRemove()`:

Find the `removeLayer` method and add the `onRemove` call before removing from the array.

Then add `getLayerOrder()` as a public method. Use `e.id` (the renderer's canonical ID, which is `layer.id ?? '__layer_N'`):

```ts
getLayerOrder(): string[] {
  return this._layers.map(e => e.id)
}
```

- [ ] **Step 3: Write tests for new behavior**

Add to `src/modular/renderer/renderer.test.ts`:

```ts
it('removeLayer calls onRemove on the layer', () => {
  const onRemove = vi.fn()
  const layer = { id: 'test', type: 'background', onRemove } as unknown as LayerInstance
  renderer.addLayer(layer)
  renderer.removeLayer('test')
  expect(onRemove).toHaveBeenCalledOnce()
})

it('getLayerOrder returns layer IDs in render order', () => {
  const a = { id: 'a', type: 'fill' } as unknown as LayerInstance
  const b = { id: 'b', type: 'line' } as unknown as LayerInstance
  renderer.addLayer(a)
  renderer.addLayer(b)
  expect(renderer.getLayerOrder()).toEqual(['a', 'b'])
})
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/renderer/renderer.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modular/core/renderer-api.ts src/modular/renderer/renderer.ts src/modular/renderer/renderer.test.ts
git commit -m "feat(renderer): add getLayerOrder() and onRemove() lifecycle hook"
```

---

### Task 4: GlyphManager — Replace Single Callback with Subscriber List

**Files:**
- Modify: `src/modular/layers/symbol/glyph-manager.ts`
- Modify: `src/modular/layers/symbol/glyph-manager.test.ts`

- [ ] **Step 1: Write test for multiple subscribers**

Add to `src/modular/layers/symbol/glyph-manager.test.ts`:

```ts
it('notifies multiple onGlyphsLoaded subscribers', async () => {
  const cb1 = vi.fn()
  const cb2 = vi.fn()
  const gm = new GlyphManager({ url: 'https://example.com/{fontstack}/{range}.pbf' })
  gm.addGlyphsLoadedListener(cb1)
  gm.addGlyphsLoadedListener(cb2)

  // Trigger glyph load (via mock)
  await gm.getGlyphs({ 'Test Font': [65] })

  expect(cb1).toHaveBeenCalled()
  expect(cb2).toHaveBeenCalled()
})

it('removeGlyphsLoadedListener stops notifications', async () => {
  const cb1 = vi.fn()
  const gm = new GlyphManager({ url: 'https://example.com/{fontstack}/{range}.pbf' })
  gm.addGlyphsLoadedListener(cb1)
  gm.removeGlyphsLoadedListener(cb1)

  await gm.getGlyphs({ 'Test Font': [65] })

  expect(cb1).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Replace `_onGlyphsLoaded` with subscriber list**

In `src/modular/layers/symbol/glyph-manager.ts`:

Replace the single callback:
```ts
// BEFORE:
_onGlyphsLoaded: ((map: GlyphMap, positions: GlyphPositions) => void) | null = null
```

With a subscriber list:
```ts
// AFTER:
private _glyphsLoadedListeners: Array<(map: GlyphMap, positions: GlyphPositions) => void> = []

addGlyphsLoadedListener(cb: (map: GlyphMap, positions: GlyphPositions) => void): void {
  this._glyphsLoadedListeners.push(cb)
}

removeGlyphsLoadedListener(cb: (map: GlyphMap, positions: GlyphPositions) => void): void {
  const idx = this._glyphsLoadedListeners.indexOf(cb)
  if (idx !== -1) this._glyphsLoadedListeners.splice(idx, 1)
}
```

Replace the notification call site (where `this._onGlyphsLoaded?.(...)` was called):
```ts
// BEFORE:
this._onGlyphsLoaded?.(partialMap, positions)

// AFTER:
for (const cb of this._glyphsLoadedListeners) cb(partialMap, positions)
```

Also add cleanup in `destroy()` (or add a destroy method if missing):
```ts
destroy(): void {
  this._glyphsLoadedListeners.length = 0
}
```

- [ ] **Step 3: Run existing + new tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/glyph-manager.test.ts
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/modular/layers/symbol/glyph-manager.ts src/modular/layers/symbol/glyph-manager.test.ts
git commit -m "refactor(glyph-manager): replace single callback with subscriber list"
```

---

### Task 5: ResourceManager

**Files:**
- Create: `src/modular/layers/symbol/engine/resource-manager.ts`
- Create: `src/modular/layers/symbol/engine/resource-manager.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/modular/layers/symbol/engine/resource-manager.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ResourceManager } from './resource-manager.ts'

// Mock GlyphManager and ImageManager constructors
vi.mock('../glyph-manager.ts', () => ({
  GlyphManager: vi.fn().mockImplementation((url: string) => ({
    url,
    addGlyphsLoadedListener: vi.fn(),
    removeGlyphsLoadedListener: vi.fn(),
    destroy: vi.fn(),
  })),
}))

vi.mock('../image-manager.ts', () => ({
  ImageManager: vi.fn().mockImplementation((url: string) => ({
    url,
    destroy: vi.fn(),
  })),
}))

describe('ResourceManager', () => {
  it('returns the same GlyphManager for identical url+fontstack', () => {
    const rm = new ResourceManager()
    const a = rm.getGlyphManager('https://ex.com/{fontstack}/{range}.pbf', 'Open Sans')
    const b = rm.getGlyphManager('https://ex.com/{fontstack}/{range}.pbf', 'Open Sans')
    expect(a).toBe(b)
  })

  it('returns different GlyphManagers for different fontstacks', () => {
    const rm = new ResourceManager()
    const a = rm.getGlyphManager('https://ex.com/{fontstack}/{range}.pbf', 'Open Sans')
    const b = rm.getGlyphManager('https://ex.com/{fontstack}/{range}.pbf', 'Roboto')
    expect(a).not.toBe(b)
  })

  it('returns the same ImageManager for identical sprite URL', () => {
    const rm = new ResourceManager()
    const a = rm.getImageManager('https://ex.com/sprite')
    const b = rm.getImageManager('https://ex.com/sprite')
    expect(a).toBe(b)
  })

  it('destroy() cleans up all managers', () => {
    const rm = new ResourceManager()
    const gm = rm.getGlyphManager('https://ex.com/{fontstack}/{range}.pbf', 'Open Sans')
    const im = rm.getImageManager('https://ex.com/sprite')
    rm.destroy()
    expect(gm.destroy).toHaveBeenCalled()
    expect(im.destroy).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/engine/resource-manager.test.ts
```

Expected: FAIL with `Cannot find module './resource-manager.ts'`

- [ ] **Step 3: Implement ResourceManager**

```ts
// src/modular/layers/symbol/engine/resource-manager.ts
import { GlyphManager } from '../glyph-manager.ts'
import { ImageManager } from '../image-manager.ts'

export class ResourceManager {
  private _glyphManagers = new Map<string, GlyphManager>()
  private _imageManagers = new Map<string, ImageManager>()

  getGlyphManager(glyphUrl: string, fontstack: string): GlyphManager {
    const key = `${glyphUrl}|${fontstack}`
    let gm = this._glyphManagers.get(key)
    if (!gm) {
      gm = new GlyphManager({ url: glyphUrl })
      this._glyphManagers.set(key, gm)
    }
    return gm
  }

  getImageManager(spriteUrl: string): ImageManager {
    let im = this._imageManagers.get(spriteUrl)
    if (!im) {
      im = new ImageManager({ url: spriteUrl })
      this._imageManagers.set(spriteUrl, im)
    }
    return im
  }

  destroy(): void {
    for (const gm of this._glyphManagers.values()) (gm as any).destroy?.()
    for (const im of this._imageManagers.values()) (im as any).destroy?.()
    this._glyphManagers.clear()
    this._imageManagers.clear()
  }
}
```

Note: The `GlyphManager` and `ImageManager` constructors may need to be checked against actual signatures. Read `src/modular/layers/symbol/glyph-manager.ts` and `src/modular/layers/symbol/image-manager.ts` for exact constructor args.

- [ ] **Step 4: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/engine/resource-manager.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/engine/resource-manager.ts src/modular/layers/symbol/engine/resource-manager.test.ts
git commit -m "feat(symbol): add ResourceManager — shared atlas deduplication"
```

---

### Task 6: LayoutEngine

**Files:**
- Create: `src/modular/layers/symbol/engine/layout-engine.ts`
- Create: `src/modular/layers/symbol/engine/layout-engine.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/modular/layers/symbol/engine/layout-engine.test.ts
import { describe, it, expect, vi } from 'vitest'
import { LayoutEngine } from './layout-engine.ts'
import type { CollisionData } from '../base/types.ts'

// Minimal mock layer interface matching what LayoutEngine needs
function mockLayer(collisionData: CollisionData[]) {
  return {
    getCollisionData: vi.fn(() => collisionData),
    setLabelOpacity: vi.fn(),
  }
}

function mockRenderContext() {
  const gl = {
    canvas: { width: 800, height: 600 },
  } as unknown as WebGLRenderingContext
  return {
    gl,
    programs: new Map(),
    camera: { center: { lng: 0, lat: 0 }, zoom: 2, bearing: 0, pitch: 0 },
    visibleTiles: [],
    frameIndex: 0,
  }
}

describe('LayoutEngine', () => {
  it('places non-overlapping labels with opacity 1', () => {
    const engine = new LayoutEngine()
    const layer = mockLayer([{
      tileKey: '2/1/1',
      anchors: [{ x: 100, y: 100 }, { x: 500, y: 500 }],
      boxes: [[80, 90, 120, 110], [480, 490, 520, 510]],
    }])

    engine.runPlacement(mockRenderContext(), [layer])

    expect(layer.setLabelOpacity).toHaveBeenCalledOnce()
    const opacity = layer.setLabelOpacity.mock.calls[0][1] as Float32Array
    expect(opacity[0]).toBe(1)
    expect(opacity[1]).toBe(1)
  })

  it('hides overlapping labels with opacity 0', () => {
    const engine = new LayoutEngine()
    const layer = mockLayer([{
      tileKey: '2/1/1',
      anchors: [{ x: 100, y: 100 }, { x: 105, y: 100 }],
      boxes: [[50, 80, 150, 120], [55, 80, 155, 120]],  // overlapping
    }])

    engine.runPlacement(mockRenderContext(), [layer])

    const opacity = layer.setLabelOpacity.mock.calls[0][1] as Float32Array
    // First label placed, second hidden (overlap)
    expect(opacity[0]).toBe(1)
    expect(opacity[1]).toBe(0)
  })

  it('cross-layer collision: later layer has priority', () => {
    const engine = new LayoutEngine()
    // Both layers have a label in the same spot
    const highPriority = mockLayer([{
      tileKey: '2/1/1',
      anchors: [{ x: 100, y: 100 }],
      boxes: [[50, 80, 150, 120]],
    }])
    const lowPriority = mockLayer([{
      tileKey: '2/1/1',
      anchors: [{ x: 100, y: 100 }],
      boxes: [[50, 80, 150, 120]],  // same box
    }])

    // Layers passed in reversed renderer order: highPriority first
    engine.runPlacement(mockRenderContext(), [highPriority, lowPriority])

    const highOp = highPriority.setLabelOpacity.mock.calls[0][1] as Float32Array
    const lowOp = lowPriority.setLabelOpacity.mock.calls[0][1] as Float32Array
    expect(highOp[0]).toBe(1)
    expect(lowOp[0]).toBe(0)
  })

  it('handles layers with no collision data', () => {
    const engine = new LayoutEngine()
    const layer = mockLayer([])
    engine.runPlacement(mockRenderContext(), [layer])
    expect(layer.setLabelOpacity).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/engine/layout-engine.test.ts
```

Expected: FAIL with `Cannot find module './layout-engine.ts'`

- [ ] **Step 3: Implement LayoutEngine**

```ts
// src/modular/layers/symbol/engine/layout-engine.ts
import { CollisionIndex } from '../vendor/collision_index.ts'
import type { CollisionData } from '../base/types.ts'
import type { RenderContext } from '../../../core/render-extension.ts'

/** Minimal interface for what LayoutEngine needs from a layer */
export interface PlaceableLayer {
  getCollisionData(ctx: RenderContext): CollisionData[]
  setLabelOpacity(tileKey: string, opacity: Float32Array): void
}

export class LayoutEngine {
  /**
   * Run collision placement for all symbol layers.
   * @param ctx Current render context
   * @param layers Layers in priority order (highest priority FIRST — i.e., reversed renderer order)
   */
  runPlacement(ctx: RenderContext, layers: PlaceableLayer[]): void {
    const { gl } = ctx
    const canvas = (gl as WebGLRenderingContext).canvas as HTMLCanvasElement
    const w = canvas.width
    const h = canvas.height

    const fov = 0.6435
    const cameraToCenterDistance = h / (2 * Math.tan(fov / 2))
    const transform = {
      width: w,
      height: h,
      cameraToCenterDistance,
      pitch: ((ctx.camera as any).pitch ?? 0) * Math.PI / 180,
      zoom: (ctx.camera as any).zoom ?? 0,
    }

    const ci = new CollisionIndex(transform)

    for (const layer of layers) {
      const buckets = layer.getCollisionData(ctx)
      for (const bucket of buckets) {
        const n = bucket.anchors.length
        const opacity = new Float32Array(n)
        for (let i = 0; i < n; i++) {
          const [x1, y1, x2, y2] = bucket.boxes[i]
          const box = { x1, y1, x2, y2 }
          const result = ci.placeCollisionBox(box, 'never', 1, 0, 0, false, false, [0, 0])
          if (result.placeable) {
            ci.insertCollisionBox(
              [x1, y1, x2, y2],
              'never',
              { bucketInstanceId: 0, featureIndex: i, collisionGroupID: 0, overlapMode: 'never' as const },
            )
            opacity[i] = 1
          }
        }
        layer.setLabelOpacity(bucket.tileKey, opacity)
      }
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/engine/layout-engine.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/engine/layout-engine.ts src/modular/layers/symbol/engine/layout-engine.test.ts
git commit -m "feat(symbol): add LayoutEngine — collision placement logic"
```

---

### Task 7: SymbolEngine

**Files:**
- Create: `src/modular/layers/symbol/engine/symbol-engine.ts`
- Create: `src/modular/layers/symbol/engine/symbol-engine.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/modular/layers/symbol/engine/symbol-engine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SymbolEngine } from './symbol-engine.ts'

function mockRenderer() {
  return {
    addRenderExtension: vi.fn(),
    removeRenderExtension: vi.fn(),
    getLayerOrder: vi.fn(() => ['layer-a', 'layer-b']),
  }
}

function mockLayer(id: string) {
  return {
    id,
    getCollisionData: vi.fn(() => []),
    setLabelOpacity: vi.fn(),
  }
}

describe('SymbolEngine', () => {
  it('registers a RenderExtension on first register()', () => {
    const renderer = mockRenderer()
    const engine = new SymbolEngine(renderer as any)
    const layer = mockLayer('a')

    engine.register(layer as any)
    expect(renderer.addRenderExtension).toHaveBeenCalledOnce()
  })

  it('does not add duplicate RenderExtension on second register()', () => {
    const renderer = mockRenderer()
    const engine = new SymbolEngine(renderer as any)

    engine.register(mockLayer('a') as any)
    engine.register(mockLayer('b') as any)
    expect(renderer.addRenderExtension).toHaveBeenCalledOnce()
  })

  it('removes RenderExtension when last layer unregisters', () => {
    const renderer = mockRenderer()
    const engine = new SymbolEngine(renderer as any)
    const a = mockLayer('a')
    const b = mockLayer('b')

    engine.register(a as any)
    engine.register(b as any)
    engine.unregister(a as any)
    expect(renderer.removeRenderExtension).not.toHaveBeenCalled()

    engine.unregister(b as any)
    expect(renderer.removeRenderExtension).toHaveBeenCalledOnce()
  })

  it('exposes layout and resources properties', () => {
    const renderer = mockRenderer()
    const engine = new SymbolEngine(renderer as any)
    expect(engine.layout).toBeDefined()
    expect(engine.resources).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/engine/symbol-engine.test.ts
```

Expected: FAIL with `Cannot find module './symbol-engine.ts'`

- [ ] **Step 3: Implement SymbolEngine**

```ts
// src/modular/layers/symbol/engine/symbol-engine.ts
import type { RendererAPI } from '../../../core/renderer-api.ts'
import type { RenderExtension, RenderContext } from '../../../core/render-extension.ts'
import { LayoutEngine, type PlaceableLayer } from './layout-engine.ts'
import { ResourceManager } from './resource-manager.ts'

export class SymbolEngine {
  readonly layout: LayoutEngine
  readonly resources: ResourceManager

  private _renderer: RendererAPI
  private _layers = new Set<PlaceableLayer & { id?: string }>()
  private _extension: RenderExtension | null = null

  constructor(renderer: RendererAPI) {
    this._renderer = renderer
    this.layout = new LayoutEngine()
    this.resources = new ResourceManager()
  }

  register(layer: PlaceableLayer & { id?: string }): void {
    this._layers.add(layer)
    if (!this._extension) {
      this._extension = {
        id: 'symbol-engine',
        beforeTiles: (ctx: RenderContext) => this._beforeTiles(ctx),
      }
      this._renderer.addRenderExtension(this._extension)
    }
  }

  unregister(layer: PlaceableLayer & { id?: string }): void {
    this._layers.delete(layer)
    if (this._layers.size === 0 && this._extension) {
      this._renderer.removeRenderExtension(this._extension.id)
      this._extension = null
      this.resources.destroy()
    }
  }

  private _beforeTiles(ctx: RenderContext): void {
    if (this._layers.size === 0) return

    // Get renderer layer order and sort registered layers to match (reversed for priority)
    const order = this._renderer.getLayerOrder?.() ?? []
    const ordered = this._getLayersInPriorityOrder(order)

    this.layout.runPlacement(ctx, ordered)
  }

  /**
   * Returns registered layers sorted by collision priority:
   * last in renderer order = highest priority = first in returned array.
   */
  private _getLayersInPriorityOrder(renderOrder: string[]): PlaceableLayer[] {
    const idToIndex = new Map<string, number>()
    for (let i = 0; i < renderOrder.length; i++) {
      idToIndex.set(renderOrder[i], i)
    }

    const layers = [...this._layers]
    layers.sort((a, b) => {
      const ai = a.id ? (idToIndex.get(a.id) ?? -1) : -1
      const bi = b.id ? (idToIndex.get(b.id) ?? -1) : -1
      return bi - ai  // reverse: higher index = higher priority = earlier in array
    })

    return layers
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/engine/symbol-engine.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/engine/symbol-engine.ts src/modular/layers/symbol/engine/symbol-engine.test.ts
git commit -m "feat(symbol): add SymbolEngine — coordinator with LayoutEngine + ResourceManager"
```

---

### Task 8: Shared ensureGlyphsForTile Utility

Extract the glyph pre-scanning logic shared by TextLayer and LineTextLayer.

**Files:**
- Create: `src/modular/layers/symbol/ensure-glyphs.ts`
- Create: `src/modular/layers/symbol/ensure-glyphs.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/modular/layers/symbol/ensure-glyphs.test.ts
import { describe, it, expect, vi } from 'vitest'
import { extractCodepoints } from './ensure-glyphs.ts'

describe('extractCodepoints', () => {
  it('extracts unique codepoints from template-substituted text', () => {
    // We test the codepoint extraction logic, not PBF parsing
    const texts = ['Hello', 'Hi']
    const result = extractCodepoints(texts)
    expect(result).toContain('H'.codePointAt(0))
    expect(result).toContain('e'.codePointAt(0))
    expect(result).toContain('l'.codePointAt(0))
    expect(result).toContain('o'.codePointAt(0))
    expect(result).toContain('i'.codePointAt(0))
    // Unique — 'l' appears twice but only once in result
    expect(result.filter(cp => cp === 'l'.codePointAt(0))).toHaveLength(1)
  })

  it('handles empty text array', () => {
    expect(extractCodepoints([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/ensure-glyphs.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement**

```ts
// src/modular/layers/symbol/ensure-glyphs.ts
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import type { GlyphManager } from './glyph-manager.ts'

/**
 * Extract unique codepoints from an array of text strings.
 */
export function extractCodepoints(texts: string[]): number[] {
  const codepoints = new Set<number>()
  for (const text of texts) {
    for (let i = 0; i < text.length; i++) {
      const cp = text.codePointAt(i)
      if (cp !== undefined) {
        codepoints.add(cp)
        if (cp > 0xffff) i++ // skip surrogate pair
      }
    }
  }
  return Array.from(codepoints)
}

/**
 * Scan PBF tile data for text values and trigger glyph range loading.
 * Shared by TextLayer and LineTextLayer.
 */
export function ensureGlyphsForTile(
  pbfBuffer: ArrayBuffer,
  textField: string,
  sourceLayer: string,
  fontstack: string,
  glyphManager: GlyphManager,
): void {
  try {
    const tile = new VectorTile(new Pbf(pbfBuffer.slice(0)))
    const layerNames = sourceLayer ? [sourceLayer] : Object.keys(tile.layers)
    const texts: string[] = []

    for (const layerName of layerNames) {
      const layer = tile.layers[layerName]
      if (!layer) continue
      for (let i = 0; i < layer.length; i++) {
        const raw = textField
          .replace(/\{([^}]+)\}/g, (_, k) => String(layer.feature(i).properties[k] ?? ''))
          .trim()
        if (raw) texts.push(raw)
      }
    }

    const codepoints = extractCodepoints(texts)
    if (codepoints.length > 0) {
      void glyphManager.getGlyphs({ [fontstack]: codepoints })
    }
  } catch { /* ignore parse errors */ }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/ensure-glyphs.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/ensure-glyphs.ts src/modular/layers/symbol/ensure-glyphs.test.ts
git commit -m "feat(symbol): extract shared ensureGlyphsForTile utility"
```

---

### Task 9: SymbolLayerBase

The abstract base class. This is the core of the refactor.

**Files:**
- Create: `src/modular/layers/symbol/base/symbol-layer-base.ts`
- Create: `src/modular/layers/symbol/base/symbol-layer-base.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/modular/layers/symbol/base/symbol-layer-base.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SymbolLayerBase } from './symbol-layer-base.ts'
import { TileFetcher } from './tile-fetcher.ts'
import type { GPUBucket, CollisionData } from './types.ts'
import type { DrawContext, RenderContext } from '../../../core/render-extension.ts'

// Concrete test subclass
class TestSymbolLayer extends SymbolLayerBase<{ data: number }> {
  static programs = [{ name: 'test', vertex: '', fragment: '' }]
  readonly type = 'test-symbol'
  readonly extent = 4096
  uploadBucketCalls: Array<{ key: string; data: { data: number } }> = []
  drawTileCalls: Array<{ key: string }> = []

  constructor() {
    const fetcher = new TileFetcher<{ data: number }>({
      fetch: async (key) => ({ data: 42 }),
      onReady: () => {},  // wired below
    })
    super(fetcher, { source: 'test-source', sourceLayer: 'test-layer' })
    // Wire onReady to populate _pendingUploads (matches real subclass pattern)
    ;(fetcher as any)._onReady = (key: string, result: { data: number }) => {
      this._pendingUploads.set(key, result)
      this._markDirty?.()
    }
  }

  uploadBucket(gl: WebGLRenderingContext, key: string, data: { data: number }): GPUBucket {
    this.uploadBucketCalls.push({ key, data })
    return { verts: {} as WebGLBuffer, idx: {} as WebGLBuffer, count: 6 }
  }

  drawTile(gl: WebGLRenderingContext, program: WebGLProgram, bucket: GPUBucket, ctx: DrawContext): void {
    this.drawTileCalls.push({ key: ctx.tileID.key })
  }

  getCollisionData(ctx: RenderContext): CollisionData[] {
    return []
  }
}

function mockRenderer() {
  return {
    gl: {
      canvas: { width: 512, height: 512 },
      disable: vi.fn(),
      enable: vi.fn(),
      blendFunc: vi.fn(),
      useProgram: vi.fn(),
      STENCIL_TEST: 2960,
      BLEND: 3042,
      ONE: 1,
      ONE_MINUS_SRC_ALPHA: 771,
    } as unknown as WebGLRenderingContext,
    markDirty: vi.fn(),
    addRenderExtension: vi.fn(),
    removeRenderExtension: vi.fn(),
    getLayerOrder: vi.fn(() => []),
    createGeometryBuffer: vi.fn(() => ({})),
    destroyGeometryBuffers: vi.fn(),
  }
}

describe('SymbolLayerBase', () => {
  it('creates SymbolEngine on onAdd via WeakMap', () => {
    const layer = new TestSymbolLayer()
    const renderer = mockRenderer()

    layer.onAdd(renderer as any)

    expect(renderer.addRenderExtension).toHaveBeenCalledOnce()
  })

  it('shares SymbolEngine across layers on same renderer', () => {
    const a = new TestSymbolLayer()
    const b = new TestSymbolLayer()
    const renderer = mockRenderer()

    a.onAdd(renderer as any)
    b.onAdd(renderer as any)

    // Only one RenderExtension registered
    expect(renderer.addRenderExtension).toHaveBeenCalledOnce()
  })

  it('setLabelOpacity stores opacity for draw()', () => {
    const layer = new TestSymbolLayer()
    const opacity = new Float32Array([1, 0, 1])
    layer.setLabelOpacity('2/1/1', opacity)

    // We can verify via the internal map by calling getCollisionData or inspecting
    // For now just verify it doesn't throw
    expect(() => layer.setLabelOpacity('2/1/1', opacity)).not.toThrow()
  })

  it('onRemove unregisters from engine', () => {
    const layer = new TestSymbolLayer()
    const renderer = mockRenderer()
    layer.onAdd(renderer as any)
    layer.onRemove()

    // Last layer removed → extension removed
    expect(renderer.removeRenderExtension).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/base/symbol-layer-base.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement SymbolLayerBase**

```ts
// src/modular/layers/symbol/base/symbol-layer-base.ts
import type { RendererAPI, LayerInstance } from '../../../core/renderer-api.ts'
import type { DrawContext, RenderContext } from '../../../core/render-extension.ts'
import type { ProgramDefinition, CameraState } from '../../../core/types.ts'
import { SymbolEngine } from '../engine/symbol-engine.ts'
import { TileFetcher } from './tile-fetcher.ts'
import type { GPUBucket, CollisionData } from './types.ts'
import { lngToTileX, latToTileY } from '../../renderer/mercator.ts'

export abstract class SymbolLayerBase<T = unknown> implements LayerInstance {
  abstract readonly extent: number
  readonly type: string = 'symbol'
  readonly id?: string
  readonly source: string
  readonly sourceLayer: string

  protected _engine: SymbolEngine | null = null
  protected _gl!: WebGLRenderingContext
  protected _renderer: RendererAPI | null = null
  protected _markDirty: (() => void) | null = null

  protected _tileFetcher: TileFetcher<T>
  protected _tileBuckets = new Map<string, GPUBucket | null>()
  protected _pendingUploads = new Map<string, T>()
  protected _tileOpacity = new Map<string, Float32Array>()

  private static _engines = new WeakMap<RendererAPI, SymbolEngine>()

  constructor(
    tileFetcher: TileFetcher<T>,
    options: { source: string; sourceLayer: string; id?: string },
  ) {
    this._tileFetcher = tileFetcher
    this.source = options.source
    this.sourceLayer = options.sourceLayer
    if (options.id) this.id = options.id
  }

  onAdd(renderer: RendererAPI): void {
    this._renderer = renderer
    this._gl = renderer.gl!
    this._markDirty = () => renderer.markDirty?.()

    // Get or create shared SymbolEngine
    let engine = SymbolLayerBase._engines.get(renderer)
    if (!engine) {
      engine = new SymbolEngine(renderer)
      SymbolLayerBase._engines.set(renderer, engine)
    }
    this._engine = engine
    engine.register(this as any)
  }

  onRemove(): void {
    if (this._engine) {
      this._engine.unregister(this as any)
      this._engine = null
    }
    this._tileFetcher.evictAll?.()
    this._tileBuckets.clear()
    this._pendingUploads.clear()
    this._tileOpacity.clear()
  }

  evictTile(key: string): void {
    this._tileFetcher.evict(key)
    this._tileBuckets.delete(key)
    this._pendingUploads.delete(key)
    this._tileOpacity.delete(key)
  }

  setLabelOpacity(tileKey: string, opacity: Float32Array): void {
    this._tileOpacity.set(tileKey, opacity)
  }

  draw(ctx: DrawContext): void {
    const { gl, tileID } = ctx
    const key = tileID.key

    // Upload any pending results from the tile fetcher
    const pending = this._pendingUploads.get(key)
    if (pending) {
      this._pendingUploads.delete(key)
      const bucket = this.uploadBucket(gl, key, pending)
      this._tileBuckets.set(key, bucket)
    }

    // Start fetch if not yet requested
    if (!this._tileBuckets.has(key) && !this._tileFetcher.hasPending(key) && ctx.tileData instanceof ArrayBuffer) {
      this._startFetch(key, ctx)
      return
    }

    const bucket = this._tileBuckets.get(key)
    if (!bucket) return

    const program = ctx.programs.get(this._getProgramName())
    if (!program) return

    gl.useProgram(program)
    gl.disable(gl.STENCIL_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    this.drawTile(gl, program, bucket, ctx)

    gl.disable(gl.BLEND)
    gl.enable(gl.STENCIL_TEST)
  }

  /** Subclasses override to provide the shader program name */
  protected _getProgramName(): string {
    return 'symbol_sdf'
  }

  protected _startFetch(key: string, ctx: DrawContext): void {
    if (!(ctx.tileData instanceof ArrayBuffer)) return
    this._tileFetcher.request(key, ctx.tileData)
  }

  /**
   * Project tile-local coordinates to screen pixels.
   * Shared by all subclasses for getCollisionData().
   */
  protected _projectToScreen(
    positions: Array<{ x: number; y: number }>,
    tileKey: string,
    camera: CameraState,
    canvasWidth: number,
    canvasHeight: number,
  ): Array<{ x: number; y: number }> {
    const { zoom } = camera
    const TILE_SIZE = 256
    const worldSize = TILE_SIZE * Math.pow(2, zoom)
    const cx = lngToTileX(camera.center.lng, zoom) * TILE_SIZE
    const cy = latToTileY(camera.center.lat, zoom) * TILE_SIZE
    const w = canvasWidth
    const h = canvasHeight

    const parts = tileKey.split('/')
    const tz = parseInt(parts[0], 10)
    const tx = parseInt(parts[1], 10)
    const ty = parseInt(parts[2], 10)
    if (isNaN(tz) || isNaN(tx) || isNaN(ty)) return []

    const tileScale = worldSize / Math.pow(2, tz)
    const tileOriginX = tx * tileScale
    const tileOriginY = ty * tileScale
    const extent = this.extent

    return positions.map(pos => ({
      x: (tileOriginX + (pos.x / extent) * tileScale) - cx + w / 2,
      y: (tileOriginY + (pos.y / extent) * tileScale) - cy + h / 2,
    }))
  }

  // ---- Abstract methods ----

  abstract uploadBucket(gl: WebGLRenderingContext, key: string, data: T): GPUBucket
  abstract drawTile(gl: WebGLRenderingContext, program: WebGLProgram, bucket: GPUBucket, ctx: DrawContext): void
  abstract getCollisionData(ctx: RenderContext): CollisionData[]
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/base/symbol-layer-base.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/base/symbol-layer-base.ts src/modular/layers/symbol/base/symbol-layer-base.test.ts
git commit -m "feat(symbol): add SymbolLayerBase — abstract base with draw scaffolding and engine integration"
```

---

### Task 10: Rewrite TextLayer to Extend SymbolLayerBase

**Files:**
- Rewrite: `src/modular/layers/symbol/text-layer.ts`

This is the largest task. Read the existing `text-layer.ts` carefully before making changes.

**Key reference files to read first:**
- `src/modular/layers/symbol/text-layer.ts` (current, ~480 lines)
- `src/modular/layers/symbol/base/symbol-layer-base.ts` (just created)
- `src/modular/layers/symbol/ensure-glyphs.ts` (just created)

- [ ] **Step 1: Read the full current text-layer.ts to understand all behavior**

```bash
# Read the full file — note every piece of behavior
cat src/modular/layers/symbol/text-layer.ts
```

- [ ] **Step 2: Rewrite TextLayer**

The rewritten TextLayer should:
1. Extend `SymbolLayerBase<SymbolTileData>`
2. Pass a `TileFetcher<SymbolTileData>` to `super()` with a fetch function that calls `TextWorkerService`
3. Get `GlyphManager` from `this._engine.resources.getGlyphManager(glyphUrl, fontstack)` in `onAdd()`
4. Wire glyph listener via `glyphManager.addGlyphsLoadedListener()`
5. Implement `uploadBucket()` — move GPU upload logic from old `_uploadBucket()`
6. Implement `drawTile()` — move GL draw logic from old `draw()` (atlas binding, uniforms, attributes, per-label opacity)
7. Implement `getCollisionData()` — use `_projectToScreen()` from base class
8. Use `ensureGlyphsForTile()` from the shared utility
9. Keep `setFontSize()` using `_tileFetcher.invalidate()` instead of manual state management
10. Override `_startFetch()` to call `ensureGlyphsForTile()` before the fetch
11. Preserve atlas version tracking (`_atlasVersion` / `_bucketAtlasVersion`) — when atlas rebuilds, invalidate all tiles via `_tileFetcher.invalidate()` so UV coords are re-fetched from the worker
12. Add `onRemove()` override that calls `super.onRemove()` + destroys the worker service + removes glyph listener

Constructor signature changes:
- Remove `glyphs: GlyphManager` option
- Add `glyphUrl: string` option
- Keep `source`, `sourceLayer`, `textField`, `fontstack`, `fontSize`, `color`, `opacity`

- [ ] **Step 3: Verify the demo still works**

Open the demo in a browser and check that text labels render correctly. The worker-side code is unchanged, so the fetch → shape → draw pipeline should work identically.

- [ ] **Step 4: Run existing tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/
```

Note: Some existing tests may reference the old API (`PlacementParticipant`, `glyphs` constructor arg). Update test imports as needed.

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/text-layer.ts
git commit -m "refactor(text-layer): extend SymbolLayerBase, use shared engine and resources"
```

---

### Task 11: Rewrite LineTextLayer to Extend SymbolLayerBase

**Files:**
- Rewrite: `src/modular/layers/symbol/line-text-layer.ts`

Same pattern as Task 10 but for line text.

**Key reference:** Read `src/modular/layers/symbol/line-text-layer.ts` (current, ~419 lines) first.

- [ ] **Step 1: Read the full current line-text-layer.ts**

- [ ] **Step 2: Rewrite LineTextLayer**

Same approach as TextLayer:
1. Extend `SymbolLayerBase<SymbolTileData>`
2. Get shared `GlyphManager` from engine resources
3. Implement `uploadBucket()`, `drawTile()`, `getCollisionData()`
4. Use shared `ensureGlyphsForTile()`

Constructor signature changes mirror TextLayer: `glyphs` → `glyphUrl`.

- [ ] **Step 3: Verify the demo renders line text correctly**

- [ ] **Step 4: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/
```

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/line-text-layer.ts
git commit -m "refactor(line-text-layer): extend SymbolLayerBase, use shared engine and resources"
```

---

### Task 12: Rewrite IconLayer to Extend SymbolLayerBase

**Files:**
- Rewrite: `src/modular/layers/symbol/icon-layer.ts`

**Key reference:** Read `src/modular/layers/symbol/icon-layer.ts` (current, ~364 lines) first.

- [ ] **Step 1: Read the full current icon-layer.ts**

- [ ] **Step 2: Rewrite IconLayer**

Differences from text layers:
1. Extend `SymbolLayerBase<IconTileData>`
2. Get `ImageManager` from `this._engine.resources.getImageManager(spriteUrl)` in `onAdd()`
3. `extent` is 8192 (not 4096)
4. Override `_getProgramName()` to return `'icon'`
5. `drawTile()` uses `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` blend (override blend in drawTile)
6. No glyph pre-scanning needed

Constructor signature changes: `images: ImageManager` → `spriteUrl: string`.

- [ ] **Step 3: Verify the demo renders icons correctly**

- [ ] **Step 4: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/
```

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/icon-layer.ts
git commit -m "refactor(icon-layer): extend SymbolLayerBase, use shared engine and resources"
```

---

### Task 13: Delete Old Placement Code

**Files:**
- Delete: `src/modular/layers/symbol/placement.ts`
- Delete: `src/modular/core/placement-participant.ts`
- Delete: `src/modular/core/placement-participant.test.ts`

- [ ] **Step 1: Search for remaining references**

```bash
grep -r "PlacementParticipant\|placement-participant\|from.*placement" src/modular/ --include="*.ts" | grep -v node_modules | grep -v ".test.ts"
```

Update any remaining imports.

- [ ] **Step 2: Delete the files**

```bash
git rm src/modular/layers/symbol/placement.ts
git rm src/modular/core/placement-participant.ts
git rm src/modular/core/placement-participant.test.ts
```

- [ ] **Step 3: Update any demo/integration code that uses old `Placement` plugin**

Search for `new Placement()` and `addPlugin(placement)` in demo code and remove them.

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run --config vitest.config.unit.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(symbol): delete old Placement plugin and PlacementParticipant interface"
```

---

### Task 14: Integration Smoke Test

**Files:**
- Modify: `src/modular/integration.test.ts` (if it references old placement/glyphs API)

- [ ] **Step 1: Run full test suite and fix any remaining issues**

```bash
npx vitest run --config vitest.config.unit.ts
```

Fix any import errors, type errors, or failing tests from the migration.

- [ ] **Step 2: Type-check the whole project**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | head -50
```

Fix any type errors.

- [ ] **Step 3: Visual verification in demo**

Open the demo and verify:
- Point text labels render
- Line text labels render
- Icons render
- Labels don't overlap (placement working)
- No console errors

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix(symbol): resolve remaining migration issues from architecture refactor"
```
