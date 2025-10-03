import type { VertexArrayObject } from '../render/vertex_array_object';
import type { StructArray } from '../util/struct_array';
export type Segment = {
    sortKey?: number;
    vertexOffset: number;
    primitiveOffset: number;
    vertexLength: number;
    primitiveLength: number;
    vaos: {
        [_: string]: VertexArrayObject;
    };
};
export declare class SegmentVector {
    static MAX_VERTEX_ARRAY_LENGTH: number;
    segments: Array<Segment>;
    private _forceNewSegmentOnNextPrepare;
    constructor(segments?: Array<Segment>);
    prepareSegment(numVertices: number, layoutVertexArray: StructArray, indexArray: StructArray, sortKey?: number): Segment;
    createNewSegment(layoutVertexArray: StructArray, indexArray: StructArray, sortKey?: number): Segment;
    getOrCreateLatestSegment(layoutVertexArray: StructArray, indexArray: StructArray, sortKey?: number): Segment;
    forceNewSegmentOnNextPrepare(): void;
    get(): Segment[];
    destroy(): void;
    static simpleSegment(vertexOffset: number, primitiveOffset: number, vertexLength: number, primitiveLength: number): SegmentVector;
}
//# sourceMappingURL=segment.d.ts.map