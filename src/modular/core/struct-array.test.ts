// src/modular/core/struct-array.test.ts
import { describe, it, expect } from 'vitest'
import { defineStruct, StructArray } from './struct-array.ts'

describe('defineStruct', () => {
  it('computes stride as sum of field byte sizes', () => {
    const s = defineStruct({ x: 'int16', y: 'int16' })
    expect(s.stride).toBe(4) // 2 + 2
  })

  it('computes byte offset of each field in order', () => {
    const s = defineStruct({ x: 'int16', y: 'float32', z: 'uint8' })
    expect(s.fields.x.offset).toBe(0)
    expect(s.fields.y.offset).toBe(2)
    expect(s.fields.z.offset).toBe(6)
  })

  it('computes correct stride for mixed types', () => {
    const s = defineStruct({ x: 'int16', y: 'float32', z: 'uint8' })
    expect(s.stride).toBe(7) // 2 + 4 + 1
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

  it('handles mixed field types', () => {
    const s = defineStruct({ x: 'int16', scale: 'float32' })
    const arr = new StructArray(s)
    arr.emplaceBack(42, 1.5)
    arr.emplaceBack(-7, 0.25)
    const buf = arr.arrayBuffer
    const i16 = new Int16Array(buf)
    const f32 = new Float32Array(buf)
    // stride = 6 bytes: 2 (int16) + 4 (float32)
    // element 0: bytes 0-5 → i16[0]=42, f32 at byte 2 → f32[0] (only if aligned)
    // Use DataView for unaligned reads
    const dv = new DataView(buf)
    expect(dv.getInt16(0, true)).toBe(42)
    expect(dv.getFloat32(2, true)).toBeCloseTo(1.5)
    expect(dv.getInt16(6, true)).toBe(-7)
    expect(dv.getFloat32(8, true)).toBeCloseTo(0.25)
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
})
