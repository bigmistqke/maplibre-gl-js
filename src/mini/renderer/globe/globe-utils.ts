import {vec3} from 'gl-matrix'
import type {ReadonlyVec4} from 'gl-matrix'

// Inline helpers from MapLibre's util.ts
function clamp(n: number, lo: number, hi: number): number { return Math.min(Math.max(n, lo), hi) }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }
function wrap(n: number, min: number, max: number): number {
    const d = max - min
    const w = ((n - min) % d + d) % d + min
    return w === min ? max : w
}
function mod(n: number, m: number): number { return ((n % m) + m) % m }
function remapSaturate(value: number, inLow: number, inHigh: number, outLow: number, outHigh: number): number {
    return clamp((value - inLow) / (inHigh - inLow), 0, 1) * (outHigh - outLow) + outLow
}
function scaleZoom(scale: number): number { return Math.log(scale) / Math.LN2 }
function createVec3f64(): vec3 { return new Float64Array(3) as unknown as vec3 }

const MAX_VALID_LATITUDE = 85.051129;

// Inline LngLat as a plain object with constructor
interface LngLatLike { lng: number; lat: number }
class LngLat implements LngLatLike {
    lng: number
    lat: number
    constructor(lng: number, lat: number) { this.lng = lng; this.lat = lat }
}

// Mini uses 4096 tile extent (MVT default); MapLibre uses 8192
const EXTENT = 4096

export function getGlobeCircumferencePixels(transform: {worldSize: number; center: {lat: number}}): number {
    const radius = getGlobeRadiusPixels(transform.worldSize, transform.center.lat);
    const circumference = 2.0 * Math.PI * radius;
    return circumference;
}

export function globeDistanceOfLocationsPixels(transform: {worldSize: number; center: {lat: number}}, a: LngLatLike, b: LngLatLike): number {
    const vecA = angularCoordinatesToSurfaceVector(a);
    const vecB = angularCoordinatesToSurfaceVector(b);
    const dot = vec3.dot(vecA, vecB);
    const radians = Math.acos(dot);
    const circumference = getGlobeCircumferencePixels(transform);
    return radians / (2.0 * Math.PI) * circumference;
}

/**
 * For given mercator coordinates in range 0..1, returns the angular coordinates on the sphere's surface, in radians.
 */
export function mercatorCoordinatesToAngularCoordinatesRadians(mercatorX: number, mercatorY: number): [number, number] {
    const sphericalX = mod(mercatorX * Math.PI * 2.0 + Math.PI, Math.PI * 2);
    const sphericalY = 2.0 * Math.atan(Math.exp(Math.PI - (mercatorY * Math.PI * 2.0))) - Math.PI * 0.5;
    return [sphericalX, sphericalY];
}

/**
 * For a given longitude and latitude (note: in radians) returns the normalized vector from the planet center to the specified place on the surface.
 */
export function angularCoordinatesRadiansToVector(lngRadians: number, latRadians: number): vec3 {
    const len = Math.cos(latRadians);
    const vec = new Float64Array(3) as unknown as vec3;
    vec[0] = Math.sin(lngRadians) * len;
    vec[1] = Math.sin(latRadians);
    vec[2] = Math.cos(lngRadians) * len;
    return vec;
}

/**
 * Projects a point within a tile to the surface of the unit sphere globe.
 */
export function projectTileCoordinatesToSphere(inTileX: number, inTileY: number, tileIdX: number, tileIdY: number, tileIdZ: number): vec3 {
    const scale = 1.0 / (1 << tileIdZ);
    const mercatorX = inTileX / EXTENT * scale + tileIdX * scale;
    const mercatorY = inTileY / EXTENT * scale + tileIdY * scale;
    const sphericalX = mod(mercatorX * Math.PI * 2.0 + Math.PI, Math.PI * 2);
    const sphericalY = 2.0 * Math.atan(Math.exp(Math.PI - (mercatorY * Math.PI * 2.0))) - Math.PI * 0.5;
    const len = Math.cos(sphericalY);
    const vec = new Float64Array(3) as unknown as vec3;
    vec[0] = Math.sin(sphericalX) * len;
    vec[1] = Math.sin(sphericalY);
    vec[2] = Math.cos(sphericalX) * len;
    return vec;
}

/**
 * For a given longitude and latitude (note: in degrees) returns the normalized vector from the planet center to the specified place on the surface.
 */
export function angularCoordinatesToSurfaceVector(lngLat: LngLatLike): vec3 {
    return angularCoordinatesRadiansToVector(lngLat.lng * Math.PI / 180, lngLat.lat * Math.PI / 180);
}

export function getGlobeRadiusPixels(worldSize: number, latitudeDegrees: number): number {
    // We want zoom levels to be consistent between globe and flat views.
    // This means that the pixel size of features at the map center point
    // should be the same for both globe and flat view.
    // For this reason we scale the globe up when map center is nearer to the poles.
    return worldSize / (2.0 * Math.PI) / Math.cos(latitudeDegrees * Math.PI / 180);
}

/**
 * Given a 3D point on the surface of a unit sphere, returns its angular coordinates in degrees.
 * The input vector must be normalized.
 */
