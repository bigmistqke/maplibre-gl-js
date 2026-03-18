import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Renderer } from './renderer.ts'
import { BackgroundLayer } from '../layers/background.ts'

function makeCanvas() {
  const gl = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    LINK_STATUS: 35714,
    COMPILE_STATUS: 35713,
    COLOR_BUFFER_BIT: 16384,
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
    renderer = new Renderer(canvas)
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
