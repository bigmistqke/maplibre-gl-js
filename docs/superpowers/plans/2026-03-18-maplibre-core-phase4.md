# MapLibre Clean-Room — Phase 4: Worker-Based Tile Service

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move tile fetch + decode off the main thread. `TileService` interface gains `request/cancel/destroy`; `TileManager` delegates fetch entirely to the service; `RasterTileService` owns `fetch` + `createImageBitmap`; a Comlink-based `WorkerRasterTileService` runs the same logic in a Web Worker. Browser tests verify the worker path end-to-end.

**Architecture:** Service-owns-fetch: `TileManager` calls `tileService.request(tileID, url)` and receives `Transferable[]`. `TileEntry` loses its `controller` field — cancellation is delegated to the service. Tests inject a plain `RasterTileService` via an optional `tileService` field in the source definition; production gets `WorkerRasterTileService` by default. New browser tests (Playwright + MSW) cover worker behaviour that Node cannot test.

**Tech Stack:** TypeScript, Comlink (worker RPC), MSW v2 (fetch mocking), `@vitest/browser` with Playwright provider. All new npm packages required.

---

## File Map

| File | Change | Responsibility |
|------|--------|----------------|
| `src/mini/core/tile-service.ts` | Modify | New `TileService` interface: `request / cancel / destroy` |
| `src/mini/layers/raster.ts` | Modify | `RasterTileService` implements new interface — owns fetch + AbortController |
| `src/mini/renderer/tile-manager.ts` | Modify | Remove `_fetchTile`, `AbortController` in `TileEntry`; delegate to `tileService.request()` |
| `src/mini/renderer/tile-manager.test.ts` | Modify | Switch from `fetch` mock to `tileService.request` mock; add `cancel`/`destroy` tests |
| `src/mini/renderer/renderer.ts` | Modify | Accept `tileService?` in `RasterSourceDefinition`; default to `WorkerRasterTileService` |
| `src/mini/renderer/renderer.test.ts` | Modify | Inject inline `RasterTileService` via source definition override |
| `src/mini/workers/raster-worker.ts` | Create | Comlink-exposed worker class: fetch + createImageBitmap, returns `ImageBitmap \| null` |
| `src/mini/layers/raster-worker-service.ts` | Create | `WorkerRasterTileService` — Comlink main-thread wrapper, implements `TileService` |
| `vitest.config.mini.browser.ts` | Create | Browser test config: Playwright provider, `*.browser.test.ts` pattern |
| `src/mini/test-setup.browser.ts` | Create | MSW service worker setup + fake PNG handler |
| `src/mini/workers/raster-worker-service.browser.test.ts` | Create | Browser tests for `WorkerRasterTileService` |

---

## Task 1: Install dependencies

**Files:** `package.json`

- [ ] **Step 1: Install production dependency**

```bash
npm install comlink
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install --save-dev msw @vitest/browser playwright
```

- [ ] **Step 3: Type-check**

```bash
node_modules/.bin/tsc --noEmit -p tsconfig.json
```

Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(mini): add comlink, msw, @vitest/browser, playwright"
```

---

## Task 2: Update `TileService` interface

**Files:**
- Modify: `src/mini/core/tile-service.ts`

The new interface eliminates `process(data, signal)` — the service now owns the full pipeline including `fetch`. `request()` always resolves (never rejects) with `[ImageBitmap]` on success or `[]` on cancel/error.

- [ ] **Step 1: Replace tile-service.ts**

```ts
// src/mini/core/tile-service.ts
import type { TileID } from './types.ts'

