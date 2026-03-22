import { describe, it, expect } from 'vitest'
import { StructArray } from '@modular/core/struct-array.ts'
import { SymbolBucketAdapter } from '@modular/layers/symbol/vendor/symbol_bucket_adapter.ts'

describe('SymbolBucketAdapter', () => {
  it('has all required StructArray fields', () => {
    const adapter = new SymbolBucketAdapter()
    expect(adapter.symbolInstances).toBeInstanceOf(StructArray)
    expect(adapter.text.placedSymbolArray).toBeInstanceOf(StructArray)
    expect(adapter.glyphOffsetArray).toBeInstanceOf(StructArray)
    expect(adapter.lineVertexArray).toBeInstanceOf(StructArray)
    expect(adapter.tilePixelRatio).toBe(8) // 4096 / 512
  })

  it('can emplaceBack into all arrays', () => {
    const adapter = new SymbolBucketAdapter()
    adapter.glyphOffsetArray.emplaceBack(42.5)
    adapter.lineVertexArray.emplaceBack(100, 200, 500)
    expect(adapter.glyphOffsetArray.length).toBe(1)
    expect(adapter.lineVertexArray.length).toBe(1)
  })

  it('has text and icon SymbolBuffers with all sub-arrays', () => {
    const adapter = new SymbolBucketAdapter()
    expect(adapter.text.placedSymbolArray).toBeInstanceOf(StructArray)
    expect(adapter.text.dynamicLayoutVertexArray).toBeInstanceOf(StructArray)
    expect(adapter.text.opacityVertexArray).toBeInstanceOf(StructArray)
    expect(adapter.icon.placedSymbolArray).toBeInstanceOf(StructArray)
    expect(adapter.icon.dynamicLayoutVertexArray).toBeInstanceOf(StructArray)
    expect(adapter.icon.opacityVertexArray).toBeInstanceOf(StructArray)
  })

  it('has collision box arrays', () => {
    const adapter = new SymbolBucketAdapter()
    expect(adapter.collisionBoxArray).toBeInstanceOf(StructArray)
    expect(adapter.textCollisionBox.collisionVertexArray).toBeInstanceOf(StructArray)
    expect(adapter.iconCollisionBox.collisionVertexArray).toBeInstanceOf(StructArray)
  })

  it('sets overscaling and tilePixelRatio correctly for custom overscaling', () => {
    const adapter = new SymbolBucketAdapter(2)
    expect(adapter.overscaling).toBe(2)
    expect(adapter.tilePixelRatio).toBe(4) // 4096 / (512 * 2)
  })

  it('has default textSizeData stub', () => {
    const adapter = new SymbolBucketAdapter()
    expect(adapter.textSizeData).toEqual({ kind: 'constant', layoutSize: 12 })
  })
})
