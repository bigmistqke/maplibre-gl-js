# Phase 3: FIFO Tile Eviction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound memory usage by evicting oldest non-visible tiles from TileManager and freeing their GPU textures when the cache exceeds a viewport-derived limit.

**Architecture:** Three small, sequential changes — `WebGLContext.destroyTexture` (Task 1), TileManager eviction logic (Task 2), Renderer wiring (Task 3). Each task is independent except Task 3 depends on Tasks 1 and 2.

**Tech Stack:** TypeScript, WebGL 1, Vitest (node environment, manual mocks). Test command: `node_modules/.bin/vitest run --config vitest.config.mini.ts`

---

## File Map

| File | Change |
|------|--------|
| `src/mini/renderer/webgl-context.ts` | Add `destroyTexture(key)` method |
| `src/mini/renderer/webgl-context.test.ts` | Add `deleteTexture` to GL mock; add 2 tests |
| `src/mini/renderer/tile-manager.ts` | Add `_maxCacheSize`, `_onEvict` fields; update constructor; add `updateCacheSize()`; add `_evict()`; call `_evict()` at end of `update()` |
| `src/mini/renderer/tile-manager.test.ts` | Update all 8 existing constructor calls (add 5th `vi.fn()` arg); add 7 new eviction tests |
| `src/mini/renderer/renderer.ts` | `addSource`: pass `onEvict`; `setCamera`: call `updateCacheSize` before `update`; `resize`: call `updateCacheSize` |
| `src/mini/renderer/renderer.test.ts` | Add 1 integration test |

---

## Task 1: WebGLContext.destroyTexture

**Files:**
- Modify: `src/mini/renderer/webgl-context.ts`
- Modify: `src/mini/renderer/webgl-context.test.ts`

### Step 1.1 — Write the failing tests

Open `src/mini/renderer/webgl-context.test.ts`. In the `'WebGLContext — Phase 2 additions'` describe block, add `deleteTexture` to the GL mock and two new tests at the end of the file:

```ts
// In the gl mock object inside beforeEach of 'WebGLContext — Phase 2 additions',
// add this field to the Object.assign call:
deleteTexture: vi.fn(),
```

Then add these tests inside the describe block after the existing tests:

```ts
it('destroyTexture calls gl.deleteTexture and removes the texture from cache', () => {
  const ctx = new WebGLContext(canvas as any)
  const bitmap = {} as ImageBitmap
  const tex = ctx.getOrCreateTexture('10/1/2', bitmap)

  ctx.destroyTexture('10/1/2')

  expect(gl.deleteTexture).toHaveBeenCalledWith(tex)
  // After destroy, a second getOrCreateTexture call re-uploads (calls texImage2D again)
  gl.texImage2D.mockClear()
  ctx.getOrCreateTexture('10/1/2', bitmap)
  expect(gl.texImage2D).toHaveBeenCalledOnce()
})

it('destroyTexture is a no-op for unknown keys', () => {
  const ctx = new WebGLContext(canvas as any)
  expect(() => ctx.destroyTexture('nonexistent')).not.toThrow()
  expect(gl.deleteTexture).not.toHaveBeenCalled()
})
```

- [ ] **Step 1.2 — Run tests to verify they fail**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/webgl-context.test.ts
```

Expected: 2 failures — `ctx.destroyTexture is not a function`.

- [ ] **Step 1.3 — Implement `destroyTexture` in WebGLContext**

Open `src/mini/renderer/webgl-context.ts`. After the `getOrCreateTexture` method (line 49), add:

```ts
destroyTexture(key: string): void {
  const tex = this._textures.get(key)
  if (!tex) return
  this.gl.deleteTexture(tex)
  this._textures.delete(key)
}
```

- [ ] **Step 1.4 — Run tests to verify they pass**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/webgl-context.test.ts
```

Expected: all tests pass (previously 9, now 11).

