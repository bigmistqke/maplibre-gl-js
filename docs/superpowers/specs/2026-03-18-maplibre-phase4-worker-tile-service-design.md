# MapLibre Clean-Room — Phase 4: Worker-Based Tile Service

**Date:** 2026-03-18
**Status:** Draft
**Goal:** Move tile fetching and decoding off the main thread by running `RasterTileService` logic inside a Web Worker, keeping the main thread free for rendering and future input handling.

---

## Scope

**In scope:**
- Updated `TileService` interface — `request / cancel / destroy`, service owns fetch
- Updated `RasterTileService` — implements new interface (fetch + createImageBitmap inline)
- `WorkerRasterTileService` — Comlink-based wrapper, implements `TileService`
- `raster-worker.ts` — Comlink-exposed worker class (fetch + createImageBitmap)
- `TileManager` — remove `fetch` + `AbortController`; delegate entirely to service
- `Renderer` — use `WorkerRasterTileService` by default; accept `tileService` override in source definition for testing
- `vitest.config.mini.browser.ts` — new browser test config (Playwright provider + MSW)
- Browser tests for worker service (`*.browser.test.ts`)

**Out of scope:**
- Migration of existing Node tests to browser (deferred to a later phase)
- InputHandler / pan gestures
- Vector tiles, FillLayer, LineLayer
- Multiple workers / worker pooling

---

## Design Principles

**Service owns fetch.** `TileManager` no longer calls `fetch`. It calls `tileService.request(tileID, url)` and receives `Transferable[]`. The service decides whether to fetch inline or delegate to a worker.

**Comlink, not hand-rolled protocol.** The Worker is exposed via `Comlink.expose()` and consumed via `Comlink.wrap()`. No message IDs, no discriminated unions, no `onmessage` dispatch. The worker looks like a normal TypeScript class.

**Always resolves, never rejects.** Both cancellation and errors return `[]`. TileManager distinguishes them by whether the tile entry still exists in `_tiles` at the time the promise resolves (cancelled entries are removed synchronously before `[]` arrives; errored entries remain and get `status = 'error'`).

**Zero-copy bitmap transfer.** `Comlink.transfer(bitmap, [bitmap])` transfers ownership of the `ImageBitmap` from worker to main thread without cloning.

**Testability via source definition override.** `Renderer.addSource` accepts an optional `tileService` in the source definition. Tests pass an inline `RasterTileService`; production gets `WorkerRasterTileService` by default.

**Browser tests for worker code.** Existing Node tests are untouched. New tests for worker-related code use `vitest.config.mini.browser.ts` (Playwright provider) with MSW for fetch mocking. Test files are named `*.browser.test.ts`.

---

## File Map

| File | Change | Responsibility |
|------|--------|----------------|
| `src/mini/core/tile-service.ts` | Modify | New `TileService` interface |
| `src/mini/layers/raster.ts` | Modify | Update `RasterTileService` to new interface |
| `src/mini/layers/raster-worker-service.ts` | Create | `WorkerRasterTileService` (Comlink main-thread side) |
| `src/mini/workers/raster-worker.ts` | Create | Comlink worker (fetch + createImageBitmap) |
| `src/mini/renderer/tile-manager.ts` | Modify | Remove fetch/AbortController; delegate to service |
| `src/mini/renderer/tile-manager.test.ts` | Modify | Update tests for new TileService interface |
| `src/mini/renderer/renderer.ts` | Modify | Use `WorkerRasterTileService`; accept `tileService` override |
| `src/mini/renderer/renderer.test.ts` | Modify | Inject inline `RasterTileService` via source definition |
| `vitest.config.mini.browser.ts` | Create | Browser test config (Playwright + MSW) |
| `src/mini/workers/raster-worker-service.browser.test.ts` | Create | Browser tests for `WorkerRasterTileService` |

---

## Interfaces

### Updated `TileService` (`src/mini/core/tile-service.ts`)

```ts
import type { TileID } from './types.ts'

export interface TileService {
  /** Fetch and decode a tile. Resolves with [ImageBitmap] on success, [] on cancel or error. */
  request(tileID: TileID, url: string): Promise<Transferable[]>
  /** Cancel an in-flight request. No-op if the key is unknown. */
  cancel(key: string): void
  /** Terminate the service (terminate worker if applicable). */
  destroy(): void
}
```

### Updated `RasterTileService` (`src/mini/layers/raster.ts`)

Now owns `fetch` + `createImageBitmap`. Tracks its own `AbortController` per tile:

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