export interface TileService {
  /** Fetch and decode a tile. Resolves with [ImageBitmap] on success, [] on cancel or error. */
  request(tileID: TileID, url: string): Promise<Transferable[]>
  /** Cancel an in-flight request. No-op if key is unknown. */
  cancel(key: string): void
  /** Terminate the service (terminates worker if applicable). */
  destroy(): void
}
```

- [ ] **Step 2: Type-check**

```bash
node_modules/.bin/tsc --noEmit -p tsconfig.json
```

Expected: errors on `RasterTileService` (doesn't implement new interface yet) and `TileManager` (calls `process`). These are expected — we'll fix them in subsequent tasks.

---

## Task 3: Update `RasterTileService`

**Files:**
- Modify: `src/mini/layers/raster.ts`

`RasterTileService` now owns `fetch` + `createImageBitmap`. It tracks one `AbortController` per in-flight tile. All errors return `[]` — never throw. `RasterLayer` is unchanged.

- [ ] **Step 1: Replace the RasterTileService class**

Find the `RasterTileService` class in `src/mini/layers/raster.ts` (lines 35–50) and replace it:

```ts
export class RasterTileService implements TileService {
  private _pending = new globalThis.Map<string, AbortController>()

  async request(tileID: TileID, url: string): Promise<Transferable[]> {
    const controller = new AbortController()
    this._pending.set(tileID.key, controller)
    try {
      const buf = await fetch(url, { signal: controller.signal }).then(r => r.arrayBuffer())
      const bitmap = await createImageBitmap(new Blob([buf]))
      this._pending.delete(tileID.key)
      return [bitmap]
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
    for (const controller of this._pending.values()) controller.abort()
    this._pending.clear()
  }
}
```

Also remove the `TileID` import from the top if it was imported via `TileService` — `TileID` is now used directly so keep it. The import line should stay:

```ts
import type { TileID, ProgramDefinition } from '../core/types.ts'
import type { TileService } from '../core/tile-service.ts'
```

- [ ] **Step 2: Type-check**

```bash
node_modules/.bin/tsc --noEmit -p tsconfig.json
```

Expected: errors only on `TileManager` (calls `process` + owns `AbortController`). `RasterTileService` should be clean.

- [ ] **Step 3: Commit**

```bash
git add src/mini/core/tile-service.ts src/mini/layers/raster.ts
git commit -m "feat(mini): update TileService interface — service owns fetch (request/cancel/destroy)"
```

---

## Task 4: Update `TileManager`

**Files:**
- Modify: `src/mini/renderer/tile-manager.ts`

`TileEntry` loses `controller`. `_fetchTile` is deleted. `update()` calls `tileService.request()` instead. All places that called `entry.controller.abort()` now call `this._tileService.cancel(key)`.

- [ ] **Step 1: Update `TileEntry` — remove controller field**

```ts
interface TileEntry {
  status: 'loading' | 'ready' | 'error'
  imageBitmap?: ImageBitmap
}
```

- [ ] **Step 2: Update `update()` — replace fetch with service.request()**

Find the loop `for (const tileID of visibleTiles)` and its `_fetchTile` call. Replace with:

```ts
for (const tileID of visibleTiles) {
  const key = tileKey(tileID)
  if (this._tiles.has(key)) continue

  const entry: TileEntry = { status: 'loading' }
  this._tiles.set(key, entry)

  this._tileService.request(tileID, buildURL(this._urlTemplate, tileID))
    .then(transferables => {
      if (!this._tiles.has(key)) return          // evicted while loading
      if (transferables.length === 0) {
        entry.status = 'error'
        return
      }
      entry.status = 'ready'
      entry.imageBitmap = transferables[0] as ImageBitmap
      this._onTileReady()
    })
}
```

- [ ] **Step 3: Update `update()` — cancel via service**

Find the cancellation loop (tiles leaving visible set). Replace `entry.controller.abort()` with:

```ts
if (entry && entry.status === 'loading') {
  this._tileService.cancel(key)
}
```

- [ ] **Step 4: Update `_evict()` — cancel via service**

Replace `entry.controller.abort()` in `_evict()` with:

```ts
if (entry.status === 'loading') {
  this._tileService.cancel(key)
}
entry.imageBitmap?.close()
this._onEvict(key)
this._tiles.delete(key)
```

- [ ] **Step 5: Update `destroy()` — cancel + destroy service**

Replace the `destroy()` method:

```ts
destroy(): void {
  for (const [key, entry] of this._tiles) {
    if (entry.status === 'loading') {
      this._tileService.cancel(key)
    }
    entry.imageBitmap?.close()
  }
  this._tiles.clear()
  this._visibleSet.clear()
  this._tileService.destroy()
}
```

- [ ] **Step 6: Remove `_fetchTile` method and unused `fetch` reference**

Delete the entire `private _fetchTile(...)` method. The `buildURL` helper stays (it's still used in `update()`).

- [ ] **Step 7: Type-check**

```bash
node_modules/.bin/tsc --noEmit -p tsconfig.json
```

Expected: no errors in `tile-manager.ts`.

---

## Task 5: Update `TileManager` tests

**Files:**
- Modify: `src/mini/renderer/tile-manager.test.ts`

The tests no longer mock `fetch` globally. Instead they mock `tileService.request/cancel/destroy`. The existing set of test cases is preserved but adapted to the new interface.

- [ ] **Step 1: Update `makeTileService()` helper**

Replace:

```ts
function makeTileService(): TileService {
  return {
    process: vi.fn().mockResolvedValue([{ close: vi.fn() }]),
  }
}
```

With:

```ts
function makeTileService(bitmap?: ImageBitmap): TileService {
  const defaultBitmap = bitmap ?? ({ close: vi.fn() } as unknown as ImageBitmap)
  return {
    request: vi.fn().mockResolvedValue([defaultBitmap]),
    cancel: vi.fn(),
    destroy: vi.fn(),
  }
}
```

- [ ] **Step 2: Remove `vi.stubGlobal('fetch', ...)` from `beforeEach` / `afterEach`**

Delete these two blocks from both `describe` groups:

```ts
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})
```

- [ ] **Step 3: Update 'update() calls fetch()' test — now checks service.request()**

Replace the test `'update() calls fetch() for each visible tile not already in cache'`:

```ts
it('update() calls tileService.request() for each visible tile not already in cache', async () => {
  const projection = makeProjection([FAKE_TILE])
  const tileService = makeTileService()
  const manager = new TileManager(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileService,
    projection,
    vi.fn(),
    vi.fn(),
  )
  manager.update(CAMERA, VIEWPORT)
  expect(tileService.request).toHaveBeenCalledOnce()
  expect(tileService.request).toHaveBeenCalledWith(
    FAKE_TILE,
    'https://tile.openstreetmap.org/10/528/341.png',
  )
})
```

- [ ] **Step 4: Update 'does not fetch a tile already in cache' test**

Replace:

```ts
it('update() does not fetch a tile already in cache', async () => {
  const projection = makeProjection([FAKE_TILE])
  const tileService = makeTileService()
  const manager = new TileManager(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileService,
    projection,
    vi.fn(),
    vi.fn(),
  )
  manager.update(CAMERA, VIEWPORT)
  manager.update(CAMERA, VIEWPORT)
  expect(tileService.request).toHaveBeenCalledOnce()
})
```

- [ ] **Step 5: Update cancellation test — check service.cancel() instead of AbortController.abort()**

Replace the test `'update() cancels in-flight requests for tiles no longer in visible set'`:

```ts
it('update() calls tileService.cancel() for tiles no longer in visible set', () => {
  const projection = makeProjection([FAKE_TILE])
  const tileService = makeTileService()
  const manager = new TileManager(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileService,
    projection,
    vi.fn(),
    vi.fn(),
  )

  manager.update(CAMERA, VIEWPORT)

  ;(projection.getVisibleTiles as ReturnType<typeof vi.fn>).mockReturnValue([])
  manager.update(CAMERA, VIEWPORT)

  expect(tileService.cancel).toHaveBeenCalledWith(FAKE_TILE.key)
})
```

- [ ] **Step 6: Update getReadyTiles test — remove fetch dependency**

Replace the `process` mock call inside the test with a `request` mock:

```ts
it('getReadyTiles() returns only tiles with status ready that are in current visible set', async () => {
  const fakeBitmap = { close: vi.fn() } as unknown as ImageBitmap
  const tileService = makeTileService(fakeBitmap)
  const projection = makeProjection([FAKE_TILE])
  const onTileReady = vi.fn()
  const manager = new TileManager(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileService,
    projection,
    onTileReady,
    vi.fn(),
  )

  manager.update(CAMERA, VIEWPORT)
  expect(manager.getReadyTiles()).toHaveLength(0)

  await vi.waitFor(() => expect(onTileReady).toHaveBeenCalled())
  expect(manager.getReadyTiles()).toHaveLength(1)
  expect(manager.getReadyTiles()[0].tileID).toEqual(FAKE_TILE)
  expect(manager.getReadyTiles()[0].imageBitmap).toBe(fakeBitmap)
})
```

- [ ] **Step 7: Update remaining getReadyTiles / onTileReady tests similarly**

For each test that uses `process: vi.fn().mockResolvedValue([fakeBitmap])` — replace the `TileService` mock inline with `makeTileService(fakeBitmap)`.

For the `'getReadyTiles() does not return tiles outside the current visible set'` test:

```ts
it('getReadyTiles() does not return tiles outside the current visible set', async () => {
  const fakeBitmap = { close: vi.fn() } as unknown as ImageBitmap
  const tileService = makeTileService(fakeBitmap)
  const projection = makeProjection([FAKE_TILE])
  const onTileReady = vi.fn()
  const manager = new TileManager(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileService,
    projection,
    onTileReady,
    vi.fn(),
  )

  manager.update(CAMERA, VIEWPORT)
  await vi.waitFor(() => expect(onTileReady).toHaveBeenCalled())

  ;(projection.getVisibleTiles as ReturnType<typeof vi.fn>).mockReturnValue([])
  manager.update(CAMERA, VIEWPORT)

  expect(manager.getReadyTiles()).toHaveLength(0)
})
```

For `'onTileReady callback is called when a tile finishes processing'`:

```ts
it('onTileReady callback is called when a tile finishes loading', async () => {
  const fakeBitmap = { close: vi.fn() } as unknown as ImageBitmap
  const tileService = makeTileService(fakeBitmap)
  const projection = makeProjection([FAKE_TILE])
  const onTileReady = vi.fn()
  const manager = new TileManager(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileService,
    projection,
    onTileReady,
    vi.fn(),
  )

  manager.update(CAMERA, VIEWPORT)
  await vi.waitFor(() => expect(onTileReady).toHaveBeenCalled())
})
```

- [ ] **Step 8: Update destroy() test — check service.cancel() and service.destroy()**

Replace `'destroy() cancels all in-flight requests'`:

```ts
it('destroy() calls tileService.cancel() for all loading tiles and tileService.destroy()', () => {
  const projection = makeProjection([FAKE_TILE, FAKE_TILE_2])
  const tileService = makeTileService()
  const manager = new TileManager(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileService,
    projection,
    vi.fn(),
    vi.fn(),
  )

  manager.update(CAMERA, VIEWPORT)
  manager.destroy()

  expect(tileService.cancel).toHaveBeenCalledWith(FAKE_TILE.key)
  expect(tileService.cancel).toHaveBeenCalledWith(FAKE_TILE_2.key)
  expect(tileService.destroy).toHaveBeenCalled()
})
```

- [ ] **Step 9: Update eviction tests — remove controller from pre-populated tiles**

In all eviction tests that manually populate `_tiles`, remove `controller: new AbortController()` from tile entries. For the `'aborts in-flight requests for evicted loading tiles'` test, replace the `AbortController` spy check with a `tileService.cancel` check:

```ts
it('calls tileService.cancel() for evicted loading tiles', () => {
  const projection = makeProjection([])
  const tileService = makeTileService()
  const onEvict = vi.fn()
  const manager = new TileManager(
    'https://t/{z}/{x}/{y}.png',
    tileService,
    projection,
    vi.fn(),
    onEvict,
  )

  const tiles = (manager as any)._tiles as Map<string, unknown>
  tiles.set('loading-tile', { status: 'loading' })

  ;(manager as any)._maxCacheSize = 0
  manager.update(CAMERA, VIEWPORT)

  expect(tileService.cancel).toHaveBeenCalledWith('loading-tile')
  expect(onEvict).toHaveBeenCalledWith('loading-tile')
})
```

Remove `controller: new AbortController()` from all other manually-seeded tile objects in the eviction suite.

- [ ] **Step 10: Run tests — expect PASS**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts
```

