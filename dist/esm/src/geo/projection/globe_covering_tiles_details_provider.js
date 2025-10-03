import { EXTENT } from '../../data/extent';
import { projectTileCoordinatesToSphere } from './globe_utils';
import { BoundingVolumeCache } from '../../util/primitives/bounding_volume_cache';
import { coveringZoomLevel } from './covering_tiles';
import { vec3 } from 'gl-matrix';
import { OverscaledTileID } from '../../source/tile_id';
import { earthRadius } from '../lng_lat';
import { ConvexVolume } from '../../util/primitives/convex_volume';
import { threePlaneIntersection } from '../../util/util';
function distanceToTileSimple(point, tile, tileSize) {
    const delta = point - tile;
    return (delta < 0) ? -delta : Math.max(0, delta - tileSize);
}
function distanceToTileWrapX(pointX, pointY, tileCornerX, tileCornerY, tileSize) {
    const tileCornerToPointX = pointX - tileCornerX;
    let distanceX;
    if (tileCornerToPointX < 0) {
        distanceX = Math.min(-tileCornerToPointX, 1.0 + tileCornerToPointX - tileSize);
    }
    else if (tileCornerToPointX > 1) {
        distanceX = Math.min(Math.max(tileCornerToPointX - tileSize, 0), 1.0 - tileCornerToPointX);
    }
    else {
        distanceX = 0;
    }
    return Math.max(distanceX, distanceToTileSimple(pointY, tileCornerY, tileSize));
}
export class GlobeCoveringTilesDetailsProvider {
    constructor() {
        this._boundingVolumeCache = new BoundingVolumeCache(this._computeTileBoundingVolume);
    }
    prepareNextFrame() {
        this._boundingVolumeCache.swapBuffers();
    }
    distanceToTile2d(pointX, pointY, tileID, _bv) {
        const scale = 1 << tileID.z;
        const tileMercatorSize = 1.0 / scale;
        const tileCornerX = tileID.x / scale;
        const tileCornerY = tileID.y / scale;
        const worldSize = 1.0;
        const halfWorld = 0.5 * worldSize;
        let smallestDistance = 2.0 * worldSize;
        smallestDistance = Math.min(smallestDistance, distanceToTileWrapX(pointX, pointY, tileCornerX, tileCornerY, tileMercatorSize));
        smallestDistance = Math.min(smallestDistance, distanceToTileWrapX(pointX, pointY, tileCornerX + halfWorld, -tileCornerY - tileMercatorSize, tileMercatorSize));
        smallestDistance = Math.min(smallestDistance, distanceToTileWrapX(pointX, pointY, tileCornerX + halfWorld, worldSize + worldSize - tileCornerY - tileMercatorSize, tileMercatorSize));
        return smallestDistance;
    }
    getWrap(centerCoord, tileID, _parentWrap) {
        const scale = 1 << tileID.z;
        const tileMercatorSize = 1.0 / scale;
        const tileX = tileID.x / scale;
        const distanceCurrent = distanceToTileSimple(centerCoord.x, tileX, tileMercatorSize);
        const distanceLeft = distanceToTileSimple(centerCoord.x, tileX - 1.0, tileMercatorSize);
        const distanceRight = distanceToTileSimple(centerCoord.x, tileX + 1.0, tileMercatorSize);
        const distanceSmallest = Math.min(distanceCurrent, distanceLeft, distanceRight);
        if (distanceSmallest === distanceRight) {
            return 1;
        }
        if (distanceSmallest === distanceLeft) {
            return -1;
        }
        return 0;
    }
    allowVariableZoom(transform, options) {
        return coveringZoomLevel(transform, options) > 4;
    }
    allowWorldCopies() {
        return false;
    }
    getTileBoundingVolume(tileID, wrap, elevation, options) {
        return this._boundingVolumeCache.getTileBoundingVolume(tileID, wrap, elevation, options);
    }
    _computeTileBoundingVolume(tileID, wrap, elevation, options) {
        var _a, _b;
        let minElevation = 0;
        let maxElevation = 0;
        if (options === null || options === void 0 ? void 0 : options.terrain) {
            const overscaledTileID = new OverscaledTileID(tileID.z, wrap, tileID.z, tileID.x, tileID.y);
            const minMax = options.terrain.getMinMaxElevation(overscaledTileID);
            minElevation = (_a = minMax.minElevation) !== null && _a !== void 0 ? _a : Math.min(0, elevation);
            maxElevation = (_b = minMax.maxElevation) !== null && _b !== void 0 ? _b : Math.max(0, elevation);
        }
        minElevation /= earthRadius;
        maxElevation /= earthRadius;
        minElevation += 1;
        maxElevation += 1;
        if (tileID.z <= 0) {
            return ConvexVolume.fromAabb([-maxElevation, -maxElevation, -maxElevation], [maxElevation, maxElevation, maxElevation]);
        }
        else if (tileID.z === 1) {
            return ConvexVolume.fromAabb([tileID.x === 0 ? -maxElevation : 0, tileID.y === 0 ? 0 : -maxElevation, -maxElevation], [tileID.x === 0 ? 0 : maxElevation, tileID.y === 0 ? maxElevation : 0, maxElevation]);
        }
        else {
            const corners = [
                projectTileCoordinatesToSphere(0, 0, tileID.x, tileID.y, tileID.z),
                projectTileCoordinatesToSphere(EXTENT, 0, tileID.x, tileID.y, tileID.z),
                projectTileCoordinatesToSphere(EXTENT, EXTENT, tileID.x, tileID.y, tileID.z),
                projectTileCoordinatesToSphere(0, EXTENT, tileID.x, tileID.y, tileID.z),
            ];
            const extremesPoints = [];
            for (const c of corners) {
                extremesPoints.push(vec3.scale([], c, maxElevation));
            }
            if (maxElevation !== minElevation) {
                for (const c of corners) {
                    extremesPoints.push(vec3.scale([], c, minElevation));
                }
            }
            if (tileID.y === 0) {
                extremesPoints.push([0, 1, 0]);
            }
            if (tileID.y === (1 << tileID.z) - 1) {
                extremesPoints.push([0, -1, 0]);
            }
            const aabbMin = [1, 1, 1];
            const aabbMax = [-1, -1, -1];
            for (const c of extremesPoints) {
                for (let i = 0; i < 3; i++) {
                    aabbMin[i] = Math.min(aabbMin[i], c[i]);
                    aabbMax[i] = Math.max(aabbMax[i], c[i]);
                }
            }
            const center = projectTileCoordinatesToSphere(EXTENT / 2, EXTENT / 2, tileID.x, tileID.y, tileID.z);
            const centerEast = vec3.cross([], [0, 1, 0], center);
            vec3.normalize(centerEast, centerEast);
            const north = vec3.cross([], center, centerEast);
            vec3.normalize(north, north);
            const axisEast = vec3.cross([], corners[2], corners[1]);
            vec3.normalize(axisEast, axisEast);
            const axisWest = vec3.cross([], corners[0], corners[3]);
            vec3.normalize(axisWest, axisWest);
            extremesPoints.push(vec3.scale([], center, maxElevation));
            if (tileID.y >= (1 << tileID.z) / 2) {
                extremesPoints.push(vec3.scale([], projectTileCoordinatesToSphere(EXTENT / 2, 0, tileID.x, tileID.y, tileID.z), maxElevation));
            }
            if (tileID.y < (1 << tileID.z) / 2) {
                extremesPoints.push(vec3.scale([], projectTileCoordinatesToSphere(EXTENT / 2, EXTENT, tileID.x, tileID.y, tileID.z), maxElevation));
            }
            const upDownMinMax = findAxisMinMax(center, extremesPoints);
            const northSouthMinMax = findAxisMinMax(north, extremesPoints);
            const planeUp = [-center[0], -center[1], -center[2], upDownMinMax.max];
            const planeDown = [center[0], center[1], center[2], -upDownMinMax.min];
            const planeNorth = [-north[0], -north[1], -north[2], northSouthMinMax.max];
            const planeSouth = [north[0], north[1], north[2], -northSouthMinMax.min];
            const planeEast = [...axisEast, 0];
            const planeWest = [...axisWest, 0];
            const points = [];
            if (tileID.y === 0) {
                points.push(threePlaneIntersection(planeWest, planeEast, planeUp), threePlaneIntersection(planeWest, planeEast, planeDown));
            }
            else {
                points.push(threePlaneIntersection(planeNorth, planeEast, planeUp), threePlaneIntersection(planeNorth, planeEast, planeDown), threePlaneIntersection(planeNorth, planeWest, planeUp), threePlaneIntersection(planeNorth, planeWest, planeDown));
            }
            if (tileID.y === (1 << tileID.z) - 1) {
                points.push(threePlaneIntersection(planeWest, planeEast, planeUp), threePlaneIntersection(planeWest, planeEast, planeDown));
            }
            else {
                points.push(threePlaneIntersection(planeSouth, planeEast, planeUp), threePlaneIntersection(planeSouth, planeEast, planeDown), threePlaneIntersection(planeSouth, planeWest, planeUp), threePlaneIntersection(planeSouth, planeWest, planeDown));
            }
            return new ConvexVolume(points, [
                planeUp,
                planeDown,
                planeNorth,
                planeSouth,
                planeEast,
                planeWest
            ], aabbMin, aabbMax);
        }
    }
}
function findAxisMinMax(axis, points) {
    let min = +Infinity;
    let max = -Infinity;
    for (const c of points) {
        const dot = vec3.dot(axis, c);
        min = Math.min(min, dot);
        max = Math.max(max, dot);
    }
    return {
        min,
        max
    };
}
//# sourceMappingURL=globe_covering_tiles_details_provider.js.map