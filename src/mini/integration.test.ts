import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRenderer } from './renderer/index.ts'
import { MapGL } from './core/map.ts'
import { BackgroundLayer } from './layers/background.ts'

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
  return { getContext: vi.fn().mockReturnValue(gl), width: 512, height: 512 } as unknown as HTMLCanvasElement
}

describe('Phase 1 integration', () => {
  let canvas: ReturnType<typeof makeCanvas>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(cb, 16))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
    canvas = makeCanvas()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('createRenderer returns a RendererAPI with addLayer and setCamera', async () => {
    const renderer = await createRenderer(canvas)
    const layer = new BackgroundLayer({ color: '#ffffff', opacity: 1 })
    expect(() => renderer.addLayer(layer)).not.toThrow()
    const map = new MapGL({ renderer })
    expect(() => map.setCamera({ center: { lng: 0, lat: 0 }, zoom: 1 })).not.toThrow()
  })

  it('MapGL renders a background color frame — drawBackground is called with paint props', async () => {
    const renderer = await createRenderer(canvas)
    const map = new MapGL({ renderer })

    const layer = new BackgroundLayer({ color: '#ff0000', opacity: 1 })
    const drawBackground = vi.spyOn(layer, 'drawBackground')
    map.addLayer(layer)

    await vi.advanceTimersByTimeAsync(16)

    expect(drawBackground).toHaveBeenCalledOnce()
    const [ctx] = drawBackground.mock.calls[0]!
    expect(ctx.paint).toBeDefined()
    expect(ctx.paint.color).toBe('#ff0000')
    expect(ctx.paint.opacity).toBe(1)
  })

  it('setCamera propagates from MapGL to Renderer', async () => {
    const renderer = await createRenderer(canvas)
    const map = new MapGL({ renderer })

    const setCameraSpy = vi.spyOn(renderer, 'setCamera')
    map.setCamera({ center: { lng: 10, lat: 20 }, zoom: 7 })

    expect(setCameraSpy).toHaveBeenCalledOnce()
    const [state] = setCameraSpy.mock.calls[0]!
    expect(state.zoom).toBe(7)
  })

  it('addPlugin wires ElevationProvider and RenderExtension', async () => {
    const renderer = await createRenderer(canvas)
    const map = new MapGL({ renderer })

    const addRenderExtensionSpy = vi.spyOn(renderer, 'addRenderExtension')

    const ext = { id: 'terrain-ext', beforeTiles: vi.fn(), afterTiles: vi.fn() }
    const plugin = {
      getElevation: vi.fn().mockReturnValue(42),
      renderExtension: ext,
    }

    map.addPlugin(plugin)

    // RenderExtension should be forwarded to renderer
    expect(addRenderExtensionSpy).toHaveBeenCalledWith(ext)

    // ElevationProvider should affect groundElevation in camera state
    map.setCamera({ center: { lng: 5, lat: 5 } })
    expect(map.getCamera().groundElevation).toBe(42)
  })
})
