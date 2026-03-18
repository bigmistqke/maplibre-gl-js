import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Renderer } from './renderer.ts'
import { BackgroundLayer } from '../layers/background.ts'
import { RasterLayer } from '../layers/raster.ts'

function makeCanvas() {
  const gl = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    LINK_STATUS: 35714,
    COMPILE_STATUS: 35713,
    COLOR_BUFFER_BIT: 16384,
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
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
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    createBuffer: vi.fn().mockReturnValue({ _buf: true }),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
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
      getVisibleTiles: vi.fn().mockReturnValue([]),
      getTileMatrix: vi.fn().mockReturnValue(new Float32Array(16)),
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

  function makeProjection(tiles = [{ z: 10, x: 528, y: 341, key: '10/528/341' }]) {
    return {
      getVisibleTiles: vi.fn().mockReturnValue(tiles),
      getTileMatrix: vi.fn().mockReturnValue(new Float32Array(16)),
    }
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
    })
    // Verify internal state — TileManager should exist for 'osm'
    expect((renderer as any)._tileManagers.has('osm')).toBe(true)
  })

  it('addLayer with source field is associated with TileManager for that source', () => {
    renderer.addSource('osm', {
      type: 'raster',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
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