- [ ] **Step 1.5 — Run full suite to check no regressions**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts
```

Expected: 92 passed (was 90).

- [ ] **Step 1.6 — Commit**

```bash
git add src/mini/renderer/webgl-context.ts src/mini/renderer/webgl-context.test.ts
git commit -m "feat(mini): add WebGLContext.destroyTexture"
```

---

## Task 2: TileManager Eviction

**Files:**
- Modify: `src/mini/renderer/tile-manager.ts`
- Modify: `src/mini/renderer/tile-manager.test.ts`

### Step 2.1 — Write the failing tests

Open `src/mini/renderer/tile-manager.test.ts`.

**First:** Update every existing `new TileManager(...)` call — all 7 of them — to add `vi.fn()` as a 5th argument (the `onEvict` callback). The constructor signature is changing; TypeScript will error if you miss any.

Example of what each call looks like currently:
```ts
const manager = new TileManager(
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileService,
  projection,
  onTileReady,
)
```

Change each to:
```ts
const manager = new TileManager(
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileService,
  projection,
  onTileReady,
  vi.fn(),  // onEvict
)
```

There are 8 such calls — search for `new TileManager` and update all of them.

**Then:** Add a new `describe('TileManager — eviction', ...)` block at the end of the file with these 7 tests:

```ts
describe('TileManager — eviction', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not evict tiles before updateCacheSize is called', () => {
    const projection = makeProjection([])
    const onEvict = vi.fn()
    const manager = new TileManager(
      'https://t/{z}/{x}/{y}.png',
      makeTileService(),
      projection,
      vi.fn(),
      onEvict,
    )

    const tiles = (manager as any)._tiles as Map<string, unknown>
    for (let i = 0; i < 100; i++) {
      tiles.set(`tile-${i}`, {
        status: 'ready',
        imageBitmap: { close: vi.fn() },
        controller: new AbortController(),
      })
    }

    manager.update(CAMERA, VIEWPORT) // _maxCacheSize = Infinity → no eviction
    expect(onEvict).not.toHaveBeenCalled()
    expect(tiles.size).toBe(100)
  })

  it('evicts oldest inserted tiles first (FIFO order)', () => {
    const projection = makeProjection([])
    const onEvict = vi.fn()
    const manager = new TileManager(
      'https://t/{z}/{x}/{y}.png',
      makeTileService(),
      projection,
      vi.fn(),
      onEvict,
    )

    const tiles = (manager as any)._tiles as Map<string, unknown>
    tiles.set('tile-A', { status: 'ready', imageBitmap: { close: vi.fn() }, controller: new AbortController() })
    tiles.set('tile-B', { status: 'ready', imageBitmap: { close: vi.fn() }, controller: new AbortController() })
    tiles.set('tile-C', { status: 'ready', imageBitmap: { close: vi.fn() }, controller: new AbortController() })

    ;(manager as any)._maxCacheSize = 1
    manager.update(CAMERA, VIEWPORT)

    // A (oldest) and B evicted; C (newest) survives
    expect(onEvict).toHaveBeenCalledWith('tile-A')
    expect(onEvict).toHaveBeenCalledWith('tile-B')
    expect(onEvict).not.toHaveBeenCalledWith('tile-C')
    expect(tiles.size).toBe(1)
  })

  it('never evicts tiles currently in the visible set', () => {
    const projection = makeProjection([FAKE_TILE]) // FAKE_TILE stays visible
    const onEvict = vi.fn()
    const manager = new TileManager(
      'https://t/{z}/{x}/{y}.png',
      makeTileService(),
      projection,
      vi.fn(),
      onEvict,
    )

    // Pre-populate: FAKE_TILE first (oldest), then two non-visible extras
    const tiles = (manager as any)._tiles as Map<string, unknown>
    tiles.set(FAKE_TILE.key, {
      status: 'ready',
      imageBitmap: { close: vi.fn() },
      controller: new AbortController(),
    })
    tiles.set('extra-1', { status: 'ready', imageBitmap: { close: vi.fn() }, controller: new AbortController() })
    tiles.set('extra-2', { status: 'ready', imageBitmap: { close: vi.fn() }, controller: new AbortController() })

    ;(manager as any)._maxCacheSize = 1
    manager.update(CAMERA, VIEWPORT)
    // _visibleSet = {FAKE_TILE.key} → FAKE_TILE skipped, extras evicted

    expect(onEvict).not.toHaveBeenCalledWith(FAKE_TILE.key)
    expect(onEvict).toHaveBeenCalledWith('extra-1')
    expect(onEvict).toHaveBeenCalledWith('extra-2')
  })

  it('aborts in-flight requests for evicted loading tiles', () => {
    const projection = makeProjection([])
    const onEvict = vi.fn()
    const manager = new TileManager(
      'https://t/{z}/{x}/{y}.png',
      makeTileService(),
      projection,
      vi.fn(),
      onEvict,
    )

    const controller = new AbortController()
    const abortSpy = vi.spyOn(controller, 'abort')
    const tiles = (manager as any)._tiles as Map<string, unknown>
    tiles.set('loading-tile', { status: 'loading', controller })

    ;(manager as any)._maxCacheSize = 0
    manager.update(CAMERA, VIEWPORT)

    expect(abortSpy).toHaveBeenCalled()
    expect(onEvict).toHaveBeenCalledWith('loading-tile')
  })

  it('calls imageBitmap.close() on evicted ready tiles', () => {
    const projection = makeProjection([])
    const onEvict = vi.fn()
    const manager = new TileManager(
      'https://t/{z}/{x}/{y}.png',
      makeTileService(),
      projection,
      vi.fn(),
      onEvict,
    )

    const closeSpy = vi.fn()
    const tiles = (manager as any)._tiles as Map<string, unknown>
    tiles.set('tile-A', {
      status: 'ready',
      imageBitmap: { close: closeSpy },
      controller: new AbortController(),
    })

    ;(manager as any)._maxCacheSize = 0
    manager.update(CAMERA, VIEWPORT)

    expect(closeSpy).toHaveBeenCalled()
  })

  it('calls onEvict with the correct tile key', () => {
    const projection = makeProjection([])
    const onEvict = vi.fn()
    const manager = new TileManager(
      'https://t/{z}/{x}/{y}.png',
      makeTileService(),
      projection,
      vi.fn(),
      onEvict,
    )

    const tiles = (manager as any)._tiles as Map<string, unknown>
    tiles.set('tile-A', {
      status: 'ready',
      imageBitmap: { close: vi.fn() },
      controller: new AbortController(),
    })

    ;(manager as any)._maxCacheSize = 0
    manager.update(CAMERA, VIEWPORT)

    expect(onEvict).toHaveBeenCalledWith('tile-A')
  })

  it('updateCacheSize computes maxCacheSize from viewport dimensions', () => {
    const projection = makeProjection([])
    const manager = new TileManager(
      'https://t/{z}/{x}/{y}.png',
      makeTileService(),
      projection,
      vi.fn(),
      vi.fn(),
    )

    manager.updateCacheSize({ width: 512, height: 512 })
    // ceil(512/256)+1 = 3, 3 × 3 × 5 = 45
    expect((manager as any)._maxCacheSize).toBe(45)
  })
})
```

- [ ] **Step 2.2 — Run tests to verify they fail**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/tile-manager.test.ts
```