Expected: all tests pass

- [ ] **Step 11: Commit**

```bash
git add src/mini/renderer/tile-manager.ts src/mini/renderer/tile-manager.test.ts
git commit -m "feat(mini): TileManager delegates fetch to TileService (request/cancel/destroy)"
```

---

## Task 6: Update `Renderer` — accept tileService override

**Files:**
- Modify: `src/mini/renderer/renderer.ts`

Add `tileService?: TileService` to `RasterSourceDefinition`. In `addSource`, use the override when present; otherwise create a new `RasterTileService` (not the worker version yet — that comes in Task 9). This change is what makes the existing renderer tests work without a Worker.

- [ ] **Step 1: Add `tileService?` to `RasterSourceDefinition`**

```ts
import type { TileService } from '../core/tile-service.ts'

interface RasterSourceDefinition extends SourceDefinition {
  type: 'raster'
  url: string
  tileSize?: number
  tileService?: TileService  // injected in tests; production default set in Task 9
}
```

- [ ] **Step 2: Use the override in `addSource`**

```ts
// in addSource, raster branch:
const tm = new TileManager(
  rasterSource.url,
  rasterSource.tileService ?? new RasterTileService(),
  this._projection,
  () => this._frameLoop.markDirty(),
  (key) => this._webgl.destroyTexture(key),
)
```

