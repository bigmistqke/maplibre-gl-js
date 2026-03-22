import { describe, it, expect, vi } from 'vitest'
import { MapGL } from '@modular/core/map.ts'
import type { RendererAPI, LayerInstance } from '@modular/core/renderer-api.ts'

function makeRenderer(): RendererAPI {
  return {
    resize: vi.fn(),
    destroy: vi.fn(),
    addSource: vi.fn(),
    removeSource: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    setLayerPaint: vi.fn(),
    setLayerLayout: vi.fn(),
    setLayerVisibility: vi.fn(),
    setCamera: vi.fn(),
    addRenderExtension: vi.fn(),
    removeRenderExtension: vi.fn(),
    queryRenderedFeatures: vi.fn().mockReturnValue([]),
    setSurface: vi.fn(),
  }
}

describe('MapGL', () => {
  it('delegates addLayer to renderer', () => {
    const renderer = makeRenderer()
    const map = new MapGL({ renderer })
    const layer: LayerInstance = { type: 'background' }
    map.addLayer(layer)
    expect(renderer.addLayer).toHaveBeenCalledWith(layer, undefined)
  })

  it('delegates removeLayer to renderer', () => {
    const renderer = makeRenderer()
    const map = new MapGL({ renderer })
    map.removeLayer('bg')
    expect(renderer.removeLayer).toHaveBeenCalledWith('bg')
  })

  it('setCamera updates CameraController and forwards to renderer', () => {
    const renderer = makeRenderer()
    const map = new MapGL({ renderer })
    map.setCamera({ zoom: 8 })
    expect(map.getCamera().zoom).toBe(8)
    expect(renderer.setCamera).toHaveBeenCalledWith(expect.objectContaining({ zoom: 8 }))
  })

  it('getCamera returns current state synchronously', () => {
    const renderer = makeRenderer()
    const map = new MapGL({ renderer, initialCamera: { zoom: 5 } })
    expect(map.getCamera().zoom).toBe(5)
  })

  it('addPlugin with getElevation sets elevation provider', () => {
    const renderer = makeRenderer()
    const map = new MapGL({ renderer })
    const plugin = { getElevation: vi.fn().mockReturnValue(100) }
    map.addPlugin(plugin)
    map.setCamera({ center: { lng: 0, lat: 0 } })
    expect(map.getCamera().groundElevation).toBe(100)
  })

  it('addPlugin with renderExtension forwards to renderer', () => {
    const renderer = makeRenderer()
    const map = new MapGL({ renderer })
    const ext = { id: 'test-ext' }
    const plugin = { renderExtension: ext }
    map.addPlugin(plugin)
    expect(renderer.addRenderExtension).toHaveBeenCalledWith(ext)
  })

  it('on/off registers and removes event listeners', () => {
    const renderer = makeRenderer()
    const map = new MapGL({ renderer })
    const handler = vi.fn()
    map.on('move', handler)
    map.setCamera({ zoom: 3 })
    expect(handler).toHaveBeenCalledOnce()
    map.off('move', handler)
    map.setCamera({ zoom: 4 })
    expect(handler).toHaveBeenCalledOnce() // still just once
  })
})
