# MapLibre Clean-Room — Phase 3: LRU Tile Eviction

**Date:** 2026-03-18
**Status:** Draft
**Goal:** Bound memory usage by evicting least-recently-inserted (oldest) tiles from TileManager and freeing their GPU textures when the cache exceeds a viewport-derived limit.

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

**Dynamic cache size.** The limit scales with the viewport so larger screens get larger caches:
```
maxCacheSize = (ceil(width/tileSize) + 1) × (ceil(height/tileSize) + 1) × MAX_ZOOM_LEVELS
```
`MAX_ZOOM_LEVELS = 5` (matches MapLibre default).

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

### TileManager constructor (updated signature)

```ts
constructor(
  urlTemplate: string,
  tileService: TileService,
  projection: Projection,
  onTileReady: () => void,
  onEvict: (key: string) => void,  // NEW — called when a tile is evicted
)
```

`_maxCacheSize` starts at `Infinity` until `updateCacheSize` is first called.

### New public method: `updateCacheSize(viewport: Viewport): void`

```ts
updateCacheSize(viewport: Viewport): void {
  const tilesX = Math.ceil(viewport.width / 256) + 1
  const tilesY = Math.ceil(viewport.height / 256) + 1
  this._maxCacheSize = tilesX * tilesY * 5
}
```

Called by Renderer in `setCamera` and `resize` (after constructing `viewport`).

### Private: `_evict(): void`

Called at the end of `update()`. Iterates `_tiles` in insertion order (oldest first). Skips any key in `_visibleSet`. For each evicted tile:
1. `entry.imageBitmap?.close()` — free CPU memory
2. `this._onEvict(key)` — notify Renderer to destroy GPU texture
3. `this._tiles.delete(key)` — remove from cache

Stops once `_tiles.size <= _maxCacheSize`.

```ts
private _evict(): void {
  if (this._tiles.size <= this._maxCacheSize) return
  for (const [key, entry] of this._tiles) {
    if (this._tiles.size <= this._maxCacheSize) break
    if (this._visibleSet.has(key)) continue
    entry.imageBitmap?.close()
    this._onEvict(key)
    this._tiles.delete(key)
  }
}
```

### WebGLContext: `destroyTexture(key: string): void`

```ts
destroyTexture(key: string): void {
  const tex = this._textures.get(key)
  if (!tex) return
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

`setCamera` calls `updateCacheSize` after constructing viewport:
```ts
setCamera(state: CameraState): void {
  this._camera = state
  const viewport: Viewport = { width: this._width, height: this._height }
  for (const tm of this._tileManagers.values()) {
    tm.updateCacheSize(viewport)   // NEW
    tm.update(state, viewport)
  }
  this._frameLoop.markDirty()
}
```

`resize` also calls `updateCacheSize`:
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

---

## Testing

All tests in `vitest.config.mini.ts` (node environment, manual mocks).

### TileManager eviction tests

```ts
it('_evict() removes oldest non-visible tiles when over maxCacheSize', ...)
// Manually fill _tiles with N entries, set _visibleSet to empty,
// call updateCacheSize with a small viewport → _evict() fires,
// oldest tiles removed until under limit.

it('_evict() never removes tiles in _visibleSet', ...)
// Fill cache over limit, put all tiles in _visibleSet → none evicted.

it('_evict() calls imageBitmap.close() on evicted tiles', ...)
// Verify close() called for each evicted entry that has an imageBitmap.

it('_evict() calls onEvict callback with the tile key', ...)
// onEvict spy receives the correct key string.

it('updateCacheSize sets maxCacheSize based on viewport dimensions', ...)
// viewport 512×512, tileSize 256: (2+1)×(2+1)×5 = 45. Verify internal _maxCacheSize.
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
// Set up small cache, trigger eviction, verify _webgl.destroyTexture called.
```

---

## What Phase 3C Adds

- TTL / HTTP expiry support in TileManager
- InputHandler (pan/drag/scroll)
- Parent-tile fallback rendering
