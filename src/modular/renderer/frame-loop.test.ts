import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FrameLoop } from '@modular/renderer/frame-loop.ts'

describe('FrameLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(cb, 16))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not call render until markDirty', () => {
    const render = vi.fn()
    const loop = new FrameLoop(render)
    loop.start()
    vi.runAllTimers()
    expect(render).not.toHaveBeenCalled()
    loop.stop()
  })

  it('calls render after markDirty', () => {
    const render = vi.fn()
    const loop = new FrameLoop(render)
    loop.start()
    loop.markDirty()
    vi.runAllTimers()
    expect(render).toHaveBeenCalledOnce()
    loop.stop()
  })

  it('calls render only once for multiple markDirty before next frame', () => {
    const render = vi.fn()
    const loop = new FrameLoop(render)
    loop.start()
    loop.markDirty()
    loop.markDirty()
    loop.markDirty()
    vi.runAllTimers()
    expect(render).toHaveBeenCalledOnce()
    loop.stop()
  })

  it('does not render after stop', () => {
    const render = vi.fn()
    const loop = new FrameLoop(render)
    loop.start()
    loop.markDirty()
    loop.stop()
    vi.runAllTimers()
    expect(render).not.toHaveBeenCalled()
  })
})
