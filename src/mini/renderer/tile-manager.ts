// src/mini/renderer/tile-manager.ts
import type { CameraState, TileID } from '../core/types.ts'
import type { TileService } from '../core/tile-service.ts'
import type { Projection, Viewport } from '../core/projection.ts'

const MAX_FALLBACK_LEVELS = 8

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

  constructor(
    urlTemplate: string,
    tileService: TileService,
    projection: Projection,
    onTileReady: () => void,
    onEvict: (key: string) => void,
  ) {
    this._urlTemplate = urlTemplate
    this._tileService = tileService
    this._projection = projection
    this._onTileReady = onTileReady
    this._onEvict = onEvict
  }

  updateCacheSize(viewport: Viewport): void {
    const tilesX = Math.ceil(viewport.width / 256) + 1
    const tilesY = Math.ceil(viewport.height / 256) + 1
    this._maxCacheSize = tilesX * tilesY * 5
  }

  update(camera: CameraState, viewport: Viewport): void {
    const visibleTiles = this._projection.getVisibleTiles(camera, viewport)
    const newVisibleSet = new globalThis.Set(visibleTiles.map(tileKey))

    // Build retain set FIRST — ancestor tiles of any not-yet-ready new visible tile.
    // We need this before cancelling so we don't cancel tiles needed as fallbacks.
    const retainSet = new globalThis.Set<string>()
    for (const tileID of visibleTiles) {
      const entry = this._tiles.get(tileID.key)
      if (!entry || entry.status === 'loading') {
        for (let dz = 1; dz <= MAX_FALLBACK_LEVELS; dz++) {
          const pz = tileID.z - dz
          if (pz < 0) break
          retainSet.add(`${pz}/${tileID.x >> dz}/${tileID.y >> dz}`)
        }
      }
    }
    this._retainSet = retainSet

    // Cancel in-flight requests for tiles no longer visible AND not needed as fallbacks.
    // Tiles in retainSet may still be loading — keep them alive so they can resolve
    // and serve as fallbacks while the new zoom-level tiles are loading.
    for (const key of this._visibleSet) {
      if (!newVisibleSet.has(key) && !retainSet.has(key)) {
        const entry = this._tiles.get(key)
        if (entry && entry.status === 'loading') {
          this._tileService.cancel(key)
        }
      }
    }

    this._visibleSet = newVisibleSet

    // Fetch new visible tiles not already in cache
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
    // Fallbacks drawn first — child tiles overwrite them via stencil ALWAYS+REPLACE
    const fallbacks = new globalThis.Map<string, { tileID: TileID; data: Transferable }>()
    const primary: Array<{ tileID: TileID; data: Transferable }> = []

    for (const key of this._visibleSet) {
      const entry = this._tiles.get(key)
      if (entry?.status === 'ready' && entry.data !== undefined) {
        const [z, x, y] = key.split('/').map(Number)
        primary.push({ tileID: { z, x, y, key }, data: entry.data })
      } else {
        // Tile not ready — look for a cached ancestor to show in its place
        const [z, x, y] = key.split('/').map(Number)
        for (let dz = 1; dz <= MAX_FALLBACK_LEVELS; dz++) {
          const pz = z - dz
          if (pz < 0) break
          const pKey = `${pz}/${x >> dz}/${y >> dz}`
          if (fallbacks.has(pKey)) break  // already queued this ancestor
          const pEntry = this._tiles.get(pKey)
          if (pEntry?.status === 'ready' && pEntry.data !== undefined) {
            fallbacks.set(pKey, { tileID: { z: pz, x: x >> dz, y: y >> dz, key: pKey }, data: pEntry.data })
            break
          }
        }
      }
    }

    return [...fallbacks.values(), ...primary]
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
