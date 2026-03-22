// src/modular/core/struct-array.test.ts
import { describe, it, expect } from 'vitest'
import { defineStruct, StructArray } from './struct-array.ts'

describe('defineStruct', () => {
  it('computes stride as sum of field byte sizes', () => {
    const s = defineStruct({ x: 'int16', y: 'int16' })
    expect(s.stride).toBe(4) // 2 + 2
  })

  it('computes byte offset of each field with alignment', () => {
    const s = defineStruct({ x: 'int16', y: 'float32', z: 'uint8' })
    expect(s.fields.x.offset).toBe(0)
    expect(s.fields.y.offset).toBe(4) // aligned to 4-byte boundary
    expect(s.fields.z.offset).toBe(8)
  })

  it('pads stride to align to largest member type', () => {
    const s = defineStruct({ x: 'int16', y: 'float32', z: 'uint8' })
    expect(s.stride).toBe(12) // 2 + 2pad + 4 + 1 + 3pad = 12 (multiple of 4)
  })

  it('pads stride to align to largest member type (int16+float32)', () => {
    const layout = defineStruct({ x: 'int16', y: 'int16', dist: 'float32' })
    expect(layout.stride).toBe(8)
  })
})

describe('StructArray', () => {
  it('starts empty', () => {
    const s = defineStruct({ x: 'int16', y: 'int16' })
    const arr = new StructArray(s)
    expect(arr.length).toBe(0)
  })

  it('emplaceBack increases length', () => {
    const s = defineStruct({ x: 'int16', y: 'int16' })
    const arr = new StructArray(s)
    arr.emplaceBack(1, 2)
    expect(arr.length).toBe(1)
    arr.emplaceBack(3, 4)
    expect(arr.length).toBe(2)
  })

  it('reads back int16 values correctly', () => {
    const s = defineStruct({ x: 'int16', y: 'int16' })
    const arr = new StructArray(s)
    arr.emplaceBack(100, -200)
    const view = new Int16Array(arr.arrayBuffer)
    expect(view[0]).toBe(100)
    expect(view[1]).toBe(-200)
  })

  it('reads back float32 values correctly', () => {
    const s = defineStruct({ u: 'float32', v: 'float32' })
    const arr = new StructArray(s)
    arr.emplaceBack(0.5, 0.75)
    const view = new Float32Array(arr.arrayBuffer)
    expect(view[0]).toBeCloseTo(0.5)
    expect(view[1]).toBeCloseTo(0.75)
  })

  it('handles mixed field types with alignment', () => {
    const s = defineStruct({ x: 'int16', scale: 'float32' })
    // stride = 8 bytes: 2 (int16) + 2 (padding) + 4 (float32)
    const arr = new StructArray(s)
    arr.emplaceBack(42, 1.5)
    arr.emplaceBack(-7, 0.25)
    const buf = arr.arrayBuffer
    const dv = new DataView(buf)
    expect(dv.getInt16(0, true)).toBe(42)
    expect(dv.getFloat32(4, true)).toBeCloseTo(1.5) // aligned to offset 4
    expect(dv.getInt16(8, true)).toBe(-7)
    expect(dv.getFloat32(12, true)).toBeCloseTo(0.25)
  })

  it('stores multiple elements contiguously', () => {
    const s = defineStruct({ x: 'uint16', y: 'uint16' })
    const arr = new StructArray(s)
    arr.emplaceBack(10, 20)
    arr.emplaceBack(30, 40)
    arr.emplaceBack(50, 60)
    const view = new Uint16Array(arr.arrayBuffer)
    expect(Array.from(view.slice(0, 6))).toEqual([10, 20, 30, 40, 50, 60])
  })

  it('grows the buffer when capacity is exceeded', () => {
    const s = defineStruct({ v: 'float32' })
    const arr = new StructArray(s, 2) // start with capacity 2
    arr.emplaceBack(1)
    arr.emplaceBack(2)
    arr.emplaceBack(3) // triggers growth
    expect(arr.length).toBe(3)
    const view = new Float32Array(arr.arrayBuffer)
    expect(view[0]).toBeCloseTo(1)
    expect(view[1]).toBeCloseTo(2)
    expect(view[2]).toBeCloseTo(3)
  })

  it('arrayBuffer is trimmed to actual used bytes', () => {
    const s = defineStruct({ x: 'int16' })
    const arr = new StructArray(s, 8) // large initial capacity
    arr.emplaceBack(1)
    arr.emplaceBack(2)
    expect(arr.arrayBuffer.byteLength).toBe(4) // 2 elements × 2 bytes
  })

  it('supports uint8 field type', () => {
    const s = defineStruct({ a: 'uint8', b: 'uint8' })
    const arr = new StructArray(s)
    arr.emplaceBack(255, 128)
    const view = new Uint8Array(arr.arrayBuffer)
    expect(view[0]).toBe(255)
    expect(view[1]).toBe(128)
  })

  it('supports int32 field type', () => {
    const s = defineStruct({ id: 'int32' })
    const arr = new StructArray(s)
    arr.emplaceBack(-100000)
    const view = new Int32Array(arr.arrayBuffer)
    expect(view[0]).toBe(-100000)
  })

  it('exposes int16/uint16/uint32/float32 typed array views', () => {
    const layout = defineStruct({ x: 'int16', y: 'int16', dist: 'float32' })
    const arr = new StructArray(layout)
    arr.emplaceBack(100, 200, 42.5)
    expect(arr.int16).toBeInstanceOf(Int16Array)
    expect(arr.float32).toBeInstanceOf(Float32Array)
  })

  it('typed array views index correctly with alignment', () => {
    const layout = defineStruct({ x: 'int16', y: 'int16', dist: 'float32' })
    const arr = new StructArray(layout)
    arr.emplaceBack(100, 200, 42.5)
    arr.emplaceBack(300, 400, 99.0)
    // stride = 8 bytes = 4 int16s = 2 float32s per element
    expect(arr.int16[0]).toBe(100)
    expect(arr.int16[1]).toBe(200)
    expect(arr.int16[4]).toBe(300)
    expect(arr.float32[1]).toBeCloseTo(42.5)
    expect(arr.float32[3]).toBeCloseTo(99.0)
  })

  it('typed array views refresh after grow', () => {
    const layout = defineStruct({ x: 'int16', y: 'int16', dist: 'float32' })
    const arr = new StructArray(layout, 2) // small capacity to trigger grow
    arr.emplaceBack(100, 200, 42.5)
    arr.emplaceBack(300, 400, 99.0)
    arr.emplaceBack(500, 600, 77.0) // triggers grow
    expect(arr.int16[8]).toBe(500)
    expect(arr.float32[5]).toBeCloseTo(77.0)
  })

  it('generates get<field>(index) accessors', () => {
    const layout = defineStruct({ offsetX: 'float32' })
    const arr = new StructArray(layout)
    arr.emplaceBack(42.5)
    arr.emplaceBack(99.0)
    expect(arr.getoffsetX(0)).toBeCloseTo(42.5)
    expect(arr.getoffsetX(1)).toBeCloseTo(99.0)
  })

  it('generates set<field>(index, value) mutators', () => {
    const layout = defineStruct({ offsetX: 'float32' })
    const arr = new StructArray(layout)
    arr.emplaceBack(0)
    arr.setoffsetX(0, 42.5)
    expect(arr.getoffsetX(0)).toBeCloseTo(42.5)
  })

  it('get(index) returns object with field getters/setters', () => {
    const layout = defineStruct({
      anchorX: 'int16', anchorY: 'int16', hidden: 'uint8',
    })
    const arr = new StructArray(layout)
    arr.emplaceBack(100, 200, 0)
    const s = arr.get(0)
    expect(s.anchorX).toBe(100)
    expect(s.anchorY).toBe(200)
    expect(s.hidden).toBe(0)
    s.hidden = 1
    expect(arr.get(0).hidden).toBe(1)
  })
})
