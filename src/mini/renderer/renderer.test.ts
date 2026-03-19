import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Renderer } from './renderer.ts'
import { BackgroundLayer } from '../layers/background.ts'
import { RasterLayer } from '../layers/raster.ts'
import type { TileService } from '../core/tile-service.ts'

function makeFakeTileService(): TileService {
  return {
    request: vi.fn().mockResolvedValue([]),
    cancel: vi.fn(),
    destroy: vi.fn(),
  }
}

function makeCanvas() {
  const gl = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    LINK_STATUS: 35714,
    COMPILE_STATUS: 35713,
    COLOR_BUFFER_BIT: 16384,
    STENCIL_BUFFER_BIT: 1024,
    ARRAY_BUFFER: 34962,
    ELEMENT_ARRAY_BUFFER: 34963,
    STATIC_DRAW: 35044,
    FLOAT: 5126,
    TRIANGLE_STRIP: 5,
    ALWAYS: 519,
    EQUAL: 514,
    KEEP: 7680,
    REPLACE: 7681,
    STENCIL_TEST: 2960,
    createProgram: vi.fn(() => ({})),
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getShaderParameter: vi.fn().mockReturnValue(true),
    getProgramParameter: vi.fn().mockReturnValue(true),
    getProgramInfoLog: vi.fn().mockReturnValue(''),
    getShaderInfoLog: vi.fn().mockReturnValue(''),
    getAttribLocation: vi.fn().mockReturnValue(0),
    getUniformLocation: vi.fn().mockReturnValue({}),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    uniformMatrix4fv: vi.fn(),
    useProgram: vi.fn(),
    drawArrays: vi.fn(),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    stencilFunc: vi.fn(),
    stencilOp: vi.fn(),
    stencilMask: vi.fn(),
    colorMask: vi.fn(),
    createBuffer: vi.fn().mockReturnValue({ _buf: true }),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    UNSIGNED_SHORT: 5123,
    TRIANGLES: 4,
    drawElements: vi.fn(),
    deleteProgram: vi.fn(),
  } as unknown as WebGLRenderingContext
  return { getContext: vi.fn().mockReturnValue(gl), width: 512, height: 512, _gl: gl } as any
}

describe('Renderer', () => {
  let canvas: ReturnType<typeof makeCanvas>
  let renderer: Renderer

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(cb, 16))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
    canvas = makeCanvas()
    renderer = new Renderer(canvas, {
      vertexShaderPrelude: 'vec4 projectTile(vec2 p){return vec4(p,0.0,1.0);}',
      getVisibleTiles: vi.fn().mockReturnValue([]),
      setTileUniforms: vi.fn(),
      getMeshForTile: vi.fn().mockReturnValue({
        vertices: new Float32Array([0,0,4096,0,0,4096,4096,4096]),
        indices: new Uint16Array([0,1,2,1,3,2]),
      }),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('addLayer registers the layer', () => {
    const layer = new BackgroundLayer({ color: '#ff0000' })
    renderer.addLayer(layer)
    expect(renderer.getLayers()).toContain(layer)
  })

  it('removeLayer unregisters the layer', () => {
    const layer = Object.assign(new BackgroundLayer({ color: '#ff0000' }), { id: 'bg' })
    renderer.addLayer(layer)
    renderer.removeLayer('bg')
    expect(renderer.getLayers()).not.toContain(layer)
  })

  it('addLayer calls onAdd if present', () => {
    const onAdd = vi.fn()
    const layer = Object.assign(new BackgroundLayer({ color: '#ff0000' }), { onAdd })
    renderer.addLayer(layer)
    expect(onAdd).toHaveBeenCalledWith(renderer)
  })

  it('renderFrame calls drawBackground on BackgroundLayer', () => {
    const layer = new BackgroundLayer({ color: '#00ff00' })
    const drawBackground = vi.spyOn(layer, 'drawBackground')
    renderer.addLayer(layer)
    renderer.renderFrame()
    expect(drawBackground).toHaveBeenCalledOnce()
  })

  it('renderFrame runs beforeTiles/afterTiles from render extensions', () => {
    const order: string[] = []
    renderer.addRenderExtension({ id: 'a', beforeTiles: () => order.push('before'), afterTiles: () => order.push('after') })
    renderer.renderFrame()
    expect(order).toEqual(['before', 'after'])
  })

  it('setCamera marks the frame dirty', () => {
    const markDirty = vi.spyOn((renderer as any)._frameLoop, 'markDirty')
    renderer.setCamera({ center: { lng: 0, lat: 0 }, zoom: 5, bearing: 0, pitch: 0, groundElevation: 0 })
    expect(markDirty).toHaveBeenCalled()
  })

  it('queryRenderedFeatures returns empty array (phase 1 stub)', () => {
    expect(renderer.queryRenderedFeatures({ x: 100, y: 100 })).toEqual([])
  })

  it('calls destroyTexture when TileManager evicts a tile', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }))

    const webgl = (renderer as any)._webgl
    const destroySpy = vi.spyOn(webgl, 'destroyTexture')

    renderer.addSource('osm', { type: 'raster', url: 'https://t/{z}/{x}/{y}.png', tileService: makeFakeTileService() })

    const tm = (renderer as any)._tileManagers.get('osm')
    const tiles = tm._tiles as Map<string, unknown>
    // Canvas is 512×512 → updateCacheSize gives (2+1)*(2+1)*5 = 45.
    // Inject 51 tiles so eviction fires even after updateCacheSize recomputes the limit.
    for (let i = 0; i < 51; i++) {
      tiles.set(`tile-${i}`, {
        status: 'ready',
        imageBitmap: { close: vi.fn() },
        controller: new AbortController(),
      })
    }

    renderer.setCamera({
      center: { lng: 0, lat: 0 },
      zoom: 0,
      bearing: 0,
      pitch: 0,
      groundElevation: 0,
    })
    // setCamera → updateCacheSize (sets _maxCacheSize=45) → update → _evict fires (51 > 45)

    expect(destroySpy).toHaveBeenCalled()

    vi.unstubAllGlobals()
  })
})

