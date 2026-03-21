# StructArray Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a minimal runtime struct-array utility that packs named fields into a flat `ArrayBuffer` with a known stride, ready for `gl.bufferData` — replacing MapLibre's code-generated `StructArray` machinery.

**Architecture:** `defineStruct(schema)` computes stride and per-field byte offsets at definition time and returns a reusable schema object. `new StructArray(schema)` wraps a growing `ArrayBuffer` with typed views. `emplaceBack(...values)` appends one element. The buffer doubles in capacity when full. No dependencies.

**Tech Stack:** TypeScript strict, Vitest (`npx vitest run --config vitest.config.unit.ts src/modular/core/struct-array.test.ts`)

**Spec:** `docs/superpowers/specs/2026-03-20-symbol-design.md` — "Shared Primitive: StructArray" section

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/modular/core/struct-array.ts` | Create | `defineStruct` + `StructArray` implementation |
| `src/modular/core/struct-array.test.ts` | Create | Unit tests |

---

### Task 1: Write the failing tests

**Files:**
- Create: `src/modular/core/struct-array.test.ts`

- [ ] **Step 1: Create the test file**

```ts
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
```

- [ ] **Step 2: Run tests to confirm they all fail**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/core/struct-array.test.ts
```

Expected: all tests fail with `Cannot find module './struct-array.ts'`

---

### Task 2: Implement `defineStruct` and `StructArray`

**Files:**
- Create: `src/modular/core/struct-array.ts`

- [ ] **Step 1: Implement**

```ts
// src/modular/core/struct-array.ts

export type FieldType = 'int8' | 'uint8' | 'int16' | 'uint16' | 'int32' | 'uint32' | 'float32'

const BYTE_SIZE: Record<FieldType, number> = {
  int8: 1, uint8: 1,
  int16: 2, uint16: 2,
  int32: 4, uint32: 4,
  float32: 4,
}

export type StructSchema<K extends string> = {
  stride: number
  fields: Record<K, { offset: number; type: FieldType }>
}

export function defineStruct<K extends string>(
  schema: Record<K, FieldType>,
): StructSchema<K> {
  let offset = 0
  const fields = {} as Record<K, { offset: number; type: FieldType }>
  for (const [key, type] of Object.entries(schema) as [K, FieldType][]) {
    fields[key] = { offset, type }
    offset += BYTE_SIZE[type]
  }
  return { stride: offset, fields }
}

export class StructArray<K extends string> {
  private _schema: StructSchema<K>
  private _capacity: number
  private _buf: ArrayBuffer
  private _view: DataView
  length = 0

  constructor(schema: StructSchema<K>, initialCapacity = 16) {
    this._schema = schema
    this._capacity = initialCapacity
    this._buf = new ArrayBuffer(schema.stride * initialCapacity)
    this._view = new DataView(this._buf)
  }

  emplaceBack(...values: number[]): void {
    if (this.length >= this._capacity) this._grow()
    const base = this.length * this._schema.stride
    const fieldEntries = Object.values(this._schema.fields) as { offset: number; type: FieldType }[]
    for (let i = 0; i < fieldEntries.length; i++) {
      const { offset, type } = fieldEntries[i]
      const val = values[i] ?? 0
      this._write(base + offset, type, val)
    }
    this.length++
  }

  get arrayBuffer(): ArrayBuffer {
    return this._buf.slice(0, this.length * this._schema.stride)
  }

  private _write(byteOffset: number, type: FieldType, value: number): void {
    const v = this._view
    switch (type) {
      case 'int8':    v.setInt8(byteOffset, value); break
      case 'uint8':   v.setUint8(byteOffset, value); break
      case 'int16':   v.setInt16(byteOffset, value, true); break
      case 'uint16':  v.setUint16(byteOffset, value, true); break
      case 'int32':   v.setInt32(byteOffset, value, true); break
      case 'uint32':  v.setUint32(byteOffset, value, true); break
      case 'float32': v.setFloat32(byteOffset, value, true); break
    }
  }

  private _grow(): void {
    this._capacity = Math.max(this._capacity * 2, 1)
    const next = new ArrayBuffer(this._schema.stride * this._capacity)
    new Uint8Array(next).set(new Uint8Array(this._buf))
    this._buf = next
    this._view = new DataView(this._buf)
  }
}
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/core/struct-array.test.ts
```

Expected: all tests pass

- [ ] **Step 3: Type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "struct-array"
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/modular/core/struct-array.ts src/modular/core/struct-array.test.ts
git commit -m "feat(modular/core): add StructArray — runtime typed vertex buffer packer"
```
