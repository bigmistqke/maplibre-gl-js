// src/modular/workers/raster-worker-service.browser.test.ts
//
// Tile requests go to the Vite test server (/__test-tiles__/*) which is
// the same origin for both the main thread and the spawned Web Worker.
// No MSW needed — same-origin requests work without any interception layer.

import { describe, it, expect } from 'vitest'
import { WorkerRasterTileService } from '@modular/layers/raster-worker-service.ts'
import type { TileID } from '@modular/core/types.ts'

const FAKE_TILE: TileID = { z: 10, x: 1, y: 2, key: '10/1/2' }
const TILE_BASE = `${location.origin}/__test-tiles__`

describe('WorkerRasterTileService (browser)', () => {
  it('request() returns an ImageBitmap for a valid tile URL', async () => {
    const service = new WorkerRasterTileService()
    const result = await service.request(FAKE_TILE, `${TILE_BASE}/10/1/2.png`)
    expect(result).toHaveLength(1)
    expect(result[0]).toBeInstanceOf(ImageBitmap)
    service.destroy()
  })

  it('request() returns [] for a failed fetch (HTTP 500)', async () => {
    const service = new WorkerRasterTileService()
    const result = await service.request(FAKE_TILE, `${TILE_BASE}/error/0/0.png`)
    expect(result).toHaveLength(0)
    service.destroy()
  })

  it('cancel() before result resolves returns []', async () => {
    const service = new WorkerRasterTileService()
    const promise = service.request(FAKE_TILE, `${TILE_BASE}/10/1/2.png`)
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
