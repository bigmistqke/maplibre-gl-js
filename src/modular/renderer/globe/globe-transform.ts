// Adapted from MapLibre's src/geo/projection/vertical_perspective_transform.ts
// Uses MapLibre's orbital-camera matrix construction so bearing and pitch work correctly.
import {mat4, vec3} from 'gl-matrix';
import type {CameraState} from '@modular/core/types.ts';
import type {Viewport} from '@modular/core/projection.ts';
import {getGlobeRadiusPixels} from '@modular/renderer/globe/globe-utils.ts';

const DEG_TO_RAD = Math.PI / 180;

/**
 * Compute the globe projection matrix using MapLibre's orbital-camera approach:
 * perspective → translate(cameraDist) → rotateX(-pitch) → rotateZ(bearing)
 *   → translate(-globeRadius) → rotateX(lat) → rotateY(-lng) → scale(globeRadius)
 */
export function computeGlobeMatrix(
    camera: CameraState,
    viewport: Viewport,
): Float32Array {
    const {center, zoom} = camera;
    const bearing = camera.bearing ?? 0;
    const pitch = camera.pitch ?? 0;
    const {width, height} = viewport;

    const worldSize = 256 * Math.pow(2, zoom);
    const globeRadiusPixels = getGlobeRadiusPixels(worldSize, center.lat);

    // Standard perspective FOV — same as MapLibre default
    const fovInRadians = 0.6435011087932844;  // Math.atan(1) * 2 ≈ ~36.87°
    const cameraToCenterDistance = (height / 2) / Math.tan(fovInRadians / 2);
    const aspect = width / height;
    const nearZ = 0.5;
    const farZ = cameraToCenterDistance + globeRadiusPixels * 2;

    const m = mat4.create();
    mat4.perspective(m, fovInRadians, aspect, nearZ, farZ);
    mat4.translate(m, m, [0, 0, -cameraToCenterDistance]);
    // roll = 0 (not supported)
    mat4.rotateX(m, m, -pitch * DEG_TO_RAD);
    mat4.rotateZ(m, m, bearing * DEG_TO_RAD);
    mat4.translate(m, m, [0, 0, -globeRadiusPixels]);
    mat4.rotateX(m, m, center.lat * DEG_TO_RAD);
    mat4.rotateY(m, m, -center.lng * DEG_TO_RAD);
    mat4.scale(m, m, [globeRadiusPixels, globeRadiusPixels, globeRadiusPixels]);

    return m as Float32Array;
}

/**
 * Compute the clipping plane for a globe — hides the back-facing hemisphere.
 * Adapted from MapLibre's _computeClippingPlane; accounts for pitch and bearing.
 * Returns vec4 (nx, ny, nz, d) in unit-sphere space.
 */
export function computeGlobeClippingPlane(
    camera: CameraState,
    viewport: Viewport,
): Float32Array {
    const bearing = camera.bearing ?? 0;
    const pitch = camera.pitch ?? 0;
    const zoom = camera.zoom;
    const worldSize = 256 * Math.pow(2, zoom);
    const globeRadiusPixels = getGlobeRadiusPixels(worldSize, camera.center.lat);
    const fovInRadians = 0.6435011087932844;
    const cameraToCenterDistance = (viewport.height / 2) / Math.tan(fovInRadians / 2);

    const pitchRad = pitch * DEG_TO_RAD;
    // Scale so globe radius = 1
    const distCamToB = cameraToCenterDistance / globeRadiusPixels;
    const distCamToA = Math.sin(pitchRad) * distCamToB;
    const distAtoC = Math.cos(pitchRad) * distCamToB + 1;
    const distCamToC = Math.sqrt(distCamToA * distCamToA + distAtoC * distAtoC);
    const tangentPlaneDist = 1 / distCamToC;  // camCTcosine * radius where radius=1

    let vx = -distCamToA;
    let vy = distAtoC;
    const len = Math.sqrt(vx * vx + vy * vy);
    vx /= len; vy /= len;

    const planeVec = vec3.fromValues(0, vx, vy);
    vec3.rotateZ(planeVec, planeVec, [0, 0, 0], -bearing * DEG_TO_RAD);
    vec3.rotateX(planeVec, planeVec, [0, 0, 0], -camera.center.lat * DEG_TO_RAD);
    vec3.rotateY(planeVec, planeVec, [0, 0, 0], camera.center.lng * DEG_TO_RAD);
    const s = 1 / vec3.length(planeVec);
    vec3.scale(planeVec, planeVec, s);

    return new Float32Array([planeVec[0], planeVec[1], planeVec[2], -tangentPlaneDist * s]);
}

/**
 * Tile mercator coordinates for the globe prelude uniform.
 * Returns vec4: (mercatorX0, mercatorY0, mercatorWidth, mercatorHeight)
 */
export function computeTileMercatorCoords(
    z: number, x: number, y: number,
): Float32Array {
    const scale = 1 / Math.pow(2, z);
    const EXTENT = 4096;
    return new Float32Array([
        x * scale,
        y * scale,
        scale / EXTENT,
        scale / EXTENT,
    ]);
}
