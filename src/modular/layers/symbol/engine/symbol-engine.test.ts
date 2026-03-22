import { describe, it, expect, vi } from 'vitest'
import { SymbolEngine } from '@modular/layers/symbol/engine/symbol-engine.ts'

function mockRenderer() {
  return {
    addRenderExtension: vi.fn(),
    removeRenderExtension: vi.fn(),
    getLayerOrder: vi.fn(() => ['layer-a', 'layer-b']),
  }
}

function mockLayer(id: string) {
  return {
    id,
    getCollisionData: vi.fn(() => []),
    setLabelOpacity: vi.fn(),
    getLabelData: vi.fn(() => new Map()),
  }
}

describe('SymbolEngine', () => {
  it('registers a RenderExtension on first register()', () => {
    const renderer = mockRenderer()
    const engine = new SymbolEngine(renderer as any)
    engine.register(mockLayer('a') as any)
    expect(renderer.addRenderExtension).toHaveBeenCalledOnce()
  })

  it('does not add duplicate RenderExtension on second register()', () => {
    const renderer = mockRenderer()
    const engine = new SymbolEngine(renderer as any)
    engine.register(mockLayer('a') as any)
    engine.register(mockLayer('b') as any)
    expect(renderer.addRenderExtension).toHaveBeenCalledOnce()
  })

  it('removes RenderExtension when last layer unregisters', () => {
    const renderer = mockRenderer()
    const engine = new SymbolEngine(renderer as any)
    const a = mockLayer('a')
    const b = mockLayer('b')
    engine.register(a as any)
    engine.register(b as any)
    engine.unregister(a as any)
    expect(renderer.removeRenderExtension).not.toHaveBeenCalled()
    engine.unregister(b as any)
    expect(renderer.removeRenderExtension).toHaveBeenCalledOnce()
  })

  it('exposes layout and resources properties', () => {
    const renderer = mockRenderer()
    const engine = new SymbolEngine(renderer as any)
    expect(engine.layout).toBeDefined()
    expect(engine.resources).toBeDefined()
  })
})
