// src/modular/core/struct-array.ts

export type FieldType = 'int8' | 'uint8' | 'int16' | 'uint16' | 'int32' | 'uint32' | 'float32';

const BYTE_SIZE: Record<FieldType, number> = {
    int8: 1, uint8: 1,
    int16: 2, uint16: 2,
    int32: 4, uint32: 4,
    float32: 4,
};

export type StructSchema<K extends string> = {
    stride: number;
    fields: Record<K, { offset: number; type: FieldType }>;
};

export function defineStruct<K extends string>(
    schema: Record<K, FieldType>,
): StructSchema<K> {
    let offset = 0;
    let maxAlign = 1;
    const fields = {} as Record<K, { offset: number; type: FieldType }>;
    for (const [key, type] of Object.entries(schema) as [K, FieldType][]) {
        const size = BYTE_SIZE[type];
        // Align offset to the field's natural alignment (its byte size)
        offset = Math.ceil(offset / size) * size;
        fields[key] = {offset, type};
        offset += size;
        if (size > maxAlign) maxAlign = size;
    }
    // Pad stride to be a multiple of the largest field type's byte size
    const stride = Math.ceil(offset / maxAlign) * maxAlign;
    return {stride, fields};
}

/** Mapped type: for each field K, generates get<K>(i) and set<K>(i, v) */
export type FieldAccessors<K extends string> = {
    [F in K as `get${F}`]: (index: number) => number
} & {
    [F in K as `set${F}`]: (index: number, value: number) => void
};

/** A StructArray with typed field accessors */
export type TypedStructArray<K extends string> = StructArray<K> & FieldAccessors<K>;

/** Create a typed StructArray with get/set accessors for each field */
export function createStructArray<K extends string>(schema: StructSchema<K>, initialCapacity?: number): TypedStructArray<K> {
    return new StructArray(schema, initialCapacity) as TypedStructArray<K>;
}

export class StructArray<K extends string> {
    private _schema: StructSchema<K>;
    private _capacity: number;
    private _buf: ArrayBuffer;
    private _view: DataView;
    private _int16: Int16Array | null = null;
    private _uint16: Uint16Array | null = null;
    private _uint32: Uint32Array | null = null;
    private _float32: Float32Array | null = null;
    length = 0;

    constructor(schema: StructSchema<K>, initialCapacity = 16) {
        this._schema = schema;
        this._capacity = initialCapacity;
        this._buf = new ArrayBuffer(schema.stride * initialCapacity);
        this._view = new DataView(this._buf);
        this._defineAccessors();
    }

    private _defineAccessors(): void {
        const {stride, fields} = this._schema;
        for (const [key, {offset, type}] of Object.entries(fields) as [K, { offset: number; type: FieldType }][]) {
            switch (type) {
                case 'int8':
                case 'uint8': {
                    // 1-byte types — use DataView directly; stride in bytes
                    const byteOffset = offset
          ;(this as any)[`get${key}`] = (index: number) => {
                        const bytePos = index * stride + byteOffset;
                        return type === 'int8' ? this._view.getInt8(bytePos) : this._view.getUint8(bytePos);
                    }
                    ;(this as any)[`set${key}`] = (index: number, value: number) => {
                        const bytePos = index * stride + byteOffset;
                        if (type === 'int8') this._view.setInt8(bytePos, value);
                        else this._view.setUint8(bytePos, value);
                    };
                    break;
                }
                case 'int16': {
                    const elemsPerStruct = stride / 2;
                    const elemOffset = offset / 2
          ;(this as any)[`get${key}`] = (index: number) => this.int16[index * elemsPerStruct + elemOffset]
                    ;(this as any)[`set${key}`] = (index: number, value: number) => { this.int16[index * elemsPerStruct + elemOffset] = value; };
                    break;
                }
                case 'uint16': {
                    const elemsPerStruct = stride / 2;
                    const elemOffset = offset / 2
          ;(this as any)[`get${key}`] = (index: number) => this.uint16[index * elemsPerStruct + elemOffset]
                    ;(this as any)[`set${key}`] = (index: number, value: number) => { this.uint16[index * elemsPerStruct + elemOffset] = value; };
                    break;
                }
                case 'int32': {
                    ;(this as any)[`get${key}`] = (index: number) => {
                        return this._view.getInt32(index * stride + offset, true);
                    }
                    ;(this as any)[`set${key}`] = (index: number, value: number) => {
                        this._view.setInt32(index * stride + offset, value, true);
                    };
                    break;
                }
                case 'uint32': {
                    const elemsPerStruct = stride / 4;
                    const elemOffset = offset / 4
          ;(this as any)[`get${key}`] = (index: number) => this.uint32[index * elemsPerStruct + elemOffset]
                    ;(this as any)[`set${key}`] = (index: number, value: number) => { this.uint32[index * elemsPerStruct + elemOffset] = value; };
                    break;
                }
                case 'float32': {
                    const elemsPerStruct = stride / 4;
                    const elemOffset = offset / 4
          ;(this as any)[`get${key}`] = (index: number) => this.float32[index * elemsPerStruct + elemOffset]
                    ;(this as any)[`set${key}`] = (index: number, value: number) => { this.float32[index * elemsPerStruct + elemOffset] = value; };
                    break;
                }
            }
        }
    }

