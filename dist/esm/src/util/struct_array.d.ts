declare const viewTypes: {
    Int8: Int8ArrayConstructor;
    Uint8: Uint8ArrayConstructor;
    Int16: Int16ArrayConstructor;
    Uint16: Uint16ArrayConstructor;
    Int32: Int32ArrayConstructor;
    Uint32: Uint32ArrayConstructor;
    Float32: Float32ArrayConstructor;
};
export type ViewType = keyof typeof viewTypes;
declare class Struct {
    _pos1: number;
    _pos2: number;
    _pos4: number;
    _pos8: number;
    readonly _structArray: StructArray;
    size: number;
    constructor(structArray: StructArray, index: number);
}
export type StructArrayMember = {
    name: string;
    type: ViewType;
    components: number;
    offset: number;
};
export type StructArrayLayout = {
    members: Array<StructArrayMember>;
    size: number;
    alignment: number;
};
export type SerializedStructArray = {
    length: number;
    arrayBuffer: ArrayBuffer;
};
declare abstract class StructArray {
    capacity: number;
    length: number;
    isTransferred: boolean;
    arrayBuffer: ArrayBuffer;
    uint8: Uint8Array;
    members: Array<StructArrayMember>;
    bytesPerElement: number;
    abstract emplaceBack(...v: number[]): any;
    abstract emplace(i: number, ...v: number[]): any;
    constructor();
    static serialize(array: StructArray, transferables?: Array<Transferable>): SerializedStructArray;
    static deserialize(input: SerializedStructArray): any;
    _trim(): void;
    clear(): void;
    resize(n: number): void;
    reserve(n: number): void;
    _refreshViews(): void;
}
declare function createLayout(members: Array<{
    name: string;
    type: ViewType;
    readonly components?: number;
}>, alignment?: number): StructArrayLayout;
export { StructArray, Struct, viewTypes, createLayout };
//# sourceMappingURL=struct_array.d.ts.map