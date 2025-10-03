import { vec3 } from 'gl-matrix';
export class Aabb {
    constructor(min_, max_) {
        this.min = min_;
        this.max = max_;
        this.center = vec3.scale([], vec3.add([], this.min, this.max), 0.5);
    }
    quadrant(index) {
        const split = [(index % 2) === 0, index < 2];
        const qMin = vec3.clone(this.min);
        const qMax = vec3.clone(this.max);
        for (let axis = 0; axis < split.length; axis++) {
            qMin[axis] = split[axis] ? this.min[axis] : this.center[axis];
            qMax[axis] = split[axis] ? this.center[axis] : this.max[axis];
        }
        qMax[2] = this.max[2];
        return new Aabb(qMin, qMax);
    }
    distanceX(point) {
        const pointOnAabb = Math.max(Math.min(this.max[0], point[0]), this.min[0]);
        return pointOnAabb - point[0];
    }
    distanceY(point) {
        const pointOnAabb = Math.max(Math.min(this.max[1], point[1]), this.min[1]);
        return pointOnAabb - point[1];
    }
    intersectsFrustum(frustum) {
        let fullyInside = true;
        for (let p = 0; p < frustum.planes.length; p++) {
            const planeIntersection = this.intersectsPlane(frustum.planes[p]);
            if (planeIntersection === 0) {
                return 0;
            }
            if (planeIntersection === 1) {
                fullyInside = false;
            }
        }
        if (fullyInside) {
            return 2;
        }
        if (frustum.aabb.min[0] > this.max[0] || frustum.aabb.min[1] > this.max[1] || frustum.aabb.min[2] > this.max[2] ||
            frustum.aabb.max[0] < this.min[0] || frustum.aabb.max[1] < this.min[1] || frustum.aabb.max[2] < this.min[2]) {
            return 0;
        }
        return 1;
    }
    intersectsPlane(plane) {
        let distMin = plane[3];
        let distMax = plane[3];
        for (let i = 0; i < 3; i++) {
            if (plane[i] > 0) {
                distMin += plane[i] * this.min[i];
                distMax += plane[i] * this.max[i];
            }
            else {
                distMax += plane[i] * this.min[i];
                distMin += plane[i] * this.max[i];
            }
        }
        if (distMin >= 0) {
            return 2;
        }
        if (distMax < 0) {
            return 0;
        }
        return 1;
    }
}
//# sourceMappingURL=aabb.js.map