- [ ] **Step 3: Type-check**

```bash
node_modules/.bin/tsc --noEmit -p tsconfig.json
```

Expected: no errors

---

## Task 7: Update `Renderer` tests — inject inline service

**Files:**
- Modify: `src/mini/renderer/renderer.test.ts`

Any test that calls `renderer.addSource(id, { type: 'raster', url: '...' })` needs to inject a service to avoid `fetch` being called (which isn't mocked).

- [ ] **Step 1: Add a makeTileService helper to renderer.test.ts**

```ts
import type { TileService } from '../core/tile-service.ts'

function makeFakeTileService(): TileService {
  return {
    request: vi.fn().mockResolvedValue([]),
    cancel: vi.fn(),
    destroy: vi.fn(),
  }
}
```

- [ ] **Step 2: Update all addSource calls to inject the service**

Find every call like:

```ts
renderer.addSource('basemap', { type: 'raster', url: 'https://...' })
```

Replace with:

```ts
renderer.addSource('basemap', { type: 'raster', url: 'https://...', tileService: makeFakeTileService() })
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/mini/renderer/renderer.ts src/mini/renderer/renderer.test.ts
git commit -m "feat(mini): Renderer accepts tileService override in source definition"
```

---

## Task 8: Create the raster worker

**Files:**
- Create: `src/mini/workers/raster-worker.ts`

The worker class is exposed via Comlink. It is a plain TypeScript class — no awareness of `TileService` interface. It returns `ImageBitmap | null` (null on cancel/error). `Comlink.transfer()` transfers bitmap ownership zero-copy.

- [ ] **Step 1: Create `src/mini/workers/raster-worker.ts`**

```ts
// src/mini/workers/raster-worker.ts
import * as Comlink from 'comlink'

export class RasterWorker {
  private _pending = new globalThis.Map<string, AbortController>()

  async request(key: string, url: string): Promise<ImageBitmap | null> {
    const controller = new AbortController()
    this._pending.set(key, controller)
    try {
      const buf = await fetch(url, { signal: controller.signal }).then(r => r.arrayBuffer())
      const bitmap = await createImageBitmap(new Blob([buf]))
      this._pending.delete(key)
      return Comlink.transfer(bitmap, [bitmap])
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

Comlink.expose(new RasterWorker())
```

- [ ] **Step 2: Type-check**

```bash
node_modules/.bin/tsc --noEmit -p tsconfig.json
```

Expected: no errors

---

## Task 9: Create `WorkerRasterTileService` and wire as default

**Files:**
- Create: `src/mini/layers/raster-worker-service.ts`
- Modify: `src/mini/renderer/renderer.ts`

`WorkerRasterTileService` wraps the worker via Comlink. The worker is loaded by URL so it can be bundled as a separate chunk. `destroy()` releases the Comlink proxy and terminates the worker.

- [ ] **Step 1: Create `src/mini/layers/raster-worker-service.ts`**

```ts
// src/mini/layers/raster-worker-service.ts
import * as Comlink from 'comlink'
import type { Remote } from 'comlink'
import type { TileID } from '../core/types.ts'
import type { TileService } from '../core/tile-service.ts'

// Type-only import of the worker class (not imported at runtime — loaded via URL)
type RasterWorkerType = import('../workers/raster-worker.ts').RasterWorker

export class WorkerRasterTileService implements TileService {
  private _worker: Worker
  private _proxy: Remote<RasterWorkerType>

  constructor() {
    this._worker = new Worker(
      new URL('../workers/raster-worker.ts', import.meta.url),
      { type: 'module' },
    )
    this._proxy = Comlink.wrap<RasterWorkerType>(this._worker)
  }

  async request(tileID: TileID, url: string): Promise<Transferable[]> {
    const bitmap = await this._proxy.request(tileID.key, url)
    return bitmap ? [bitmap] : []
  }

  cancel(key: string): void {
    void this._proxy.cancel(key)  // fire and forget
  }

  destroy(): void {
    this._proxy[Comlink.releaseProxy]()
    this._worker.terminate()
  }
}
```

- [ ] **Step 2: Update `renderer.ts` to use `WorkerRasterTileService` as default**

```ts
import { WorkerRasterTileService } from '../layers/raster-worker-service.ts'

// in addSource, raster branch:
const tm = new TileManager(
  rasterSource.url,
  rasterSource.tileService ?? new WorkerRasterTileService(),
  this._projection,
  () => this._frameLoop.markDirty(),
  (key) => this._webgl.destroyTexture(key),
)
```

Remove the now-redundant `import { RasterLayer, RasterTileService } from '../layers/raster.ts'` if `RasterTileService` is no longer referenced. Keep `RasterLayer` if it's still used elsewhere.

- [ ] **Step 3: Type-check**

```bash
node_modules/.bin/tsc --noEmit -p tsconfig.json
```

Expected: no errors

- [ ] **Step 4: Run all Node tests — expect PASS**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts
```

Expected: all tests pass (tests inject `RasterTileService` directly; `WorkerRasterTileService` is never instantiated in Node tests)

- [ ] **Step 5: Commit**

```bash
git add src/mini/workers/raster-worker.ts src/mini/layers/raster-worker-service.ts src/mini/renderer/renderer.ts
git commit -m "feat(mini): add WorkerRasterTileService (Comlink) as default raster tile service"
```

---

## Task 10: Browser test config + MSW setup

**Files:**
- Create: `vitest.config.mini.browser.ts`
- Create: `src/mini/test-setup.browser.ts`

Browser tests run in a real Chromium tab via Playwright. MSW intercepts `fetch` calls inside the Worker so we can serve fake PNG tiles without a real server.

- [ ] **Step 1: Create `vitest.config.mini.browser.ts`**

```ts
// vitest.config.mini.browser.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'mini-browser',
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [{ browser: 'chromium' }],
    },
    include: ['src/mini/**/*.browser.test.ts'],
    setupFiles: ['src/mini/test-setup.browser.ts'],
  },
})
```

- [ ] **Step 2: Create `src/mini/test-setup.browser.ts`**

This sets up MSW with a valid 1×1 PNG. The PNG bytes are a known-good minimal transparent PNG.

```ts
// src/mini/test-setup.browser.ts
import { setupWorker } from 'msw/browser'
import { http, HttpResponse } from 'msw'

