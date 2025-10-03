import { quat, vec3 } from 'gl-matrix';
export class ConvexVolume {
    constructor(points, planes, min, max) {
        this.min = min;
        this.max = max;
        this.points = points;
        this.planes = planes;
    }
    static fromAabb(min, max) {
        const points = [];
        for (let i = 0; i < 8; i++) {
            points.push([
                ((i >> 0) & 1) === 1 ? max[0] : min[0],
                ((i >> 1) & 1) === 1 ? max[1] : min[1],
                ((i >> 2) & 1) === 1 ? max[2] : min[2]
            ]);
        }
        return new ConvexVolume(points, [
            [-1, 0, 0, max[0]],
            [1, 0, 0, -min[0]],
            [0, -1, 0, max[1]],
            [0, 1, 0, -min[1]],
            [0, 0, -1, max[2]],
            [0, 0, 1, -min[2]]
        ], min, max);
    }
    static fromCenterSizeAngles(center, halfSize, angles) {
        const q = quat.fromEuler([], angles[0], angles[1], angles[2]);
        const axisX = vec3.transformQuat([], [halfSize[0], 0, 0], q);
        const axisY = vec3.transformQuat([], [0, halfSize[1], 0], q);
        const axisZ = vec3.transformQuat([], [0, 0, halfSize[2]], q);
        const min = [...center];
        const max = [...center];
        for (let i = 0; i < 8; i++) {
            for (let axis = 0; axis < 3; axis++) {
                const point = center[axis]
                    + axisX[axis] * ((((i >> 0) & 1) === 1) ? 1 : -1)
                    + axisY[axis] * ((((i >> 1) & 1) === 1) ? 1 : -1)
                    + axisZ[axis] * ((((i >> 2) & 1) === 1) ? 1 : -1);
                min[axis] = Math.min(min[axis], point);
                max[axis] = Math.max(max[axis], point);
            }
        }
        const points = [];
        for (let i = 0; i < 8; i++) {
            const p = [...center];
            vec3.add(p, p, vec3.scale([], axisX, ((i >> 0) & 1) === 1 ? 1 : -1));
            vec3.add(p, p, vec3.scale([], axisY, ((i >> 1) & 1) === 1 ? 1 : -1));
            vec3.add(p, p, vec3.scale([], axisZ, ((i >> 2) & 1) === 1 ? 1 : -1));
            points.push(p);
        }
        return new ConvexVolume(points, [
            [...axisX, -vec3.dot(axisX, points[0])],
            [...axisY, -vec3.dot(axisY, points[0])],
            [...axisZ, -vec3.dot(axisZ, points[0])],
            [-axisX[0], -axisX[1], -axisX[2], -vec3.dot(axisX, points[7])],
            [-axisY[0], -axisY[1], -axisY[2], -vec3.dot(axisY, points[7])],
            [-axisZ[0], -axisZ[1], -axisZ[2], -vec3.dot(axisZ, points[7])],
        ], min, max);
    }
    intersectsFrustum(frustum) {
        let fullyInside = true;
        const boxPointCount = this.points.length;
        const boxPlaneCount = this.planes.length;
        const frustumPlaneCount = frustum.planes.length;
        const frustumPointCount = frustum.points.length;
        for (let i = 0; i < frustumPlaneCount; i++) {
            const plane = frustum.planes[i];
            let boxPointsPassed = 0;
            for (let j = 0; j < boxPointCount; j++) {
                const point = this.points[j];
                if (plane[0] * point[0] + plane[1] * point[1] + plane[2] * point[2] + plane[3] >= 0) {
                    boxPointsPassed++;
                }
            }
            if (boxPointsPassed === 0) {
                return 0;
            }
            if (boxPointsPassed < boxPointCount) {
                fullyInside = false;
            }
        }
        if (fullyInside) {
            return 2;
        }
        for (let i = 0; i < boxPlaneCount; i++) {
            const plane = this.planes[i];
            let frustumPointsPassed = 0;
            for (let j = 0; j < frustumPointCount; j++) {
                const point = frustum.points[j];
                if (plane[0] * point[0] + plane[1] * point[1] + plane[2] * point[2] + plane[3] >= 0) {
                    frustumPointsPassed++;
                }
            }
            if (frustumPointsPassed === 0) {
                return 0;
            }
        }
        return 1;
    }
    intersectsPlane(plane) {
        const pointCount = this.points.length;
        let positivePoints = 0;
        for (let i = 0; i < pointCount; i++) {
            const point = this.points[i];
            if (plane[0] * point[0] + plane[1] * point[1] + plane[2] * point[2] + plane[3] >= 0) {
                positivePoints++;
            }
        }
        if (positivePoints === pointCount) {
            return 2;
        }
        if (positivePoints === 0) {
            return 0;
        }
        return 1;
    }
}
//# sourceMappingURL=convex_volume.js.map