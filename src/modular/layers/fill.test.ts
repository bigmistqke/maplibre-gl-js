import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VectorTileService, FillLayer, tessellatePolygon } from '@modular/layers/fill'
import type { TileID } from '@modular/core/types'
import type { DrawContext } from '@modular/core/render-extension'

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

function makeGLForFill() {
  return {
    createBuffer: vi.fn().mockReturnValue({}),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getAttribLocation: vi.fn().mockReturnValue(0),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    useProgram: vi.fn(),
    getUniformLocation: vi.fn().mockReturnValue({}),
    uniformMatrix4fv: vi.fn(),
    uniform4f: vi.fn(),
    drawElements: vi.fn(),
    ARRAY_BUFFER: 34962,
    ELEMENT_ARRAY_BUFFER: 34963,
    STATIC_DRAW: 35044,
    FLOAT: 5126,
    TRIANGLES: 4,
    UNSIGNED_SHORT: 5123,
  } as unknown as WebGLRenderingContext
}

describe('tessellatePolygon', () => {
  it('returns 6 indices for a unit square', () => {
    const rings = [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]]
    const { vertices, indices } = tessellatePolygon(rings)
    expect(vertices).toBeInstanceOf(Float32Array)
    expect(indices).toBeInstanceOf(Uint32Array)
    expect(indices.length).toBe(6)
  })

  it('returns 3 indices for a triangle', () => {
    const rings = [[{ x: 0, y: 0 }, { x: 4096, y: 0 }, { x: 2048, y: 4096 }]]
    expect(tessellatePolygon(rings).indices.length).toBe(3)
  })
})

describe('FillLayer', () => {
  it('has type "fill"', () => {
    expect(new FillLayer({ source: 'mvt', sourceLayer: 'water' }).type).toBe('fill')
  })

  it('has static programs with a "fill" entry', () => {
    expect(FillLayer.programs[0].name).toBe('fill')
  })

  it('has static TileService pointing to VectorTileService', () => {
    expect(FillLayer.TileService).toBe(VectorTileService)
  })

  it('draw() with no tileData does nothing', () => {
    const gl = makeGLForFill()
    const layer = new FillLayer({ source: 'mvt', sourceLayer: 'water' })
    layer.onAdd({ _webgl: { createGeometryBuffer: vi.fn() } } as any)
    layer.draw({ gl, programs: { get: vi.fn().mockReturnValue({}) }, tileID: { z:0,x:0,y:0,key:'0/0/0' }, meshBuffers: { vert: {} as WebGLBuffer, idx: {} as WebGLBuffer, indexCount: 6 }, zoom: 0, paint: {}, frameIndex: 0, imageAtlas: {}, lineDashAtlas: {}, tileData: undefined } as any)
    expect(gl.drawElements).not.toHaveBeenCalled()
  })

  it('draw() calls gl.drawElements for valid PBF data', () => {
    vi.mock('@mapbox/vector-tile', () => ({
      VectorTile: class {
        layers = { water: { length: 1, feature: () => ({ type: 3, loadGeometry: () => [[{ x:0,y:0 }, { x:4096,y:0 }, { x:4096,y:4096 }, { x:0,y:4096 }]] }) } }
      }
    }))
    const gl = makeGLForFill()
    const fakeRenderer = { createGeometryBuffer: vi.fn().mockReturnValue({}) }
    const layer = new FillLayer({ source: 'mvt', sourceLayer: 'water' })
    layer.onAdd(fakeRenderer as any)
    layer.draw({ gl, programs: { get: vi.fn().mockReturnValue({}) }, tileID: { z:10,x:1,y:2,key:'10/1/2' }, meshBuffers: { vert: {} as WebGLBuffer, idx: {} as WebGLBuffer, indexCount: 6 }, zoom: 10, paint: { 'fill-color': '#0000ff' }, frameIndex: 0, imageAtlas: {}, lineDashAtlas: {}, tileData: new ArrayBuffer(1) } as any)
    expect(gl.drawElements).toHaveBeenCalled()
  })
})
