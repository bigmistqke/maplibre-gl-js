const viewTypes = {
    'Int8': Int8Array,
    'Uint8': Uint8Array,
    'Int16': Int16Array,
    'Uint16': Uint16Array,
    'Int32': Int32Array,
    'Uint32': Uint32Array,
    'Float32': Float32Array
};
class Struct {
    constructor(structArray, index) {
        this._structArray = structArray;
        this._pos1 = index * this.size;
        this._pos2 = this._pos1 / 2;
        this._pos4 = this._pos1 / 4;
        this._pos8 = this._pos1 / 8;
    }
}
const DEFAULT_CAPACITY = 128;
const RESIZE_MULTIPLIER = 5;
class StructArray {
    constructor() {
        this.isTransferred = false;
        this.capacity = -1;
        this.resize(0);
    }
    static serialize(array, transferables) {
        array._trim();
        if (transferables) {
            array.isTransferred = true;
            transferables.push(array.arrayBuffer);
        }
        return {
            length: array.length,
            arrayBuffer: array.arrayBuffer,
        };
    }
    static deserialize(input) {
        const structArray = Object.create(this.prototype);
        structArray.arrayBuffer = input.arrayBuffer;
        structArray.length = input.length;
        structArray.capacity = input.arrayBuffer.byteLength / structArray.bytesPerElement;
        structArray._refreshViews();
        return structArray;
    }
    _trim() {
        if (this.length !== this.capacity) {
            this.capacity = this.length;
            this.arrayBuffer = this.arrayBuffer.slice(0, this.length * this.bytesPerElement);
            this._refreshViews();
        }
    }
    clear() {
        this.length = 0;
    }
    resize(n) {
        this.reserve(n);
        this.length = n;
    }
    reserve(n) {
        if (n > this.capacity) {
            this.capacity = Math.max(n, Math.floor(this.capacity * RESIZE_MULTIPLIER), DEFAULT_CAPACITY);
            this.arrayBuffer = new ArrayBuffer(this.capacity * this.bytesPerElement);
            const oldUint8Array = this.uint8;
            this._refreshViews();
            if (oldUint8Array)
                this.uint8.set(oldUint8Array);
        }
    }
    _refreshViews() {
        throw new Error('_refreshViews() must be implemented by each concrete StructArray layout');
    }
}
function createLayout(members, alignment = 1) {
    let offset = 0;
    let maxSize = 0;
    const layoutMembers = members.map((member) => {
        const typeSize = sizeOf(member.type);
        const memberOffset = offset = align(offset, Math.max(alignment, typeSize));
        const components = member.components || 1;
        maxSize = Math.max(maxSize, typeSize);
        offset += typeSize * components;
        return {
            name: member.name,
            type: member.type,
            components,
            offset: memberOffset,
        };
    });
    const size = align(offset, Math.max(maxSize, alignment));
    return {
        members: layoutMembers,
        size,
        alignment
    };
}
function sizeOf(type) {
    return viewTypes[type].BYTES_PER_ELEMENT;
}
function align(offset, size) {
    return Math.ceil(offset / size) * size;
}
export { StructArray, Struct, viewTypes, createLayout };
//# sourceMappingURL=struct_array.js.map