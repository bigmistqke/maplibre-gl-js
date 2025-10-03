import { OverscaledTileID } from '../../source/tile_id';
import { vec2 } from 'gl-matrix';
import { MercatorCoordinate } from '../mercator_coordinate';
import { degreesToRadians, scaleZoom } from '../../util/util';
import { maxMercatorHorizonAngle } from './mercator_utils';
export function isTileVisible(frustum, tileBoundingVolume, plane) {
    const frustumTest = tileBoundingVolume.intersectsFrustum(frustum);
    if (!plane || frustumTest === 0) {
        return frustumTest;
    }
    const planeTest = tileBoundingVolume.intersectsPlane(plane);
    if (planeTest === 0) {
        return 0;
    }
    if (frustumTest === 2 && planeTest === 2) {
        return 2;
    }
    return 1;
}
function integralOfCosXByP(p, x1, x2) {
    const numPoints = 10;
    let sum = 0;
    const dx = (x2 - x1) / numPoints;
    for (let i = 0; i < numPoints; i++) {
        const x = x1 + (i + 0.5) / numPoints * (x2 - x1);
        sum += dx * Math.pow(Math.cos(x), p);
    }
    return sum;
}
export function createCalculateTileZoomFunction(maxZoomLevelsOnScreen, tileCountMaxMinRatio) {
    return function (requestedCenterZoom, distanceToTile2D, distanceToTileZ, distanceToCenter3D, cameraVerticalFOV) {
        const pitchTileLoadingBehavior = 2 * ((maxZoomLevelsOnScreen - 1) /
            scaleZoom(Math.cos(degreesToRadians(maxMercatorHorizonAngle - cameraVerticalFOV)) /
                Math.cos(degreesToRadians(maxMercatorHorizonAngle))) - 1);
        const centerPitch = Math.acos(distanceToTileZ / distanceToCenter3D);
        const tileCountPitch0 = 2 * integralOfCosXByP(pitchTileLoadingBehavior - 1, 0, degreesToRadians(cameraVerticalFOV / 2));
        const highestPitch = Math.min(degreesToRadians(maxMercatorHorizonAngle), centerPitch + degreesToRadians(cameraVerticalFOV / 2));
        const lowestPitch = Math.min(highestPitch, centerPitch - degreesToRadians(cameraVerticalFOV / 2));
        const tileCount = integralOfCosXByP(pitchTileLoadingBehavior - 1, lowestPitch, highestPitch);
        const thisTilePitch = Math.atan(distanceToTile2D / distanceToTileZ);
        const distanceToTile3D = Math.hypot(distanceToTile2D, distanceToTileZ);
        let thisTileDesiredZ = requestedCenterZoom;
        thisTileDesiredZ = thisTileDesiredZ + scaleZoom(distanceToCenter3D / distanceToTile3D / Math.max(0.5, Math.cos(degreesToRadians(cameraVerticalFOV / 2))));
        thisTileDesiredZ += pitchTileLoadingBehavior * scaleZoom(Math.cos(thisTilePitch)) / 2;
        thisTileDesiredZ -= scaleZoom(Math.max(1, tileCount / tileCountPitch0 / tileCountMaxMinRatio)) / 2;
        return thisTileDesiredZ;
    };
}
const defaultMaxZoomLevelsOnScreen = 9.314;
const defaultTileCountMaxMinRatio = 3.0;
const defaultCalculateTileZoom = createCalculateTileZoomFunction(defaultMaxZoomLevelsOnScreen, defaultTileCountMaxMinRatio);
export function coveringZoomLevel(transform, options) {
    const z = (options.roundZoom ? Math.round : Math.floor)(transform.zoom + scaleZoom(transform.tileSize / options.tileSize));
    return Math.max(0, z);
}
export function coveringTiles(transform, options) {
    const frustum = transform.getCameraFrustum();
    const plane = transform.getClippingPlane();
    const cameraCoord = transform.screenPointToMercatorCoordinate(transform.getCameraPoint());
    const centerCoord = MercatorCoordinate.fromLngLat(transform.center, transform.elevation);
    cameraCoord.z = centerCoord.z + Math.cos(transform.pitchInRadians) * transform.cameraToCenterDistance / transform.worldSize;
    const detailsProvider = transform.getCoveringTilesDetailsProvider();
    const allowVariableZoom = detailsProvider.allowVariableZoom(transform, options);
    const desiredZ = coveringZoomLevel(transform, options);
    const minZoom = options.minzoom || 0;
    const maxZoom = options.maxzoom !== undefined ? options.maxzoom : transform.maxZoom;
    const nominalZ = Math.min(Math.max(0, desiredZ), maxZoom);
    const numTiles = Math.pow(2, nominalZ);
    const cameraPoint = [numTiles * cameraCoord.x, numTiles * cameraCoord.y, 0];
    const centerPoint = [numTiles * centerCoord.x, numTiles * centerCoord.y, 0];
    const distanceToCenter2d = Math.hypot(centerCoord.x - cameraCoord.x, centerCoord.y - cameraCoord.y);
    const distanceZ = Math.abs(centerCoord.z - cameraCoord.z);
    const distanceToCenter3d = Math.hypot(distanceToCenter2d, distanceZ);
    const newRootTile = (wrap) => {
        return {
            zoom: 0,
            x: 0,
            y: 0,
            wrap,
            fullyVisible: false
        };
    };
    const stack = [];
    const result = [];
    if (transform.renderWorldCopies && detailsProvider.allowWorldCopies()) {
        for (let i = 1; i <= 3; i++) {
            stack.push(newRootTile(-i));
            stack.push(newRootTile(i));
        }
    }
    stack.push(newRootTile(0));
    while (stack.length > 0) {
        const it = stack.pop();
        const x = it.x;
        const y = it.y;
        let fullyVisible = it.fullyVisible;
        const tileID = { x, y, z: it.zoom };
        const boundingVolume = detailsProvider.getTileBoundingVolume(tileID, it.wrap, transform.elevation, options);
        if (!fullyVisible) {
            const intersectResult = isTileVisible(frustum, boundingVolume, plane);
            if (intersectResult === 0)
                continue;
            fullyVisible = intersectResult === 2;
        }
        const distToTile2d = detailsProvider.distanceToTile2d(cameraCoord.x, cameraCoord.y, tileID, boundingVolume);
        let thisTileDesiredZ = desiredZ;
        if (allowVariableZoom) {
            const tileZoomFunc = options.calculateTileZoom || defaultCalculateTileZoom;
            thisTileDesiredZ = tileZoomFunc(transform.zoom + scaleZoom(transform.tileSize / options.tileSize), distToTile2d, distanceZ, distanceToCenter3d, transform.fov);
        }
        thisTileDesiredZ = (options.roundZoom ? Math.round : Math.floor)(thisTileDesiredZ);
        thisTileDesiredZ = Math.max(0, thisTileDesiredZ);
        const z = Math.min(thisTileDesiredZ, maxZoom);
        it.wrap = detailsProvider.getWrap(centerCoord, tileID, it.wrap);
        if (it.zoom >= z) {
            if (it.zoom < minZoom) {
                continue;
            }
            const dz = nominalZ - it.zoom;
            const dx = cameraPoint[0] - 0.5 - (x << dz);
            const dy = cameraPoint[1] - 0.5 - (y << dz);
            const overscaledZ = options.reparseOverscaled ? Math.max(it.zoom, thisTileDesiredZ) : it.zoom;
            result.push({
                tileID: new OverscaledTileID(it.zoom === maxZoom ? overscaledZ : it.zoom, it.wrap, it.zoom, x, y),
                distanceSq: vec2.sqrLen([centerPoint[0] - 0.5 - x, centerPoint[1] - 0.5 - y]),
                tileDistanceToCamera: Math.sqrt(dx * dx + dy * dy)
            });
            continue;
        }
        for (let i = 0; i < 4; i++) {
            const childX = (x << 1) + (i % 2);
            const childY = (y << 1) + (i >> 1);
            const childZ = it.zoom + 1;
            stack.push({ zoom: childZ, x: childX, y: childY, wrap: it.wrap, fullyVisible });
        }
    }
    return result.sort((a, b) => a.distanceSq - b.distanceSq).map(a => a.tileID);
}
//# sourceMappingURL=covering_tiles.js.map