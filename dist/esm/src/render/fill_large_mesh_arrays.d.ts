import { type LineIndexArray, type TriangleIndexArray } from '../data/array_types.g';
import { SegmentVector } from '../data/segment';
import { type StructArray } from '../util/struct_array';
export declare function fillLargeMeshArrays(addVertex: (x: number, y: number) => void, segmentsTriangles: SegmentVector, vertexArray: StructArray, triangleIndexArray: TriangleIndexArray, flattened: Array<number>, triangleIndices: Array<number>, segmentsLines?: SegmentVector, lineIndexArray?: LineIndexArray, lineList?: Array<Array<number>>): void;
//# sourceMappingURL=fill_large_mesh_arrays.d.ts.map