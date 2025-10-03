import { mat4 } from 'gl-matrix';
import { EXTENT } from '../../data/extent';
import { clamp, degreesToRadians, MAX_VALID_LATITUDE, zoomScale } from '../../util/util';
import { MercatorCoordinate, mercatorXfromLng, mercatorYfromLat, mercatorZfromAltitude } from '../mercator_coordinate';
import Point from '@mapbox/point-geometry';
export const maxMercatorHorizonAngle = 89.25;
export function tileCoordinatesToMercatorCoordinates(inTileX, inTileY, canonicalTileID) {
    const scale = 1.0 / (1 << canonicalTileID.z);
    return new MercatorCoordinate(inTileX / EXTENT * scale + canonicalTileID.x * scale, inTileY / EXTENT * scale + canonicalTileID.y * scale);
}
export function tileCoordinatesToLocation(inTileX, inTileY, canonicalTileID) {
    return tileCoordinatesToMercatorCoordinates(inTileX, inTileY, canonicalTileID).toLngLat();
}
export function projectToWorldCoordinates(worldSize, lnglat) {
    const lat = clamp(lnglat.lat, -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE);
    return new Point(mercatorXfromLng(lnglat.lng) * worldSize, mercatorYfromLat(lat) * worldSize);
}
export function unprojectFromWorldCoordinates(worldSize, point) {
    return new MercatorCoordinate(point.x / worldSize, point.y / worldSize).toLngLat();
}
export function getMercatorHorizon(transform) {
    return transform.cameraToCenterDistance * Math.min(Math.tan(degreesToRadians(90 - transform.pitch)) * 0.85, Math.tan(degreesToRadians(maxMercatorHorizonAngle - transform.pitch)));
}
export function calculateTileMatrix(unwrappedTileID, worldSize) {
    const canonical = unwrappedTileID.canonical;
    const scale = worldSize / zoomScale(canonical.z);
    const unwrappedX = canonical.x + Math.pow(2, canonical.z) * unwrappedTileID.wrap;
    const worldMatrix = mat4.identity(new Float64Array(16));
    mat4.translate(worldMatrix, worldMatrix, [unwrappedX * scale, canonical.y * scale, 0]);
    mat4.scale(worldMatrix, worldMatrix, [scale / EXTENT, scale / EXTENT, 1]);
    return worldMatrix;
}
export function cameraMercatorCoordinateFromCenterAndRotation(center, elevation, pitch, bearing, distance) {
    const centerMercator = MercatorCoordinate.fromLngLat(center, elevation);
    const mercUnitsPerMeter = mercatorZfromAltitude(1, center.lat);
    const dMercator = distance * mercUnitsPerMeter;
    const dzMercator = dMercator * Math.cos(degreesToRadians(pitch));
    const dhMercator = Math.sqrt(dMercator * dMercator - dzMercator * dzMercator);
    const dxMercator = dhMercator * Math.sin(degreesToRadians(-bearing));
    const dyMercator = dhMercator * Math.cos(degreesToRadians(-bearing));
    return new MercatorCoordinate(centerMercator.x + dxMercator, centerMercator.y + dyMercator, centerMercator.z + dzMercator);
}
//# sourceMappingURL=mercator_utils.js.map