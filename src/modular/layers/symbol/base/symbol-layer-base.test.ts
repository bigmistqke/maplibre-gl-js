import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SymbolLayerBase, type SymbolLayerOptions } from '@modular/layers/symbol/base/symbol-layer-base.ts'
import { TileFetcher } from '@modular/layers/symbol/base/tile-fetcher.ts'
import type { CollisionData, GPUBucket } from '@modular/layers/symbol/base/types.ts'
import type { DrawContext, RenderContext } from '@modular/core/render-extension.ts'
import type { RendererAPI } from '@modular/core/renderer-api.ts'

// ── Concrete test subclass ───────────────────────────────────────────

type TestData = { vertices: number[] }

class TestSymbolLayer extends SymbolLayerBase<TestData> {
  readonly extent = 4096

  uploadBucket(_gl: WebGLRenderingContext, _key: string, _data: TestData): GPUBucket {
    return { verts: {} as WebGLBuffer, idx: {} as WebGLBuffer, count: 6 }
  }

  drawTile(_gl: WebGLRenderingContext, _program: WebGLProgram, _bucket: GPUBucket, _ctx: DrawContext): void {
    // stub
  }

  getCollisionData(_ctx: RenderContext, _visibleKeys: ReadonlySet<string>): CollisionData[] {
    return []
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function createMockRenderer(): RendererAPI {
  return {
    gl: {
      STENCIL_TEST: 0x0B90,
      BLEND: 0x0BE2,
      ONE: 1,
      ONE_MINUS_SRC_ALPHA: 0x0303,
      useProgram: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      blendFunc: vi.fn(),
    } as unknown as WebGLRenderingContext,
    camera: { center: { lng: 0, lat: 0 }, zoom: 2, bearing: 0, pitch: 0, groundElevation: 0 },
    markDirty: vi.fn(),
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

function createTileFetcher(): TileFetcher<TestData> {
  return new TileFetcher<TestData>({
    fetch: async (_key, _data) => ({ vertices: [1, 2, 3] }),
    onReady: vi.fn(),
  })
}

function createLayer(opts?: Partial<SymbolLayerOptions>): TestSymbolLayer {
  const fetcher = createTileFetcher()
  return new TestSymbolLayer(fetcher, {
    source: 'test-source',
    sourceLayer: 'test-layer',
    id: 'test-symbol',
    ...opts,
  })
}

// ── Tests ────────────────────────────────────────────────────────────

describe('SymbolLayerBase', () => {
  let renderer: RendererAPI

  beforeEach(() => {
    renderer = createMockRenderer()
  })

  it('onAdd creates a SymbolEngine and calls addRenderExtension', () => {
    const layer = createLayer()
    layer.onAdd(renderer)

    expect(renderer.addRenderExtension).toHaveBeenCalledTimes(1)
    expect(renderer.addRenderExtension).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'symbol-engine' }),
    )
  })

  it('two layers on the same renderer share the same engine (one addRenderExtension call)', () => {
    const layer1 = createLayer({ id: 'layer-1' })
    const layer2 = createLayer({ id: 'layer-2' })

    layer1.onAdd(renderer)
    layer2.onAdd(renderer)

    // SymbolEngine only registers extension once
    expect(renderer.addRenderExtension).toHaveBeenCalledTimes(1)
  })

  it('setLabelOpacity stores opacity and calls markDirty', () => {
    const layer = createLayer()
    layer.onAdd(renderer)

    const opacity = new Float32Array([1, 0, 1])
    layer.setLabelOpacity('2/1/1', opacity)

    // Access via protected field for verification
    expect((layer as any)._labelOpacity.get('2/1/1')).toBe(opacity)
    expect(renderer.markDirty).toHaveBeenCalled()
  })

  it('onRemove unregisters from engine', () => {
    const layer = createLayer()
    layer.onAdd(renderer)

    layer.onRemove()

    expect((layer as any)._engine).toBeNull()
    expect((layer as any)._renderer).toBeNull()
  })

  it('evictTile clears all state for that tile', () => {
    const layer = createLayer()
    layer.onAdd(renderer)

    const key = '2/1/1'

    // Populate some state
    ;(layer as any)._tileBuckets.set(key, { verts: {}, idx: {}, count: 3 })
    ;(layer as any)._pendingUploads.set(key, { vertices: [1] })
    layer.setLabelOpacity(key, new Float32Array([1]))

    layer.evictTile(key)

    expect((layer as any)._tileBuckets.has(key)).toBe(false)
    expect((layer as any)._pendingUploads.has(key)).toBe(false)
    expect((layer as any)._labelOpacity.has(key)).toBe(false)
  })

  it('has correct type and source properties', () => {
    const layer = createLayer()
    expect(layer.type).toBe('symbol')
    expect(layer.source).toBe('test-source')
    expect(layer.sourceLayer).toBe('test-layer')
    expect(layer.id).toBe('test-symbol')
  })

  it('_projectToScreen converts tile positions to screen coords', () => {
    const layer = createLayer()
    layer.onAdd(renderer)

    const camera = { center: { lng: 0, lat: 0 }, zoom: 2, bearing: 0, pitch: 0, groundElevation: 0 }
    const positions = [{ x: 2048, y: 2048 }]  // center of tile extent

    const result = (layer as any)._projectToScreen(positions, '2/2/2', camera, 800, 600)

    expect(result).toHaveLength(1)
    expect(typeof result[0].x).toBe('number')
    expect(typeof result[0].y).toBe('number')
    // At zoom 2, tile 2/2/2 center should project somewhere reasonable
    expect(isNaN(result[0].x)).toBe(false)
    expect(isNaN(result[0].y)).toBe(false)
  })

  it('_projectToScreen returns empty for invalid tile key', () => {
    const layer = createLayer()
    layer.onAdd(renderer)

    const camera = { center: { lng: 0, lat: 0 }, zoom: 2, bearing: 0, pitch: 0, groundElevation: 0 }
    const result = (layer as any)._projectToScreen([{ x: 0, y: 0 }], 'invalid', camera, 800, 600)

    expect(result).toEqual([])
  })
})
