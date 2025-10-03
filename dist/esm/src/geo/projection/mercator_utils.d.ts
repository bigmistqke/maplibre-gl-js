import { mat4 } from 'gl-matrix';
import { MercatorCoordinate } from '../mercator_coordinate';
import Point from '@mapbox/point-geometry';
import type { UnwrappedTileIDType } from '../transform_helper';
import type { LngLat } from '../lng_lat';
export declare const maxMercatorHorizonAngle = 89.25;
export declare function tileCoordinatesToMercatorCoordinates(inTileX: number, inTileY: number, canonicalTileID: {
    x: number;
    y: number;
    z: number;
}): MercatorCoordinate;
export declare function tileCoordinatesToLocation(inTileX: number, inTileY: number, canonicalTileID: {
    x: number;
    y: number;
    z: number;
}): LngLat;
export declare function projectToWorldCoordinates(worldSize: number, lnglat: LngLat): Point;
export declare function unprojectFromWorldCoordinates(worldSize: number, point: Point): LngLat;
export declare function getMercatorHorizon(transform: {
    pitch: number;
    cameraToCenterDistance: number;
}): number;
export declare function calculateTileMatrix(unwrappedTileID: UnwrappedTileIDType, worldSize: number): mat4;
export declare function cameraMercatorCoordinateFromCenterAndRotation(center: LngLat, elevation: number, pitch: number, bearing: number, distance: number): MercatorCoordinate;
//# sourceMappingURL=mercator_utils.d.ts.map