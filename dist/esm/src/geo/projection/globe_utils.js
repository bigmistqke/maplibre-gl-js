import { vec3 } from 'gl-matrix';
import { clamp, createVec3f64, lerp, MAX_VALID_LATITUDE, mod, remapSaturate, scaleZoom, wrap } from '../../util/util';
import { LngLat } from '../lng_lat';
import { EXTENT } from '../../data/extent';
export function getGlobeCircumferencePixels(transform) {
    const radius = getGlobeRadiusPixels(transform.worldSize, transform.center.lat);
    const circumference = 2.0 * Math.PI * radius;
    return circumference;
}
export function globeDistanceOfLocationsPixels(transform, a, b) {
    const vecA = angularCoordinatesToSurfaceVector(a);
    const vecB = angularCoordinatesToSurfaceVector(b);
    const dot = vec3.dot(vecA, vecB);
    const radians = Math.acos(dot);
    const circumference = getGlobeCircumferencePixels(transform);
    return radians / (2.0 * Math.PI) * circumference;
}
export function mercatorCoordinatesToAngularCoordinatesRadians(mercatorX, mercatorY) {
    const sphericalX = mod(mercatorX * Math.PI * 2.0 + Math.PI, Math.PI * 2);
    const sphericalY = 2.0 * Math.atan(Math.exp(Math.PI - (mercatorY * Math.PI * 2.0))) - Math.PI * 0.5;
    return [sphericalX, sphericalY];
}
export function angularCoordinatesRadiansToVector(lngRadians, latRadians) {
    const len = Math.cos(latRadians);
    const vec = new Float64Array(3);
    vec[0] = Math.sin(lngRadians) * len;
    vec[1] = Math.sin(latRadians);
    vec[2] = Math.cos(lngRadians) * len;
    return vec;
}
export function projectTileCoordinatesToSphere(inTileX, inTileY, tileIdX, tileIdY, tileIdZ) {
    const scale = 1.0 / (1 << tileIdZ);
    const mercatorX = inTileX / EXTENT * scale + tileIdX * scale;
    const mercatorY = inTileY / EXTENT * scale + tileIdY * scale;
    const sphericalX = mod(mercatorX * Math.PI * 2.0 + Math.PI, Math.PI * 2);
    const sphericalY = 2.0 * Math.atan(Math.exp(Math.PI - (mercatorY * Math.PI * 2.0))) - Math.PI * 0.5;
    const len = Math.cos(sphericalY);
    const vec = new Float64Array(3);
    vec[0] = Math.sin(sphericalX) * len;
    vec[1] = Math.sin(sphericalY);
    vec[2] = Math.cos(sphericalX) * len;
    return vec;
}
export function angularCoordinatesToSurfaceVector(lngLat) {
    return angularCoordinatesRadiansToVector(lngLat.lng * Math.PI / 180, lngLat.lat * Math.PI / 180);
}
export function getGlobeRadiusPixels(worldSize, latitudeDegrees) {
    return worldSize / (2.0 * Math.PI) / Math.cos(latitudeDegrees * Math.PI / 180);
}
export function sphereSurfacePointToCoordinates(surface) {
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
    }
    else {
        return new LngLat(0.0, latDegrees);
    }
}
export function horizonPlaneToCenterAndRadius(horizonPlane) {
    const center = createVec3f64();
    center[0] = horizonPlane[0] * -horizonPlane[3];
    center[1] = horizonPlane[1] * -horizonPlane[3];
    center[2] = horizonPlane[2] * -horizonPlane[3];
    const radius = Math.sqrt(1 - horizonPlane[3] * horizonPlane[3]);
    return { center, radius };
}
export function clampToSphere(center, radius, point) {
    const relativeToCenter = createVec3f64();
    vec3.sub(relativeToCenter, point, center);
    const clamped = createVec3f64();
    vec3.scaleAndAdd(clamped, center, relativeToCenter, radius / vec3.len(relativeToCenter));
    return clamped;
}
function planetScaleAtLatitude(latitudeDegrees) {
    return Math.cos(latitudeDegrees * Math.PI / 180);
}
export function getZoomAdjustment(oldLat, newLat) {
    const oldCircumference = planetScaleAtLatitude(oldLat);
    const newCircumference = planetScaleAtLatitude(newLat);
    return scaleZoom(newCircumference / oldCircumference);
}
export function getDegreesPerPixel(worldSize, lat) {
    return 360.0 / getGlobeCircumferencePixels({ worldSize, center: { lat } });
}
export function computeGlobePanCenter(panDelta, tr) {
    const rotatedPanDelta = panDelta.rotate(tr.bearingInRadians);
    const normalizedGlobeZoom = tr.zoom + getZoomAdjustment(tr.center.lat, 0);
    const lngSpeed = lerp(1.0 / planetScaleAtLatitude(tr.center.lat), 1.0 / planetScaleAtLatitude(Math.min(Math.abs(tr.center.lat), 60)), remapSaturate(normalizedGlobeZoom, 7, 3, 0, 1.0));
    const panningDegreesPerPixel = getDegreesPerPixel(tr.worldSize, tr.center.lat);
    return new LngLat(tr.center.lng - rotatedPanDelta.x * panningDegreesPerPixel * lngSpeed, clamp(tr.center.lat + rotatedPanDelta.y * panningDegreesPerPixel, -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE));
}
function integrateSecX(x) {
    const xHalf = 0.5 * x;
    const sin = Math.sin(xHalf);
    const cos = Math.cos(xHalf);
    return Math.log(sin + cos) - Math.log(cos - sin);
}
export function interpolateLngLatForGlobe(start, deltaLng, deltaLat, t) {
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
        return new LngLat(interpolatedLng, interpolatedLat);
    }
    else {
        const interpolatedLng = start.lng + deltaLng * t;
        return new LngLat(interpolatedLng, interpolatedLat);
    }
}
//# sourceMappingURL=globe_utils.js.map