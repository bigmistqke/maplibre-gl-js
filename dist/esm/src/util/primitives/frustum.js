import { vec3, vec4 } from 'gl-matrix';
import { Aabb } from './aabb';
import { pointPlaneSignedDistance, rayPlaneIntersection } from '../util';
export class Frustum {
    constructor(points, planes, aabb) {
        this.points = points;
        this.planes = planes;
        this.aabb = aabb;
    }
    static fromInvProjectionMatrix(invProj, worldSize = 1, zoom = 0, horizonPlane, flippedNearFar) {
        const clipSpaceCorners = [
            [-1, 1, -1, 1],
            [1, 1, -1, 1],
            [1, -1, -1, 1],
            [-1, -1, -1, 1],
            [-1, 1, 1, 1],
            [1, 1, 1, 1],
            [1, -1, 1, 1],
            [-1, -1, 1, 1]
        ];
        const frustumPlanePointIndices = flippedNearFar ? [
            [6, 5, 4],
            [0, 1, 2],
            [0, 3, 7],
            [2, 1, 5],
            [3, 2, 6],
            [0, 4, 5]
        ] : [
            [0, 1, 2],
            [6, 5, 4],
            [0, 3, 7],
            [2, 1, 5],
            [3, 2, 6],
            [0, 4, 5]
        ];
        const scale = Math.pow(2, zoom);
        const frustumCoords = clipSpaceCorners.map(v => unprojectClipSpacePoint(v, invProj, worldSize, scale));
        if (horizonPlane) {
            adjustFarPlaneByHorizonPlane(frustumCoords, frustumPlanePointIndices[0], horizonPlane, flippedNearFar);
        }
        const frustumPlanes = frustumPlanePointIndices.map((p) => {
            const a = vec3.sub([], frustumCoords[p[0]], frustumCoords[p[1]]);
            const b = vec3.sub([], frustumCoords[p[2]], frustumCoords[p[1]]);
            const n = vec3.normalize([], vec3.cross([], a, b));
            const d = -vec3.dot(n, frustumCoords[p[1]]);
            return n.concat(d);
        });
        const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
        const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
        for (const p of frustumCoords) {
            for (let i = 0; i < 3; i++) {
                min[i] = Math.min(min[i], p[i]);
                max[i] = Math.max(max[i], p[i]);
            }
        }
        return new Frustum(frustumCoords, frustumPlanes, new Aabb(min, max));
    }
}
function unprojectClipSpacePoint(point, invProj, worldSize, scale) {
    const v = vec4.transformMat4([], point, invProj);
    const s = 1.0 / v[3] / worldSize * scale;
    return vec4.mul(v, v, [s, s, 1.0 / v[3], s]);
}
function adjustFarPlaneByHorizonPlane(frustumCoords, nearPlanePointsIndices, horizonPlane, flippedNearFar) {
    const nearPlanePointsOffset = flippedNearFar ? 4 : 0;
    const farPlanePointsOffset = flippedNearFar ? 0 : 4;
    let maxDist = 0;
    const cornerRayLengths = [];
    const cornerRayNormalizedDirections = [];
    for (let i = 0; i < 4; i++) {
        const dir = vec3.sub([], frustumCoords[i + farPlanePointsOffset], frustumCoords[i + nearPlanePointsOffset]);
        const len = vec3.length(dir);
        vec3.scale(dir, dir, 1.0 / len);
        cornerRayLengths.push(len);
        cornerRayNormalizedDirections.push(dir);
    }
    for (let i = 0; i < 4; i++) {
        const dist = rayPlaneIntersection(frustumCoords[i + nearPlanePointsOffset], cornerRayNormalizedDirections[i], horizonPlane);
        if (dist !== null && dist >= 0) {
            maxDist = Math.max(maxDist, dist);
        }
        else {
            maxDist = Math.max(maxDist, cornerRayLengths[i]);
        }
    }
    const nearPlaneNormalized = getNormalizedNearPlane(frustumCoords, nearPlanePointsIndices);
    const idealFarPlaneDistanceFromNearPlane = getIdealNearFarPlaneDistance(horizonPlane, nearPlaneNormalized);
    if (idealFarPlaneDistanceFromNearPlane !== null) {
        const idealCornerRayLength = idealFarPlaneDistanceFromNearPlane / vec3.dot(cornerRayNormalizedDirections[0], nearPlaneNormalized);
        maxDist = Math.min(maxDist, idealCornerRayLength);
    }
    for (let i = 0; i < 4; i++) {
        const targetLength = Math.min(maxDist, cornerRayLengths[i]);
        const newPoint = [
            frustumCoords[i + nearPlanePointsOffset][0] + cornerRayNormalizedDirections[i][0] * targetLength,
            frustumCoords[i + nearPlanePointsOffset][1] + cornerRayNormalizedDirections[i][1] * targetLength,
            frustumCoords[i + nearPlanePointsOffset][2] + cornerRayNormalizedDirections[i][2] * targetLength,
            1,
        ];
        frustumCoords[i + farPlanePointsOffset] = newPoint;
    }
}
function getNormalizedNearPlane(frustumCoords, nearPlanePointsIndices) {
    const nearPlaneA = vec3.sub([], frustumCoords[nearPlanePointsIndices[0]], frustumCoords[nearPlanePointsIndices[1]]);
    const nearPlaneB = vec3.sub([], frustumCoords[nearPlanePointsIndices[2]], frustumCoords[nearPlanePointsIndices[1]]);
    const nearPlaneNormalized = [0, 0, 0, 0];
    vec3.normalize(nearPlaneNormalized, vec3.cross([], nearPlaneA, nearPlaneB));
    nearPlaneNormalized[3] = -vec3.dot(nearPlaneNormalized, frustumCoords[nearPlanePointsIndices[0]]);
    return nearPlaneNormalized;
}
function getIdealNearFarPlaneDistance(horizonPlane, nearPlaneNormalized) {
    const horizonPlaneLen = vec3.len(horizonPlane);
    const normalizedHorizonPlane = vec4.scale([], horizonPlane, 1 / horizonPlaneLen);
    const projectedViewDirection = vec3.sub([], nearPlaneNormalized, vec3.scale([], normalizedHorizonPlane, vec3.dot(nearPlaneNormalized, normalizedHorizonPlane)));
    const projectedViewLength = vec3.len(projectedViewDirection);
    if (projectedViewLength > 0) {
        const horizonCircleRadius = Math.sqrt(1 - normalizedHorizonPlane[3] * normalizedHorizonPlane[3]);
        const horizonCircleCenter = vec3.scale([], normalizedHorizonPlane, -normalizedHorizonPlane[3]);
        const pointFurthestOnHorizonCircle = vec3.add([], horizonCircleCenter, vec3.scale([], projectedViewDirection, horizonCircleRadius / projectedViewLength));
        return pointPlaneSignedDistance(nearPlaneNormalized, pointFurthestOnHorizonCircle);
    }
    else {
        return null;
    }
}
//# sourceMappingURL=frustum.js.map