// Minimal 1×1 transparent PNG (base64-decoded at runtime)
const FAKE_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQ' +
  'AABjkB6QAAAABJRU5ErkJggg=='

function b64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

const FAKE_PNG = b64ToBuffer(FAKE_PNG_B64)

export const mswWorker = setupWorker(
  http.get('https://tile.example.com/:z/:x/:y.png', () =>
    HttpResponse.arrayBuffer(FAKE_PNG, { headers: { 'Content-Type': 'image/png' } }),
  ),
  http.get('https://tile.example.com/error/*', () =>
    new HttpResponse(null, { status: 500 }),
  ),
)

// Start MSW before tests run
await mswWorker.start({ onUnhandledRequest: 'bypass' })
```

- [ ] **Step 3: Verify the config file is valid TypeScript**

```bash
node_modules/.bin/tsc --noEmit vitest.config.mini.browser.ts
```

Expected: no errors (or file not found in tsconfig — ignore that, it's a config file)

---

## Task 11: Browser tests for `WorkerRasterTileService`

**Files:**
- Create: `src/mini/workers/raster-worker-service.browser.test.ts`

These tests run in a real browser tab. They instantiate `WorkerRasterTileService` directly, which spawns a real Worker. MSW intercepts the `fetch` inside the worker.

- [ ] **Step 1: Write the failing tests**

```ts
// src/mini/workers/raster-worker-service.browser.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { WorkerRasterTileService } from '../../layers/raster-worker-service.ts'
import type { TileID } from '../../core/types.ts'