Note: errors also return `[]` here (not thrown). TileManager treats `[]` from a still-present entry as an error.

### Worker script (`src/mini/workers/raster-worker.ts`)

```ts
import * as Comlink from 'comlink'

class RasterWorker {
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

### `WorkerRasterTileService` (`src/mini/layers/raster-worker-service.ts`)

```ts
import * as Comlink from 'comlink'
import type { Remote } from 'comlink'
import type { TileID } from '../core/types.ts'
import type { TileService } from '../core/tile-service.ts'

// Import type only — the worker is loaded via URL at runtime
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
    this._proxy.cancel(key)  // fire and forget
  }

  destroy(): void {
    this._proxy[Comlink.releaseProxy]()
    this._worker.terminate()
  }
}
```

### Updated `TileEntry` and `TileManager` (`src/mini/renderer/tile-manager.ts`)

`TileEntry` loses `controller` — the service owns cancellation:

```ts
interface TileEntry {
  status: 'loading' | 'ready' | 'error'
  imageBitmap?: ImageBitmap
}
```

`update()` replaces `_fetchTile` with a service call:

```ts
// In update(), for each new visible tile not in cache:
const entry: TileEntry = { status: 'loading' }
this._tiles.set(key, entry)

this._tileService.request(tileID, buildURL(this._urlTemplate, tileID))
  .then(transferables => {
    if (!this._tiles.has(key)) return          // evicted or cancelled
    if (transferables.length === 0) {
      entry.status = 'error'                   // fetch/decode failed
      return
    }
    entry.status = 'ready'
    entry.imageBitmap = transferables[0] as ImageBitmap
    this._onTileReady()
  })
```

Cancellation everywhere calls `this._tileService.cancel(key)` instead of `entry.controller.abort()`:
- Out-of-view tiles in `update()`: `this._tileService.cancel(key)`
- Eviction in `_evict()`: `this._tileService.cancel(key)` (replaces `entry.controller.abort()`)
- `destroy()`: `this._tileService.cancel(key)` for all loading tiles, then `this._tileService.destroy()`

### Renderer changes (`src/mini/renderer/renderer.ts`)

Source definition accepts optional `tileService` for testing:

```ts
interface RasterSourceDefinition extends SourceDefinition {
  type: 'raster'
  url: string
  tileSize?: number
  tileService?: TileService  // injected in tests; defaults to WorkerRasterTileService
}
```

`addSource` uses the override or falls back to `WorkerRasterTileService`:

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

Existing renderer tests inject `RasterTileService` via the source definition — no Worker needed in Node.

---

## Testing

### Existing Node tests (`vitest.config.mini.ts`)

Unchanged. `renderer.test.ts` injects an inline `RasterTileService` via `tileService` in the source definition override. All 100 existing tests continue to pass.

### Browser test config (`vitest.config.mini.browser.ts`)

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      name: 'chromium',
    },
    include: ['src/mini/**/*.browser.test.ts'],
    setupFiles: ['src/mini/test-setup.browser.ts'],
  },
})
```

### MSW setup (`src/mini/test-setup.browser.ts`)

```ts
import { setupWorker } from 'msw/browser'
import { http, HttpResponse } from 'msw'

// 1×1 transparent PNG (valid ImageBitmap source)
const FAKE_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  // ... minimal IHDR + IDAT + IEND chunks
])

export const mswWorker = setupWorker(
  http.get('https://tile.example.com/:z/:x/:y.png', () =>
    HttpResponse.arrayBuffer(FAKE_PNG.buffer)
  ),
)
```

### Browser tests (`src/mini/workers/raster-worker-service.browser.test.ts`)

```ts
it('request() returns an ImageBitmap for a valid tile URL', async () => {
  const service = new WorkerRasterTileService()
  const result = await service.request(FAKE_TILE, 'https://tile.example.com/10/1/2.png')
  expect(result).toHaveLength(1)
  expect(result[0]).toBeInstanceOf(ImageBitmap)
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

it('request() returns [] for a failed fetch', async () => {
  // MSW returns 500 for this URL
  const service = new WorkerRasterTileService()
  const result = await service.request(FAKE_TILE, 'https://tile.example.com/error/0/0.png')
  expect(result).toHaveLength(0)
  service.destroy()
})

it('destroy() terminates the worker', async () => {
  const service = new WorkerRasterTileService()
  expect(() => service.destroy()).not.toThrow()
})
```

---

## What Phase 5 Adds

- Migration of existing Node tests to browser (Playwright + MSW)
- InputHandler (pan/drag/scroll)
- Parent-tile fallback rendering