Expected: the existing 7 tests fail with a TypeScript/argument-count error (constructor arity mismatch), and the 7 new tests fail with `updateCacheSize is not a function`.

- [ ] **Step 2.3 — Implement eviction in TileManager**

Open `src/mini/renderer/tile-manager.ts`. Apply these changes:

**Add two private fields** to the class body (after `_onTileReady`):

```ts
private _maxCacheSize: number = Infinity
private _onEvict: (key: string) => void
```

**Update the constructor signature** (add 5th parameter) and assignment:

```ts
constructor(
  urlTemplate: string,
  tileService: TileService,
  projection: Projection,
  onTileReady: () => void,
  onEvict: (key: string) => void,   // NEW
) {
  this._urlTemplate = urlTemplate
  this._tileService = tileService
  this._projection = projection
  this._onTileReady = onTileReady
  this._onEvict = onEvict            // NEW
}
```

**Add the `updateCacheSize` public method** after the constructor:

```ts
updateCacheSize(viewport: Viewport): void {
  const tilesX = Math.ceil(viewport.width / 256) + 1
  const tilesY = Math.ceil(viewport.height / 256) + 1
  this._maxCacheSize = tilesX * tilesY * 5
}
```

**Add the `_evict` private method** after `_fetchTile`:

```ts
private _evict(): void {
  if (this._tiles.size <= this._maxCacheSize) return
  for (const [key, entry] of this._tiles) {
    if (this._tiles.size <= this._maxCacheSize) break
    if (this._visibleSet.has(key)) continue
    entry.controller.abort()
    entry.imageBitmap?.close()
    this._onEvict(key)
    this._tiles.delete(key)
  }
}
```