const FAKE_TILE: TileID = { z: 10, x: 1, y: 2, key: '10/1/2' }

describe('WorkerRasterTileService (browser)', () => {
  it('request() returns an ImageBitmap for a valid tile URL', async () => {
    const service = new WorkerRasterTileService()
    const result = await service.request(FAKE_TILE, 'https://tile.example.com/10/1/2.png')
    expect(result).toHaveLength(1)
    expect(result[0]).toBeInstanceOf(ImageBitmap)
    service.destroy()
  })

  it('request() returns [] for a failed fetch (HTTP 500)', async () => {
    const service = new WorkerRasterTileService()
    const result = await service.request(FAKE_TILE, 'https://tile.example.com/error/0/0.png')
    expect(result).toHaveLength(0)
    service.destroy()
  })

  it('cancel() before result resolves returns []', async () => {
    const service = new WorkerRasterTileService()
    const promise = service.request(FAKE_TILE, 'https://tile.example.com/10/1/2.png')
    service.cancel(FAKE_TILE.key)
    const result = await promise
    expect(result).toHaveLength(0)
    service.destroy()
  })

  it('destroy() does not throw', () => {
    const service = new WorkerRasterTileService()
    expect(() => service.destroy()).not.toThrow()
  })
})
```

- [ ] **Step 2: Run browser tests — expect FAIL** (files don't exist yet)

```bash
node_modules/.bin/vitest run --config vitest.config.mini.browser.ts
```

Expected: FAIL — `WorkerRasterTileService` can't be found or Worker fails to load.

- [ ] **Step 3: Run browser tests — expect PASS** (after tasks 8–10 are done)

```bash
node_modules/.bin/vitest run --config vitest.config.mini.browser.ts
```

Expected: all 4 browser tests pass

- [ ] **Step 4: Commit**

```bash
git add vitest.config.mini.browser.ts src/mini/test-setup.browser.ts src/mini/workers/raster-worker-service.browser.test.ts
git commit -m "feat(mini): add browser tests for WorkerRasterTileService (Playwright + MSW)"
```

---

## Task 12: Final verification

- [ ] **Step 1: Run all Node tests**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.ts
```

Expected: all tests pass

- [ ] **Step 2: Run all browser tests**

```bash
node_modules/.bin/vitest run --config vitest.config.mini.browser.ts
```

Expected: all tests pass

- [ ] **Step 3: Type-check**

```bash
node_modules/.bin/tsc --noEmit -p tsconfig.json
```

Expected: no errors

- [ ] **Step 4: Final commit**

```bash
git add -p
git commit -m "chore(mini): Phase 4 complete — worker-based tile service"
```
