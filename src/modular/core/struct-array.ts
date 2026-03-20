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
