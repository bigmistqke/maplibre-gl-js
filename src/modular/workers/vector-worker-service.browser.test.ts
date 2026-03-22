// src/modular/workers/vector-worker-service.browser.test.ts
//
// Tile requests go to the Vite test server (/__test-tiles__/*) which is
// the same origin for both the main thread and the spawned Web Worker.
// No MSW needed — same-origin requests work without any interception layer.

import { describe, it, expect } from 'vitest'
import { WorkerVectorTileService } from '@modular/layers/vector-worker-service.ts'
import type { TileID } from '@modular/core/types.ts'

const FAKE_TILE: TileID = { z: 10, x: 1, y: 2, key: '10/1/2' }
const TILE_BASE = `${location.origin}/__test-tiles__`

describe('WorkerVectorTileService (browser)', () => {
  it('request() returns an ArrayBuffer for a valid PBF URL', async () => {
    const service = new WorkerVectorTileService()
    const result = await service.request(FAKE_TILE, `${TILE_BASE}/10/1/2.pbf`)
    expect(result).toHaveLength(1)
    expect(result[0]).toBeInstanceOf(ArrayBuffer)
    service.destroy()
  })

  it('request() returns [] for a failed fetch (HTTP 500)', async () => {
    const service = new WorkerVectorTileService()
    const result = await service.request(FAKE_TILE, `${TILE_BASE}/error/0/0.pbf`)
    expect(result).toHaveLength(0)
    service.destroy()
  })

  it('cancel() before result resolves returns []', async () => {
    const service = new WorkerVectorTileService()
    const promise = service.request(FAKE_TILE, `${TILE_BASE}/10/1/2.pbf`)
    service.cancel(FAKE_TILE.key)
    expect(await promise).toHaveLength(0)
    service.destroy()
  })

  it('destroy() does not throw', () => {
    expect(() => new WorkerVectorTileService().destroy()).not.toThrow()
  })
})
