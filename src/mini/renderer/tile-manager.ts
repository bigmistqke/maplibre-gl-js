// src/mini/renderer/tile-manager.ts
import type { CameraState, TileID } from '../core/types.ts'
import type { TileService } from '../core/tile-service.ts'
import type { Projection, Viewport } from '../core/projection.ts'

// Ported from MapLibre SourceCache: how many zoom levels to search for fallback tiles.
// maxOverzooming: how many levels *above* ideal zoom (lower z, coarser) to look for parent tiles.
// maxUnderzooming: how many levels *below* ideal zoom (higher z, finer) to look for child tiles.
const MAX_OVERZOOMING = 10
const MAX_UNDERZOOMING = 3

interface TileEntry {
  status: 'loading' | 'ready' | 'error'
  data?: Transferable
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
  private _retainSet = new globalThis.Set<string>()
  private _urlTemplate: string
  private _tileService: TileService
  private _projection: Projection
  private _onTileReady: () => void
  private _maxCacheSize: number = Infinity
  private _onEvict: (key: string) => void
  private _minZoom: number
  private _maxZoom: number

  constructor(
    urlTemplate: string,
    tileService: TileService,
    projection: Projection,
    onTileReady: () => void,
    onEvict: (key: string) => void,
    minZoom = 0,
    maxZoom = 22,
  ) {
    this._urlTemplate = urlTemplate
    this._tileService = tileService
    this._projection = projection
    this._onTileReady = onTileReady
    this._onEvict = onEvict
    this._minZoom = minZoom
    this._maxZoom = maxZoom
  }

  updateCacheSize(viewport: Viewport): void {
    const tilesX = Math.ceil(viewport.width / 256) + 1
    const tilesY = Math.ceil(viewport.height / 256) + 1
    this._maxCacheSize = tilesX * tilesY * 5
  }