function makeProjection(tiles = [{ z: 10, x: 528, y: 341, key: '10/528/341' }]) {
  return {
    vertexShaderPrelude: 'vec4 projectTile(vec2 p){return vec4(p,0.0,1.0);}',
    getVisibleTiles: vi.fn().mockReturnValue(tiles),
    setTileUniforms: vi.fn(),
    getMeshForTile: vi.fn().mockReturnValue({
      vertices: new Float32Array([0,0,4096,0,0,4096,4096,4096]),
      indices: new Uint16Array([0,1,2,1,3,2]),
    }),
  }
}

describe('Renderer — Phase 5 vector pipeline', () => {
  it('addSource with type "vector" creates a TileManager internally', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(cb, 16))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
    const renderer = new Renderer(makeCanvas(), makeProjection())
    renderer.addSource('mvt', {
      type: 'vector',
      url: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
      tileService: makeFakeTileService(),
    })
    expect((renderer as any)._tileManagers.has('mvt')).toBe(true)
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('renderFrame passes tileData (not tileTexture) to vector layer draw()', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(cb, 16))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))

    const fakeBuffer = new ArrayBuffer(100)
    const tileService = {
      request: vi.fn().mockResolvedValue([fakeBuffer]),
      cancel: vi.fn(),
      destroy: vi.fn(),
    }
    const renderer = new Renderer(makeCanvas(), makeProjection())
    renderer.addSource('mvt', { type: 'vector', url: 'https://t/{z}/{x}/{y}.pbf', tileService })
    const layer = { id: 'fill', type: 'fill', source: 'mvt', draw: vi.fn() }
    renderer.addLayer(layer as any)
    renderer.setCamera({ center: { lng: 0, lat: 0 }, zoom: 5, bearing: 0, pitch: 0, groundElevation: 0 })

    await vi.waitFor(() => {
      const tm = (renderer as any)._tileManagers.get('mvt')
      if (tm.getReadyTiles().length === 0) throw new Error('not ready')
    })
    renderer.renderFrame()

    expect(layer.draw).toHaveBeenCalled()
    const ctx = layer.draw.mock.calls[0][0]
    expect(ctx.tileData).toBe(fakeBuffer)
    expect(ctx.tileTexture).toBeUndefined()

    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
})