    get int16(): Int16Array {
        if (!this._int16) this._int16 = new Int16Array(this._buf);
        return this._int16;
    }

    get uint16(): Uint16Array {
        if (!this._uint16) this._uint16 = new Uint16Array(this._buf);
        return this._uint16;
    }

    get uint32(): Uint32Array {
        if (!this._uint32) this._uint32 = new Uint32Array(this._buf);
        return this._uint32;
    }

    get float32(): Float32Array {
        if (!this._float32) this._float32 = new Float32Array(this._buf);
        return this._float32;
    }

    clear(): void {
        this.length = 0;
    }

    resize(n: number): void {
        if (n > this._capacity) {
            // Grow capacity to at least n, using doubling strategy
            let cap = this._capacity;
            while (cap < n) cap = Math.max(cap * 2, 1);
            this._capacity = cap;
            const next = new ArrayBuffer(this._schema.stride * this._capacity);
            new Uint8Array(next).set(new Uint8Array(this._buf));
            this._buf = next;
            this._view = new DataView(this._buf);
            this._int16 = null;
            this._uint16 = null;
            this._uint32 = null;
            this._float32 = null;
        }
        this.length = n;
    }

    emplace(index: number, ...values: number[]): void {
        const base = index * this._schema.stride;
        const fieldEntries = Object.values(this._schema.fields) as { offset: number; type: FieldType }[];
        for (let i = 0; i < fieldEntries.length; i++) {
            const {offset, type} = fieldEntries[i];
            const val = values[i] ?? 0;
            this._write(base + offset, type, val);
        }
    }

    _trim(): void {
        const exact = new ArrayBuffer(this.length * this._schema.stride);
        new Uint8Array(exact).set(new Uint8Array(this._buf, 0, exact.byteLength));
        this._buf = exact;
        this._capacity = this.length;
        this._view = new DataView(this._buf);
        this._int16 = null;
        this._uint16 = null;
        this._uint32 = null;
        this._float32 = null;
    }

    emplaceBack(...values: number[]): void {
        if (this.length >= this._capacity) this._grow();
        const base = this.length * this._schema.stride;
        const fieldEntries = Object.values(this._schema.fields) as { offset: number; type: FieldType }[];
        for (let i = 0; i < fieldEntries.length; i++) {
            const {offset, type} = fieldEntries[i];
            const val = values[i] ?? 0;
            this._write(base + offset, type, val);
        }
        this.length++;
    }

    get(index: number): Record<K, number> {
        const {stride, fields} = this._schema;
        const view = this._view;
        const proxy = {} as Record<K, number>;
        for (const [key, {offset, type}] of Object.entries(fields) as [K, { offset: number; type: FieldType }][]) {
            const bytePos = index * stride + offset;
            Object.defineProperty(proxy, key, {
                enumerable: true,
                get(): number {
                    switch (type) {
                        case 'int8':    return view.getInt8(bytePos);
                        case 'uint8':   return view.getUint8(bytePos);
                        case 'int16':   return view.getInt16(bytePos, true);
                        case 'uint16':  return view.getUint16(bytePos, true);
                        case 'int32':   return view.getInt32(bytePos, true);
                        case 'uint32':  return view.getUint32(bytePos, true);
                        case 'float32': return view.getFloat32(bytePos, true);
                    }
                },
                set(value: number): void {
                    switch (type) {
                        case 'int8':    view.setInt8(bytePos, value); break;
                        case 'uint8':   view.setUint8(bytePos, value); break;
                        case 'int16':   view.setInt16(bytePos, value, true); break;
                        case 'uint16':  view.setUint16(bytePos, value, true); break;
                        case 'int32':   view.setInt32(bytePos, value, true); break;
                        case 'uint32':  view.setUint32(bytePos, value, true); break;
                        case 'float32': view.setFloat32(bytePos, value, true); break;
                    }
                },
            });
        }
        return proxy;
    }

    get arrayBuffer(): ArrayBuffer {
        return this._buf.slice(0, this.length * this._schema.stride);
    }

    private _write(byteOffset: number, type: FieldType, value: number): void {
        const v = this._view;
        switch (type) {
            case 'int8':    v.setInt8(byteOffset, value); break;
            case 'uint8':   v.setUint8(byteOffset, value); break;
            case 'int16':   v.setInt16(byteOffset, value, true); break;
            case 'uint16':  v.setUint16(byteOffset, value, true); break;
            case 'int32':   v.setInt32(byteOffset, value, true); break;
            case 'uint32':  v.setUint32(byteOffset, value, true); break;
            case 'float32': v.setFloat32(byteOffset, value, true); break;
        }
    }

    private _grow(): void {
        this._capacity = Math.max(this._capacity * 2, 1);
        const next = new ArrayBuffer(this._schema.stride * this._capacity);
        new Uint8Array(next).set(new Uint8Array(this._buf));
        this._buf = next;
        this._view = new DataView(this._buf);
        // Invalidate cached typed array views — they'll be recreated on next access
        this._int16 = null;
        this._uint16 = null;
        this._uint32 = null;
        this._float32 = null;
    }
}