  update(camera: CameraState, viewport: Viewport): void {
    // Clamp zoom to [minZoom, maxZoom] — mirrors MapLibre SourceCache reading maxzoom from tiles.json.
    // Without clamping, requests above maxZoom 404 and the tile is never ready.
    const clampedZoom = Math.max(this._minZoom, Math.min(this._maxZoom, camera.zoom))
    const clampedCamera = clampedZoom === camera.zoom ? camera : { ...camera, zoom: clampedZoom }
    const visibleTiles = this._projection.getVisibleTiles(clampedCamera, viewport)
    const newVisibleSet = new globalThis.Set(visibleTiles.map(tileKey))

    // Compute retain set using MapLibre's strategy: children preferred, parents as fallback.
    // Must be done BEFORE cancelling so we don't cancel needed fallback tiles.
    const retain = this._updateRetainedTiles(visibleTiles, clampedCamera)

    // Cancel in-flight requests for tiles no longer retained.
    for (const key of this._retainSet) {
      if (!retain.has(key)) {
        const entry = this._tiles.get(key)
        if (entry?.status === 'loading') this._tileService.cancel(key)
      }
    }

    this._visibleSet = newVisibleSet
    this._retainSet = retain

    // Fetch new visible tiles not already in cache.
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
          entry.data = transferables[0]
          this._onTileReady()
        })
        .catch(() => {
          if (this._tiles.has(key)) {
            entry.status = 'error'
          }
        })
    }

    this._evict()
  }

  // Ported from MapLibre SourceCache._updateRetainedTiles.
  // Builds the set of tile keys to keep in memory: ideal tiles + loaded children (preferred)
  // + loaded parents (fallback when children don't cover).
  private _updateRetainedTiles(idealTiles: TileID[], camera: CameraState): globalThis.Set<string> {
    const retain = new globalThis.Set<string>()
    const zoom = camera.zoom ?? 0
    const minCoveringZoom = Math.max(Math.floor(zoom) - MAX_OVERZOOMING, 0)
    const maxCoveringZoom = Math.floor(zoom) + MAX_UNDERZOOMING

    // All ideal tiles go into retain immediately (even if still loading).
    const missingTiles = new globalThis.Map<string, TileID>()
    for (const tileID of idealTiles) {
      retain.add(tileID.key)
      const entry = this._tiles.get(tileID.key)
      if (!entry || entry.status !== 'ready') {
        missingTiles.set(tileID.key, tileID)
      }
    }

    // First preference: retain loaded children of missing tiles (finer detail).
    this._retainLoadedChildren(missingTiles, Math.floor(zoom), maxCoveringZoom, retain)

    // Second preference: for missing tiles not covered by children, walk up to find loaded parents.
    const checked = new globalThis.Set<string>()
    for (const tileID of idealTiles) {
      const entry = this._tiles.get(tileID.key)
      if (entry?.status === 'ready') continue

      // Check if all 4 immediate children are already retained (tile is covered).
      const cx = tileID.x * 2, cy = tileID.y * 2, cz = tileID.z + 1
      if (retain.has(`${cz}/${cx}/${cy}`) &&
          retain.has(`${cz}/${cx + 1}/${cy}`) &&
          retain.has(`${cz}/${cx}/${cy + 1}`) &&
          retain.has(`${cz}/${cx + 1}/${cy + 1}`)) continue

      // Walk up the tile pyramid looking for a loaded ancestor.
      for (let pz = tileID.z - 1; pz >= minCoveringZoom; pz--) {
        const dz = tileID.z - pz
        const pKey = `${pz}/${tileID.x >> dz}/${tileID.y >> dz}`
        if (checked.has(pKey)) break   // another sibling already walked this path
        checked.add(pKey)
        const pEntry = this._tiles.get(pKey)
        if (pEntry?.status === 'ready' && pEntry.data !== undefined) {
          retain.add(pKey)
          break
        }
      }
    }

    return retain
  }

  // Ported from MapLibre SourceCache._retainLoadedChildren.
  // For each loaded tile above the ideal zoom, retains the *topmost* loaded ancestor on its
  // path that still covers a missing ideal tile — avoids retaining redundant deeper children.
  private _retainLoadedChildren(
    idealTiles: globalThis.Map<string, TileID>,
    zoom: number,
    maxCoveringZoom: number,
    retain: globalThis.Set<string>,
  ): void {
    for (const [id, entry] of this._tiles) {
      if (retain.has(id) || entry.status !== 'ready' || entry.data === undefined) continue
      const [z, x, y] = id.split('/').map(Number)
      if (z <= zoom || z > maxCoveringZoom) continue

      // Walk up from this child toward zoom+1, tracking the topmost loaded tile on the path.
      let topmostKey = id
      let tz = z, tx = x, ty = y
      while (tz > zoom + 1) {
        tz--; tx >>= 1; ty >>= 1
        const pKey = `${tz}/${tx}/${ty}`
        const pEntry = this._tiles.get(pKey)
        if (pEntry?.status === 'ready' && pEntry.data !== undefined) {
          topmostKey = pKey
        }
      }

      // Retain the topmost child only if its ancestor is a missing ideal tile.
      const [tmz, tmx, tmy] = topmostKey.split('/').map(Number)
      let az = tmz, ax = tmx, ay = tmy
      while (az >= zoom) {
        if (idealTiles.has(`${az}/${ax}/${ay}`)) {
          retain.add(topmostKey)
          break
        }
        az--; ax >>= 1; ay >>= 1
      }
    }
  }

  private _evict(): void {
    if (this._tiles.size <= this._maxCacheSize) return
    for (const [key, entry] of this._tiles) {
      if (this._tiles.size <= this._maxCacheSize) break
      if (this._visibleSet.has(key)) continue
      if (this._retainSet.has(key)) continue
      if (entry.status === 'loading') {
        this._tileService.cancel(key)
      }
      if (entry.data && typeof (entry.data as ImageBitmap).close === 'function') {
        ;(entry.data as ImageBitmap).close()
      }
      this._onEvict(key)
      this._tiles.delete(key)
    }
  }

  getReadyTiles(): Array<{ tileID: TileID; data: Transferable }> {
    // Return all retained tiles that have data, sorted by z ascending.
    // Coarser (lower-z) tiles render first; finer tiles overwrite via stencil ALWAYS+REPLACE.
    // This mirrors MapLibre's draw order (compareTileId sorts by overscaledZ ascending).
    const result: Array<{ tileID: TileID; data: Transferable }> = []
    for (const key of this._retainSet) {
      const entry = this._tiles.get(key)
      if (entry?.status === 'ready' && entry.data !== undefined) {
        const [z, x, y] = key.split('/').map(Number)
        result.push({ tileID: { z, x, y, key }, data: entry.data })
      }
    }
    result.sort((a, b) => a.tileID.z - b.tileID.z)
    return result
  }

  getRetainedKeys(): Set<string> {
    return this._retainSet
  }

  destroy(): void {
    for (const entry of this._tiles.values()) {
      if (entry.data && typeof (entry.data as ImageBitmap).close === 'function') {
        ;(entry.data as ImageBitmap).close()
      }
    }
    this._tileService.destroy()
    this._tiles.clear()
    this._visibleSet.clear()
    this._retainSet.clear()
  }
}