describe('Renderer — Phase 2 tile pipeline', () => {
  let canvas: ReturnType<typeof makeCanvas>
  let renderer: Renderer

  function makePhase2Canvas() {
    // Extend the base GL mock with texture + buffer methods needed for Phase 2
    const base = makeCanvas()
    const extraGL = {
      createBuffer: vi.fn().mockReturnValue({ _buf: true }),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      createTexture: vi.fn().mockReturnValue({ _tex: true }),
      bindTexture: vi.fn(),
      texImage2D: vi.fn(),
      texParameteri: vi.fn(),
      generateMipmap: vi.fn(),
      getAttribLocation: vi.fn().mockReturnValue(0),
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),
      useProgram: vi.fn(),
      getUniformLocation: vi.fn().mockReturnValue({}),
      uniformMatrix4fv: vi.fn(),
      uniform1i: vi.fn(),
      uniform1f: vi.fn(),
      activeTexture: vi.fn(),
      drawArrays: vi.fn(),
      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
      FLOAT: 5126,
      TRIANGLE_STRIP: 5,
      TEXTURE_2D: 3553,
      TEXTURE0: 33984,
      UNSIGNED_BYTE: 5121,
      RGBA: 6408,
      LINEAR: 9729,
      CLAMP_TO_EDGE: 33071,
      TEXTURE_MIN_FILTER: 10241,
      TEXTURE_MAG_FILTER: 10240,
      TEXTURE_WRAP_S: 10242,
      TEXTURE_WRAP_T: 10243,
    }
    Object.assign(base._gl, extraGL)
    return base
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(cb, 16))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }))
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }))
    canvas = makePhase2Canvas()
    renderer = new Renderer(canvas, makeProjection())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('addSource with type "raster" creates a TileManager internally', () => {
    renderer.addSource('osm', {
      type: 'raster',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileSize: 256,
      tileService: makeFakeTileService(),
    })
    // Verify internal state — TileManager should exist for 'osm'
    expect((renderer as any)._tileManagers.has('osm')).toBe(true)
  })

  it('addLayer with source field is associated with TileManager for that source', () => {
    renderer.addSource('osm', {
      type: 'raster',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService: makeFakeTileService(),
    })
    const layer = new RasterLayer({ source: 'osm' })
    renderer.addLayer(layer)
    const tileLayers = (renderer as any)._tileLayers as globalThis.Map<string, unknown[]>
    expect(tileLayers.has('osm')).toBe(true)
    expect(tileLayers.get('osm')).toContain(layer)
  })

  it('setCamera calls tileManager.update for each active TileManager', () => {
    renderer.addSource('osm', {
      type: 'raster',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService: makeFakeTileService(),
    })
    const tileManager = (renderer as any)._tileManagers.get('osm')
    const updateSpy = vi.spyOn(tileManager, 'update')
    renderer.setCamera({ center: { lng: 4.9, lat: 52.37 }, zoom: 10, bearing: 0, pitch: 0, groundElevation: 0 })
    expect(updateSpy).toHaveBeenCalled()
  })

  it('renderFrame calls layer.draw for each ready tile', async () => {
    // Set up a fake bitmap as though the tile is already ready
    const fakeBitmap = { close: vi.fn() } as unknown as ImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(fakeBitmap))

    renderer.addSource('osm', {
      type: 'raster',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileService: { request: vi.fn().mockResolvedValue([fakeBitmap]), cancel: vi.fn(), destroy: vi.fn() },
    })
    const layer = new RasterLayer({ source: 'osm' })
    const drawSpy = vi.spyOn(layer, 'draw')
    renderer.addLayer(layer)

    // Trigger camera update so TileManager fetches the tile
    renderer.setCamera({ center: { lng: 4.9, lat: 52.37 }, zoom: 10, bearing: 0, pitch: 0, groundElevation: 0 })

    // Wait for the fetch + process chain to complete
    await vi.waitFor(() => {
      const tm = (renderer as any)._tileManagers.get('osm')
      if (tm.getReadyTiles().length === 0) throw new Error('tiles not ready yet')
    })

    renderer.renderFrame()
    expect(drawSpy).toHaveBeenCalled()
  })
})
