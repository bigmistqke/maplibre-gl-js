import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VectorTileService } from './fill'
import type { TileID } from '../core/types'

const FAKE_TILE: TileID = { z: 10, x: 1, y: 2, key: '10/1/2' }
const FAKE_URL = 'https://tiles.example.com/10/1/2.pbf'

describe('VectorTileService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(42)),
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('request() returns [ArrayBuffer] on success', async () => {
    const result = await new VectorTileService().request(FAKE_TILE, FAKE_URL)
    expect(result).toHaveLength(1)
    expect(result[0]).toBeInstanceOf(ArrayBuffer)
  })

  it('request() returns [] when fetch fails (HTTP 404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const result = await new VectorTileService().request(FAKE_TILE, FAKE_URL)
    expect(result).toHaveLength(0)
  })

  it('request() returns [] when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const result = await new VectorTileService().request(FAKE_TILE, FAKE_URL)
    expect(result).toHaveLength(0)
  })

  it('cancel() causes request() to return []', async () => {
    let resolve!: (v: any) => void
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(r => { resolve = r })))
    const service = new VectorTileService()
    const promise = service.request(FAKE_TILE, FAKE_URL)
    service.cancel(FAKE_TILE.key)
    resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(42)) })
    expect(await promise).toHaveLength(0)
  })

  it('destroy() aborts all in-flight requests', async () => {
    let resolve!: (v: any) => void
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(r => { resolve = r })))
    const service = new VectorTileService()
    const promise = service.request(FAKE_TILE, FAKE_URL)
    service.destroy()
    resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(42)) })
    expect(await promise).toHaveLength(0)
  })
})
