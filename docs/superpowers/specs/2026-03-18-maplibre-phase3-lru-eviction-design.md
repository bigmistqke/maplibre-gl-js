# MapLibre Clean-Room — Phase 3: FIFO Tile Eviction

**Date:** 2026-03-18
**Status:** Draft
**Goal:** Bound memory usage by evicting oldest-inserted tiles from TileManager and freeing their GPU textures when the cache exceeds a viewport-derived limit.

---

## Scope

**In scope:**
- `TileManager` — eviction logic, `updateCacheSize()`, `onEvict` callback
- `WebGLContext.destroyTexture()` — delete GL texture + remove from cache
- `Renderer` — wire `onEvict` + call `updateCacheSize` on setCamera/resize

**Out of scope:**
- TTL / HTTP cache-control expiry
- Parent-tile fallback (show lower-zoom tiles while loading)
- InputHandler, vector tiles, workers

---

## Design Principles

**Follow MapLibre's proven approach.** MapLibre uses oldest-inserted-first (FIFO) eviction, not true access-order LRU. Getting a tile does not reorder it — only adding does. This is simpler and sufficient for a tile cache where recently-visible tiles naturally stay near the end.

**Visible tiles are never evicted.** A tile currently in `_visibleSet` is always safe regardless of cache pressure.

**All non-visible tiles can be evicted, including `loading` ones.** The abort mechanism already exists from Phase 2 — `update()` calls `entry.controller.abort()` to cancel out-of-view tiles, and the fetch/process chain checks `signal.aborted` and bails out cleanly. `_evict()` reuses the same pattern: call `entry.controller.abort()` before deleting. This avoids any bitmap leak and keeps eviction simple — no status check needed.

**Dynamic cache size.** The limit scales with the viewport so larger screens get larger caches. Tile size is always 256 px in Phase 3:
```
maxCacheSize = (ceil(width / 256) + 1) × (ceil(height / 256) + 1) × MAX_ZOOM_LEVELS
```
`MAX_ZOOM_LEVELS = 5` (matches MapLibre default).

**`resize()` defers eviction.** `resize()` calls `updateCacheSize()` but not `update()`. Eviction fires on the next `setCamera()` call. This is intentional — resize without a camera change is rare, and eviction is cheap to defer.

---

## File Map

| File | Change | Responsibility |
|------|--------|----------------|
| `src/mini/renderer/tile-manager.ts` | Modify | Eviction logic, `updateCacheSize()`, `onEvict` callback |
| `src/mini/renderer/tile-manager.test.ts` | Modify | Eviction tests |
| `src/mini/renderer/webgl-context.ts` | Modify | Add `destroyTexture(key)` |
| `src/mini/renderer/webgl-context.test.ts` | Modify | `destroyTexture` tests |
| `src/mini/renderer/renderer.ts` | Modify | Wire `onEvict`, call `updateCacheSize` |
| `src/mini/renderer/renderer.test.ts` | Modify | Integration: eviction triggered from Renderer |

---

## Interfaces

### TileManager — updated class fields and constructor

```ts
// New private fields added to the class:
private _maxCacheSize: number = Infinity  // Infinity until updateCacheSize() is first called
private _onEvict: (key: string) => void

constructor(
  urlTemplate: string,
  tileService: TileService,
  projection: Projection,
  onTileReady: () => void,
  onEvict: (key: string) => void,  // NEW — called when a ready tile is evicted
) {
  // ... existing assignments ...
  this._onEvict = onEvict
}
```

### New public method: `updateCacheSize(viewport: Viewport): void`

```ts
updateCacheSize(viewport: Viewport): void {
  const tilesX = Math.ceil(viewport.width / 256) + 1
  const tilesY = Math.ceil(viewport.height / 256) + 1
  this._maxCacheSize = tilesX * tilesY * 5
}
```

Tile size is always 256 px in Phase 3. Called by Renderer in `setCamera` and `resize`.

### Updated `update()` — calls `_evict()` at the end

```ts
update(camera: CameraState, viewport: Viewport): void {
  // ... existing: compute visible tiles, cancel out-of-view, fetch new ...
  this._evict()  // NEW — runs after visible set and fetches are updated
}
```

Order matters: `_visibleSet` must be updated before `_evict()` runs, so eviction always sees
the current visible set. In `setCamera`, `updateCacheSize` fires first, then `update` (which
calls `_evict`). This is the correct order.

### Private: `_evict(): void`

