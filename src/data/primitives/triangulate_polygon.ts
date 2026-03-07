import {classifyRings} from '@maplibre/maplibre-gl-style-spec';
import {subdividePolygon} from '../../render/subdivision';
import {fillLargeMeshArrays} from '../../render/fill_large_mesh_arrays';
import {SegmentVector} from '../segment';
import type {StructArray} from '../../util/struct_array';
import type {TriangleIndexArray, LineIndexArray} from '../array_types.g';
import type {CanonicalTileID} from '../../tile/tile_id';
import type Point from '@mapbox/point-geometry';

const EARCUT_MAX_RINGS = 500;

export interface TriangulateTarget {
    addVertex: (x: number, y: number) => void;
    vertexArray: StructArray;
    triangleIndexArray: TriangleIndexArray;
    triangleSegments: SegmentVector;
    lineIndexArray?: LineIndexArray;
    lineSegments?: SegmentVector;
}

/**
 * Triangulates polygon geometry: classifies rings, subdivides for globe,
 * runs earcut triangulation, and emits vertices + indices into the target.
 *
 * This is a standalone geometry primitive — it has no knowledge of buckets,
 * layers, or styles. It takes raw geometry and writes to arrays via a callback.
 */
export function triangulatePolygon(
    geometry: Array<Array<Point>>,
    canonical: CanonicalTileID,
    granularity: number,
    target: TriangulateTarget,
) {
    for (const polygon of classifyRings(geometry, EARCUT_MAX_RINGS)) {
        const subdivided = subdividePolygon(polygon, canonical, granularity);

        fillLargeMeshArrays(
            target.addVertex,
            target.triangleSegments,
            target.vertexArray,
            target.triangleIndexArray,
            subdivided.verticesFlattened,
            subdivided.indicesTriangles,
            target.lineSegments,
            target.lineIndexArray,
            subdivided.indicesLineList,
        );
    }
}
