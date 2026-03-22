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
  let maxAlign = 1
  const fields = {} as Record<K, { offset: number; type: FieldType }>
  for (const [key, type] of Object.entries(schema) as [K, FieldType][]) {
    const size = BYTE_SIZE[type]
    // Align offset to the field's natural alignment (its byte size)
    offset = Math.ceil(offset / size) * size
    fields[key] = { offset, type }
    offset += size
    if (size > maxAlign) maxAlign = size
  }
  // Pad stride to be a multiple of the largest field type's byte size
  const stride = Math.ceil(offset / maxAlign) * maxAlign
  return { stride, fields }
}

export class StructArray<K extends string> {
  private _schema: StructSchema<K>
  private _capacity: number
  private _buf: ArrayBuffer
  private _view: DataView
  private _int16: Int16Array | null = null
  private _uint16: Uint16Array | null = null
  private _uint32: Uint32Array | null = null
  private _float32: Float32Array | null = null
  length = 0

  constructor(schema: StructSchema<K>, initialCapacity = 16) {
    this._schema = schema
    this._capacity = initialCapacity
    this._buf = new ArrayBuffer(schema.stride * initialCapacity)
    this._view = new DataView(this._buf)
  }

  get int16(): Int16Array {
    if (!this._int16) this._int16 = new Int16Array(this._buf)
    return this._int16
  }

  get uint16(): Uint16Array {
    if (!this._uint16) this._uint16 = new Uint16Array(this._buf)
    return this._uint16
  }

  get uint32(): Uint32Array {
    if (!this._uint32) this._uint32 = new Uint32Array(this._buf)
    return this._uint32
  }

  get float32(): Float32Array {
    if (!this._float32) this._float32 = new Float32Array(this._buf)
    return this._float32
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
    // Invalidate cached typed array views — they'll be recreated on next access
    this._int16 = null
    this._uint16 = null
    this._uint32 = null
    this._float32 = null
  }
}
