import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BackgroundLayer } from './background.ts'

function makeGL() {
  return {
    COLOR_BUFFER_BIT: 16384,
    clearColor: vi.fn(),
    clear: vi.fn(),
  } as unknown as WebGLRenderingContext
}

describe('BackgroundLayer', () => {
  it('has type "background"', () => {
    const layer = new BackgroundLayer({ color: '#ff0000' })
    expect(layer.type).toBe('background')
  })

  it('has no static programs (uses clearColor, not shaders)', () => {
    expect(BackgroundLayer.programs).toHaveLength(0)
  })

  it('has no TileService', () => {
    expect(BackgroundLayer.TileService).toBeUndefined()
  })

  it('drawBackground calls gl.clearColor with parsed RGBA', () => {
    const gl = makeGL()
    const layer = new BackgroundLayer({ color: '#ff0000', opacity: 1 })
    layer.drawBackground({ gl, paint: { color: '#ff0000', opacity: 1 } })
    expect(gl.clearColor).toHaveBeenCalledWith(1, 0, 0, 1)
    expect(gl.clear).toHaveBeenCalledWith(gl.COLOR_BUFFER_BIT)
  })

  it('drawBackground applies opacity to alpha channel', () => {
    const gl = makeGL()
    const layer = new BackgroundLayer({ color: '#ffffff', opacity: 0.5 })
    layer.drawBackground({ gl, paint: { color: '#ffffff', opacity: 0.5 } })
    const [, , , a] = (gl.clearColor as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(a).toBeCloseTo(0.5)
  })

  it('defaults color to black and opacity to 1', () => {
    const layer = new BackgroundLayer({})
    expect(layer.color).toBe('#000000')
    expect(layer.opacity).toBe(1)
  })
})
