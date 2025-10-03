import { type ReadonlyVec4, vec3 } from 'gl-matrix';
import { LngLat } from '../lng_lat';
import type Point from '@mapbox/point-geometry';
export declare function getGlobeCircumferencePixels(transform: {
    worldSize: number;
    center: {
        lat: number;
    };
}): number;
export declare function globeDistanceOfLocationsPixels(transform: {
    worldSize: number;
    center: {
        lat: number;
    };
}, a: LngLat, b: LngLat): number;
export declare function mercatorCoordinatesToAngularCoordinatesRadians(mercatorX: number, mercatorY: number): [number, number];
export declare function angularCoordinatesRadiansToVector(lngRadians: number, latRadians: number): vec3;
export declare function projectTileCoordinatesToSphere(inTileX: number, inTileY: number, tileIdX: number, tileIdY: number, tileIdZ: number): vec3;
export declare function angularCoordinatesToSurfaceVector(lngLat: LngLat): vec3;
export declare function getGlobeRadiusPixels(worldSize: number, latitudeDegrees: number): number;
export declare function sphereSurfacePointToCoordinates(surface: vec3): LngLat;
export declare function horizonPlaneToCenterAndRadius(horizonPlane: ReadonlyVec4): {
    center: vec3;
    radius: number;
};
export declare function clampToSphere(center: vec3, radius: number, point: vec3): import("gl-matrix").IndexedCollection | import("gl-matrix").Vec3.Tuple;
export declare function getZoomAdjustment(oldLat: number, newLat: number): number;
export declare function getDegreesPerPixel(worldSize: number, lat: number): number;
export declare function computeGlobePanCenter(panDelta: Point, tr: {
    readonly bearingInRadians: number;
    readonly worldSize: number;
    readonly center: LngLat;
    readonly zoom: number;
}): LngLat;
export declare function interpolateLngLatForGlobe(start: LngLat, deltaLng: number, deltaLat: number, t: number): LngLat;
//# sourceMappingURL=globe_utils.d.ts.map