// src/mini/renderer/tile-manager.test.ts
import { describe, it, expect, vi } from 'vitest'
import { TileManager } from './tile-manager.ts'
import type { Projection, Viewport } from '../core/projection.ts'
import type { CameraState, TileID } from '../core/types.ts'
import type { TileService } from '../core/tile-service.ts'

const FAKE_TILE: TileID = { z: 10, x: 528, y: 341, key: '10/528/341' }
const FAKE_TILE_2: TileID = { z: 10, x: 529, y: 341, key: '10/529/341' }

const CAMERA: CameraState = {
  center: { lng: 4.9, lat: 52.37 },
  zoom: 10,
  bearing: 0,
  pitch: 0,
  groundElevation: 0,
}

const VIEWPORT: Viewport = { width: 512, height: 512 }

function makeProjection(tiles: TileID[]): Projection {
  return {
    getVisibleTiles: vi.fn().mockReturnValue(tiles),
    getTileMatrix: vi.fn().mockReturnValue(new Float32Array(16)),
  }
}

function makeTileService(data?: Transferable): TileService {
  const defaultData = data ?? ({ close: vi.fn() } as unknown as Transferable)
  return {
    request: vi.fn().mockResolvedValue([defaultData]),
    cancel: vi.fn(),
    destroy: vi.fn(),
  }
}

describe('TileManager', () => {
  it('update() calls projection.getVisibleTiles() with the camera and viewport', () => {
    const projection = makeProjection([FAKE_TILE])
    const tileService = makeTileService()
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
      vi.fn(),  // onEvict
    )
    manager.update(CAMERA, VIEWPORT)
    expect(projection.getVisibleTiles).toHaveBeenCalledWith(CAMERA, VIEWPORT)
  })

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

  it('update() does not request a tile already in cache', async () => {
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

  it('getReadyTiles() returns only tiles with status ready that are in current visible set', async () => {
    const fakeData = { close: vi.fn() } as unknown as Transferable
    const tileService = makeTileService(fakeData)
    const projection = makeProjection([FAKE_TILE])
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
      vi.fn(),  // onEvict
    )

    manager.update(CAMERA, VIEWPORT)
    // No tiles ready yet (fetch is still in flight)
    expect(manager.getReadyTiles()).toHaveLength(0)

    // Resolve the fetch and process chain
    await vi.waitFor(() => expect(onTileReady).toHaveBeenCalled())
    expect(manager.getReadyTiles()).toHaveLength(1)
    expect(manager.getReadyTiles()[0].tileID).toEqual(FAKE_TILE)
    expect(manager.getReadyTiles()[0].data).toBe(fakeData)
  })

  it('getReadyTiles() does not return tiles outside the current visible set', async () => {
    const fakeData = { close: vi.fn() } as unknown as Transferable
    const tileService = makeTileService(fakeData)
    const projection = makeProjection([FAKE_TILE])
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
      vi.fn(),  // onEvict
    )

    manager.update(CAMERA, VIEWPORT)
    await vi.waitFor(() => expect(onTileReady).toHaveBeenCalled())

    // Remove tile from visible set
    ;(projection.getVisibleTiles as ReturnType<typeof vi.fn>).mockReturnValue([])
    manager.update(CAMERA, VIEWPORT)

    // Tile is ready in cache but not in visible set → not returned
    expect(manager.getReadyTiles()).toHaveLength(0)
  })

  it('onTileReady callback is called when a tile finishes processing', async () => {
    const fakeData = { close: vi.fn() } as unknown as Transferable
    const tileService = makeTileService(fakeData)
    const projection = makeProjection([FAKE_TILE])
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
      vi.fn(),  // onEvict
    )

    manager.update(CAMERA, VIEWPORT)
    await vi.waitFor(() => expect(onTileReady).toHaveBeenCalled())
  })

  it('destroy() closes bitmaps for ready tiles and calls tileService.destroy()', () => {
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

    expect(tileService.destroy).toHaveBeenCalled()
    // cancel() is NOT called individually — destroy() handles cleanup internally
    expect(tileService.cancel).not.toHaveBeenCalled()
  })
})

describe('TileManager — eviction', () => {
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
        data: { close: vi.fn() },
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
    tiles.set('tile-A', { status: 'ready', data: { close: vi.fn() } })
    tiles.set('tile-B', { status: 'ready', data: { close: vi.fn() } })
    tiles.set('tile-C', { status: 'ready', data: { close: vi.fn() } })

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
      data: { close: vi.fn() },
    })
    tiles.set('extra-1', { status: 'ready', data: { close: vi.fn() } })
    tiles.set('extra-2', { status: 'ready', data: { close: vi.fn() } })

    ;(manager as any)._maxCacheSize = 1
    manager.update(CAMERA, VIEWPORT)
    // _visibleSet = {FAKE_TILE.key} → FAKE_TILE skipped, extras evicted

    expect(onEvict).not.toHaveBeenCalledWith(FAKE_TILE.key)
    expect(onEvict).toHaveBeenCalledWith('extra-1')
    expect(onEvict).toHaveBeenCalledWith('extra-2')
  })

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

  it('calls data.close() on evicted ready tiles', () => {
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
      data: { close: closeSpy },
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
      data: { close: vi.fn() },
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