Only evicts tiles with `status === 'ready'`. Iterates `_tiles` in insertion order (oldest
first). JavaScript `Map` iteration is safe for deleting the current key inside `for...of`.
Skips visible tiles. Stops once `_tiles.size <= _maxCacheSize`.

```ts
private _evict(): void {
  if (this._tiles.size <= this._maxCacheSize) return
  for (const [key, entry] of this._tiles) {
    if (this._tiles.size <= this._maxCacheSize) break
    if (this._visibleSet.has(key)) continue
    entry.controller.abort()       // cancel in-flight fetch if loading
    entry.imageBitmap?.close()     // free CPU memory if ready
    this._onEvict(key)             // notify Renderer to free GPU texture if any
    this._tiles.delete(key)
  }
}
```

### WebGLContext: `destroyTexture(key: string): void`

```ts
destroyTexture(key: string): void {
  const tex = this._textures.get(key)
  if (!tex) return                  // no-op for unknown keys
  this.gl.deleteTexture(tex)
  this._textures.delete(key)
}
```

After this call, `getOrCreateTexture(key, bitmap)` will re-upload the bitmap as a fresh texture.

### Renderer wiring

`addSource` (raster branch) passes `onEvict`:
```ts
const tm = new TileManager(
  rasterSource.url,
  new RasterTileService(),
  this._projection,
  () => this._frameLoop.markDirty(),
  (key) => this._webgl.destroyTexture(key),  // NEW
)
```

`setCamera` calls `updateCacheSize` before `update` (so `_maxCacheSize` is current when
`_evict()` runs at the end of `update`):
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

`resize` updates cache size only (eviction deferred to next `setCamera`):
```ts
resize(width: number, height: number): void {
  this._width = width
  this._height = height
  const viewport: Viewport = { width, height }
  for (const tm of this._tileManagers.values()) {
    tm.updateCacheSize(viewport)   // NEW — eviction deferred to next setCamera
  }
  this._frameLoop.markDirty()
}
```

---

## Testing

All tests in `vitest.config.mini.ts` (node environment, manual mocks).

### TileManager eviction tests

```ts
it('eviction does not fire before updateCacheSize is called', ...)
// Fill _tiles with many ready entries, never call updateCacheSize.
// Confirm no tiles are evicted (_tiles.size unchanged).

it('_evict() removes oldest non-visible tiles when over maxCacheSize', ...)
// Insert tiles A, B, C (all ready, none visible).
// Call updateCacheSize with a viewport that sets maxCacheSize = 1.
// Call update() → _evict() fires.
// Only tile A (oldest) is removed; B and C remain.
// Confirms oldest-first eviction order.

it('_evict() never removes tiles in _visibleSet', ...)
// Fill cache over limit with all tiles in _visibleSet → none evicted.

it('_evict() aborts in-flight requests on loading tiles', ...)
// Insert a loading tile, trigger eviction → verify controller.abort() was called.

it('_evict() calls imageBitmap.close() on evicted tiles', ...)
// Verify close() called for each evicted entry that has an imageBitmap.
// A tile without imageBitmap (imageBitmap === undefined) does not throw.

it('_evict() calls onEvict callback with the tile key', ...)
// onEvict spy receives the correct key string(s).

it('updateCacheSize sets maxCacheSize based on viewport dimensions', ...)
// viewport 512×512: (2+1)×(2+1)×5 = 45. Verify internal _maxCacheSize.
```

### WebGLContext `destroyTexture` tests

```ts
it('destroyTexture calls gl.deleteTexture and removes from cache', ...)
// getOrCreateTexture → destroyTexture → verify gl.deleteTexture called,
// subsequent getOrCreateTexture calls gl.texImage2D again (re-uploads).

it('destroyTexture is a no-op for unknown keys', ...)
// destroyTexture('nonexistent') does not throw.
```

### Renderer integration test

```ts
it('Renderer calls destroyTexture when TileManager evicts a tile', ...)
// Construct Renderer. Access its _webgl via (renderer as any)._webgl and spy on destroyTexture.
// Call addSource (creates TileManager with onEvict wired to destroyTexture).
// Manually fill (renderer as any)._tileManagers.get('src')._tiles with ready entries.
// Call setCamera with a small viewport → updateCacheSize + update → _evict fires.
// Verify destroyTexture spy was called with the evicted tile key.
```

---

## What Phase 3C Adds

- TTL / HTTP expiry support in TileManager
- InputHandler (pan/drag/scroll)
- Parent-tile fallback rendering
