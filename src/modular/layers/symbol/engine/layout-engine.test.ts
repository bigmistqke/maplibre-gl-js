// src/modular/layers/symbol/engine/layout-engine.test.ts
import { describe, it, expect, vi } from 'vitest'
import { LayoutEngine } from '@modular/layers/symbol/engine/layout-engine.ts'
import type { CollisionData } from '@modular/layers/symbol/base/types.ts'

function mockLayer(collisionData: CollisionData[]) {
  return {
    getCollisionData: vi.fn(() => collisionData),
    setLabelOpacity: vi.fn(),
  }
}

function mockRenderContext() {
  const gl = {
    canvas: { width: 800, height: 600 },
  } as unknown as WebGLRenderingContext
  return {
    gl,
    programs: new Map(),
    camera: { center: { lng: 0, lat: 0 }, zoom: 2, bearing: 0, pitch: 0 },
    visibleTiles: [],
    frameIndex: 0,
  }
}

describe('LayoutEngine', () => {
  it('places non-overlapping labels with opacity 1', () => {
    const engine = new LayoutEngine()
    const layer = mockLayer([{
      tileKey: '2/1/1',
      anchors: [{ x: 100, y: 100 }, { x: 500, y: 500 }],
      boxes: [[80, 90, 120, 110], [480, 490, 520, 510]],
      crossTileIDs: [0, 0],
    }])

    engine.runPlacement(mockRenderContext() as any, [layer])

    expect(layer.setLabelOpacity).toHaveBeenCalledOnce()
    const opacity = layer.setLabelOpacity.mock.calls[0][1] as Float32Array
    expect(opacity[0]).toBe(1)
    expect(opacity[1]).toBe(1)
  })

  it('hides overlapping labels with opacity 0', () => {
    const engine = new LayoutEngine()
    const layer = mockLayer([{
      tileKey: '2/1/1',
      anchors: [{ x: 100, y: 100 }, { x: 105, y: 100 }],
      boxes: [[50, 80, 150, 120], [55, 80, 155, 120]],
      crossTileIDs: [0, 0],
    }])

    engine.runPlacement(mockRenderContext() as any, [layer])

    const opacity = layer.setLabelOpacity.mock.calls[0][1] as Float32Array
    expect(opacity[0]).toBe(1)
    expect(opacity[1]).toBe(0)
  })

  it('cross-layer collision: later layer has priority', () => {
    const engine = new LayoutEngine()
    const highPriority = mockLayer([{
      tileKey: '2/1/1',
      anchors: [{ x: 100, y: 100 }],
      boxes: [[50, 80, 150, 120]],
      crossTileIDs: [0],
    }])
    const lowPriority = mockLayer([{
      tileKey: '2/1/1',
      anchors: [{ x: 100, y: 100 }],
      boxes: [[50, 80, 150, 120]],
      crossTileIDs: [0],
    }])

    // highPriority first = gets placed first = wins collision
    engine.runPlacement(mockRenderContext() as any, [highPriority, lowPriority])

    const highOp = highPriority.setLabelOpacity.mock.calls[0][1] as Float32Array
    const lowOp = lowPriority.setLabelOpacity.mock.calls[0][1] as Float32Array
    expect(highOp[0]).toBe(1)
    expect(lowOp[0]).toBe(0)
  })

  it('handles layers with no collision data', () => {
    const engine = new LayoutEngine()
    const layer = mockLayer([])
    engine.runPlacement(mockRenderContext() as any, [layer])
    expect(layer.setLabelOpacity).not.toHaveBeenCalled()
  })

  it('skips labels with already-seen crossTileIDs', () => {
    const engine = new LayoutEngine()
    const layer = mockLayer([
      {
        tileKey: '5/10/10',
        anchors: [{ x: 100, y: 100 }],
        boxes: [[80, 80, 120, 120]],
        crossTileIDs: [42],
      },
      {
        tileKey: '5/11/10',
        anchors: [{ x: 100, y: 100 }],
        boxes: [[80, 80, 120, 120]],
        crossTileIDs: [42],  // same crossTileID as first tile
      },
    ])

    engine.runPlacement(mockRenderContext() as any, [layer])

    // First tile's label placed
    const op1 = layer.setLabelOpacity.mock.calls[0][1] as Float32Array
    expect(op1[0]).toBe(1)

    // Second tile's label skipped (duplicate crossTileID)
    const op2 = layer.setLabelOpacity.mock.calls[1][1] as Float32Array
    expect(op2[0]).toBe(0)
  })
})