**Call `_evict()` at the end of `update()`** — add one line before the closing brace:

```ts
update(camera: CameraState, viewport: Viewport): void {
  // ... existing code unchanged ...
  this._evict()  // NEW — call after visible set and fetches are updated
}
```

- [ ] **Step 2.4 — Run tests to verify they pass**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/tile-manager.test.ts
```

Expected: all 14 tests pass (7 existing + 7 new).

- [ ] **Step 2.5 — Run full suite to check no regressions**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts
```

Expected: 99 passed (was 92 after Task 1).

- [ ] **Step 2.6 — Commit**

```bash
git add src/mini/renderer/tile-manager.ts src/mini/renderer/tile-manager.test.ts
git commit -m "feat(mini): add FIFO tile eviction to TileManager"
```

---

## Task 3: Renderer Wiring

**Files:**
- Modify: `src/mini/renderer/renderer.ts`
- Modify: `src/mini/renderer/renderer.test.ts`

### Step 3.1 — Write the failing integration test

Open `src/mini/renderer/renderer.test.ts`. At the end of the `describe('Renderer', ...)` block, add:

```ts
it('calls destroyTexture when TileManager evicts a tile', () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }))

  const webgl = (renderer as any)._webgl
  const destroySpy = vi.spyOn(webgl, 'destroyTexture')

  renderer.addSource('osm', { type: 'raster', url: 'https://t/{z}/{x}/{y}.png' })

  const tm = (renderer as any)._tileManagers.get('osm')
  const tiles = tm._tiles as Map<string, unknown>
  tiles.set('tile-A', {
    status: 'ready',
    imageBitmap: { close: vi.fn() },
    controller: new AbortController(),
  })
  ;(tm as any)._maxCacheSize = 0

  renderer.setCamera({
    center: { lng: 0, lat: 0 },
    zoom: 0,
    bearing: 0,
    pitch: 0,
    groundElevation: 0,
  })

  expect(destroySpy).toHaveBeenCalledWith('tile-A')

  vi.unstubAllGlobals()
})
```

- [ ] **Step 3.2 — Run test to verify it fails**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/renderer.test.ts
```

Expected: new test fails — `destroySpy` is not called (TileManager still constructed without `onEvict`).

- [ ] **Step 3.3 — Update Renderer to wire eviction**

Open `src/mini/renderer/renderer.ts`. Make three changes:

**1. In `addSource`** — pass `onEvict` as 5th argument to TileManager constructor (lines 75–80):

```ts
const tm = new TileManager(
  rasterSource.url,
  new RasterTileService(),
  this._projection,
  () => this._frameLoop.markDirty(),
  (key) => this._webgl.destroyTexture(key),  // NEW
)
```

**2. In `setCamera`** — call `updateCacheSize` before `update` (lines 154–158):

```ts
setCamera(state: CameraState): void {
  this._camera = state
  const viewport: Viewport = { width: this._width, height: this._height }
  for (const tm of this._tileManagers.values()) {
    tm.updateCacheSize(viewport)   // NEW — must come before update()
    tm.update(state, viewport)
  }
  this._frameLoop.markDirty()
}
```

**3. In `resize`** — call `updateCacheSize` for each TileManager (lines 58–62):

```ts
resize(width: number, height: number): void {
  this._width = width
  this._height = height
  const viewport: Viewport = { width, height }
  for (const tm of this._tileManagers.values()) {
    tm.updateCacheSize(viewport)   // NEW
  }
  this._frameLoop.markDirty()
}
```

- [ ] **Step 3.4 — Run tests to verify they pass**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts src/mini/renderer/renderer.test.ts
```

Expected: all tests pass.

- [ ] **Step 3.5 — Run full suite**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts
```

Expected: 100 passed (was 99).

- [ ] **Step 3.6 — Commit**

```bash
git add src/mini/renderer/renderer.ts src/mini/renderer/renderer.test.ts
git commit -m "feat(mini): wire FIFO eviction in Renderer (onEvict + updateCacheSize)"
```

---

## Done

All 3 tasks complete. Final state: 100 tests passing, 3 new commits on `feat-mini`.
