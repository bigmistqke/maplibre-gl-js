import Point from '@mapbox/point-geometry';
import type { StyleLayer } from '../style/style_layer';
import type { CircleBucket } from '../data/bucket/circle_bucket';
import type { LineBucket } from '../data/bucket/line_bucket';
import type { IReadonlyTransform } from '../geo/transform_interface';
import type { UnwrappedTileID } from '../source/tile_id';
export declare function getMaximumPaintValue(property: string, layer: StyleLayer, bucket: CircleBucket<any> | LineBucket): number;
export declare function translateDistance(translate: [number, number]): number;
export declare function translate(queryGeometry: Array<Point>, translate: [number, number], translateAnchor: 'viewport' | 'map', bearing: number, pixelsToTileUnits: number): Point[];
export declare function offsetLine(rings: Array<Array<Point>>, offset: number): Point[][];
type CircleIntersectionTestParams = {
    queryGeometry: Array<Point>;
    size: number;
    transform: IReadonlyTransform;
    unwrappedTileID: UnwrappedTileID;
    getElevation: undefined | ((x: number, y: number) => number);
    pitchAlignment?: 'map' | 'viewport';
    pitchScale?: 'map' | 'viewport';
};
export declare function circleIntersection({ queryGeometry, size, transform, unwrappedTileID, getElevation, pitchAlignment, pitchScale }: CircleIntersectionTestParams, geometry: any): boolean;
export declare function projectQueryGeometry(queryGeometry: Array<Point>, transform: IReadonlyTransform, unwrappedTileID: UnwrappedTileID, getElevation: undefined | ((x: number, y: number) => number)): Point[];
export {};
//# sourceMappingURL=query_utils.d.ts.map