// src/mini/renderer/tile-manager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

function makeTileService(): TileService {
  return {
    process: vi.fn().mockResolvedValue([{ close: vi.fn() }]),
  }
}

describe('TileManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('update() calls projection.getVisibleTiles() with the camera and viewport', () => {
    const projection = makeProjection([FAKE_TILE])
    const tileService = makeTileService()
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
    )
    manager.update(CAMERA, VIEWPORT)
    expect(projection.getVisibleTiles).toHaveBeenCalledWith(CAMERA, VIEWPORT)
  })

  it('update() calls fetch() for each visible tile not already in cache', async () => {
    const projection = makeProjection([FAKE_TILE])
    const tileService = makeTileService()
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
    )
    manager.update(CAMERA, VIEWPORT)
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith(
      'https://tile.openstreetmap.org/10/528/341.png',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('update() does not fetch a tile already in cache', async () => {
    const projection = makeProjection([FAKE_TILE])
    const tileService = makeTileService()
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
    )
    manager.update(CAMERA, VIEWPORT)
    manager.update(CAMERA, VIEWPORT)
    // fetch should only be called once — tile already in cache on second update
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('update() cancels in-flight requests for tiles no longer in visible set', () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort')

    const projection = makeProjection([FAKE_TILE])
    const tileService = makeTileService()
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
    )

    // First update: FAKE_TILE is visible → fetch starts
    manager.update(CAMERA, VIEWPORT)

    // Second update: nothing visible → FAKE_TILE is cancelled
    ;(projection.getVisibleTiles as ReturnType<typeof vi.fn>).mockReturnValue([])
    manager.update(CAMERA, VIEWPORT)

    expect(abortSpy).toHaveBeenCalled()
    abortSpy.mockRestore()
  })

  it('getReadyTiles() returns only tiles with status ready that are in current visible set', async () => {
    const fakeBitmap = { close: vi.fn() } as unknown as ImageBitmap
    const tileService: TileService = {
      process: vi.fn().mockResolvedValue([fakeBitmap]),
    }
    const projection = makeProjection([FAKE_TILE])
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
    )

    manager.update(CAMERA, VIEWPORT)
    // No tiles ready yet (fetch is still in flight)
    expect(manager.getReadyTiles()).toHaveLength(0)

    // Resolve the fetch and process chain
    await vi.waitFor(() => expect(onTileReady).toHaveBeenCalled())
    expect(manager.getReadyTiles()).toHaveLength(1)
    expect(manager.getReadyTiles()[0].tileID).toEqual(FAKE_TILE)
    expect(manager.getReadyTiles()[0].imageBitmap).toBe(fakeBitmap)
  })

  it('getReadyTiles() does not return tiles outside the current visible set', async () => {
    const fakeBitmap = { close: vi.fn() } as unknown as ImageBitmap
    const tileService: TileService = {
      process: vi.fn().mockResolvedValue([fakeBitmap]),
    }
    const projection = makeProjection([FAKE_TILE])
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
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
    const fakeBitmap = { close: vi.fn() } as unknown as ImageBitmap
    const tileService: TileService = {
      process: vi.fn().mockResolvedValue([fakeBitmap]),
    }
    const projection = makeProjection([FAKE_TILE])
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
    )

    manager.update(CAMERA, VIEWPORT)
    await vi.waitFor(() => expect(onTileReady).toHaveBeenCalled())
  })

  it('destroy() cancels all in-flight requests', () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort')
    const projection = makeProjection([FAKE_TILE, FAKE_TILE_2])
    const tileService = makeTileService()
    const onTileReady = vi.fn()
    const manager = new TileManager(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService,
      projection,
      onTileReady,
    )

    manager.update(CAMERA, VIEWPORT)
    manager.destroy()

    expect(abortSpy).toHaveBeenCalled()
    abortSpy.mockRestore()
  })
})