export function sphereSurfacePointToCoordinates(surface: vec3): LngLat {
    const latRadians = Math.asin(surface[1]);
    const latDegrees = latRadians / Math.PI * 180.0;
    const lengthXZ = Math.sqrt(surface[0] * surface[0] + surface[2] * surface[2]);
    if (lengthXZ > 1e-6) {
        const projX = surface[0] / lengthXZ;
        const projZ = surface[2] / lengthXZ;
        const acosZ = Math.acos(projZ);
        const lngRadians = (projX > 0) ? acosZ : -acosZ;
        const lngDegrees = lngRadians / Math.PI * 180.0;
        return new LngLat(wrap(lngDegrees, -180, 180), latDegrees);
    } else {
        return new LngLat(0.0, latDegrees);
    }
}

/**
 * Given a normalized horizon plane in Ax+By+Cz+D=0 format, compute the center and radius of
 * the circle in that plain that contains the entire visible portion of the unit sphere from horizon
 * to horizon.
 */
export function horizonPlaneToCenterAndRadius(horizonPlane: ReadonlyVec4): { center: vec3; radius: number } {
    const center = createVec3f64();
    center[0] = horizonPlane[0] * -horizonPlane[3];
    center[1] = horizonPlane[1] * -horizonPlane[3];
    center[2] = horizonPlane[2] * -horizonPlane[3];
    const radius = Math.sqrt(1 - horizonPlane[3] * horizonPlane[3]);
    return {center, radius};
}

/**
 * Computes the closest point on a sphere to `point`.
 */
export function clampToSphere(center: vec3, radius: number, point: vec3): vec3 {
    const relativeToCenter = createVec3f64();
    vec3.sub(relativeToCenter, point, center);
    const clamped = createVec3f64();
    vec3.scaleAndAdd(clamped, center, relativeToCenter, radius / vec3.len(relativeToCenter));
    return clamped;
}

function planetScaleAtLatitude(latitudeDegrees: number): number {
    return Math.cos(latitudeDegrees * Math.PI / 180);
}

/**
 * Computes how much to modify zoom to keep the globe size constant when changing latitude.
 */
export function getZoomAdjustment(oldLat: number, newLat: number): number {
    const oldCircumference = planetScaleAtLatitude(oldLat);
    const newCircumference = planetScaleAtLatitude(newLat);
    return scaleZoom(newCircumference / oldCircumference);
}

export function getDegreesPerPixel(worldSize: number, lat: number): number {
    return 360.0 / getGlobeCircumferencePixels({worldSize, center: {lat}});
}

/**
 * Returns transform's new center rotation after applying panning.
 */
export function computeGlobePanCenter(panDelta: {x: number; y: number; rotate: (bearing: number) => {x: number; y: number}}, tr: {
    readonly bearingInRadians: number;
    readonly worldSize: number;
    readonly center: LngLatLike;
    readonly zoom: number;
}): LngLat {
    const rotatedPanDelta = panDelta.rotate(tr.bearingInRadians);
    const normalizedGlobeZoom = tr.zoom + getZoomAdjustment(tr.center.lat, 0);
    const lngSpeed = lerp(
        1.0 / planetScaleAtLatitude(tr.center.lat),
        1.0 / planetScaleAtLatitude(Math.min(Math.abs(tr.center.lat), 60)),
        remapSaturate(normalizedGlobeZoom, 7, 3, 0, 1.0)
    );
    const panningDegreesPerPixel = getDegreesPerPixel(tr.worldSize, tr.center.lat);
    return new LngLat(
        tr.center.lng - rotatedPanDelta.x * panningDegreesPerPixel * lngSpeed,
        clamp(tr.center.lat + rotatedPanDelta.y * panningDegreesPerPixel, -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE)
    );
}

/**
 * Integration of `1 / cos(x)`.
 */
function integrateSecX(x: number): number {
    const xHalf = 0.5 * x;
    const sin = Math.sin(xHalf);
    const cos = Math.cos(xHalf);
    return Math.log(sin + cos) - Math.log(cos - sin);
}

/**
 * Interpolates globe center between two locations while preserving apparent rotation speed during interpolation.
 */
export function interpolateLngLatForGlobe(start: LngLatLike, deltaLng: number, deltaLat: number, t: number): LngLat {
    const interpolatedLat = start.lat + deltaLat * t;

    if (Math.abs(deltaLat) > 1) {
        const endLat = start.lat + deltaLat;
        const onDifferentHemispheres = Math.sign(endLat) !== Math.sign(start.lat);
        const samplePointStart = (onDifferentHemispheres ? -Math.abs(start.lat) : Math.abs(start.lat)) * Math.PI / 180;
        const samplePointEnd = Math.abs(start.lat + deltaLat) * Math.PI / 180;
        const valueT = integrateSecX(samplePointStart + t * (samplePointEnd - samplePointStart));
        const valueStart = integrateSecX(samplePointStart);
        const valueEnd = integrateSecX(samplePointEnd);
        const newT = (valueT - valueStart) / (valueEnd - valueStart);
        const interpolatedLng = start.lng + deltaLng * newT;
        return new LngLat(
            interpolatedLng,
            interpolatedLat
        );
    } else {
        const interpolatedLng = start.lng + deltaLng * t;
        return new LngLat(
            interpolatedLng,
            interpolatedLat
        );
    }
}
