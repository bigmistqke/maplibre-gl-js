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
    STENCIL_BUFFER_BIT: 1024,
    ARRAY_BUFFER: 34962,
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
    ELEMENT_ARRAY_BUFFER: 34963,
    UNSIGNED_SHORT: 5123,
    TRIANGLES: 4,
    drawElements: vi.fn(),
    deleteProgram: vi.fn(),
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
