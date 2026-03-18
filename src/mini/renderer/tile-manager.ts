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

    this._evict()
  }

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
