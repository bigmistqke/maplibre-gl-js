import { describe, it, expect } from 'vitest'
import { StructArray } from '../../../core/struct-array.ts'
import { SymbolLineVertexLayout, GlyphOffsetLayout, DynamicLayoutLayout } from './symbol_structs.ts'

describe('SymbolLineVertexLayout', () => {
  it('has stride 6 and correct fields', () => {
    expect(SymbolLineVertexLayout.stride).toBe(6)
    const arr = new StructArray(SymbolLineVertexLayout)
    arr.emplaceBack(100, 200, 500)
    expect(arr.getx(0)).toBe(100)
    expect(arr.gety(0)).toBe(200)
    expect(arr.gettileUnitDistanceFromAnchor(0)).toBe(500)
  })
})

describe('GlyphOffsetLayout', () => {
  it('has stride 4 and correct fields', () => {
    expect(GlyphOffsetLayout.stride).toBe(4)
    const arr = new StructArray(GlyphOffsetLayout)
    arr.emplaceBack(42.5)
    expect(arr.getoffsetX(0)).toBeCloseTo(42.5)
  })
})

describe('DynamicLayoutLayout', () => {
  it('has stride 12 and correct fields', () => {
    expect(DynamicLayoutLayout.stride).toBe(12)
    const arr = new StructArray(DynamicLayoutLayout)
    arr.emplaceBack(1.0, 2.0, 0.5)
    expect(arr.float32[0]).toBeCloseTo(1.0)
    expect(arr.float32[1]).toBeCloseTo(2.0)
    expect(arr.float32[2]).toBeCloseTo(0.5)
  })
})
