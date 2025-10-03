import Point from '@mapbox/point-geometry';
import { type CanonicalTileID } from '../source/tile_id';
type SubdivisionResult = {
    verticesFlattened: Array<number>;
    indicesTriangles: Array<number>;
    indicesLineList: Array<Array<number>>;
};
export declare const NORTH_POLE_Y = -32768;
export declare const SOUTH_POLE_Y = 32767;
export declare function subdividePolygon(polygon: Array<Array<Point>>, canonical: CanonicalTileID, granularity: number, generateOutlineLines?: boolean): SubdivisionResult;
export declare function subdivideVertexLine(linePoints: Array<Point>, granularity: number, isRing?: boolean): Array<Point>;
export declare function fixWindingOrder(flattened: Array<number>, indices: Array<number>): Array<number>;
export declare function scanlineTriangulateVertexRing(vertexBuffer: Array<number>, ring: Array<number>, finalIndices: Array<number>): void;
export {};
//# sourceMappingURL=subdivision.d.ts.map