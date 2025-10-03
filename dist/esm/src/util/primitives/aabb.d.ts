import { vec3, type vec4 } from 'gl-matrix';
import { type Frustum } from './frustum';
import { IntersectionResult, type IBoundingVolume } from './bounding_volume';
export declare class Aabb implements IBoundingVolume {
    min: vec3;
    max: vec3;
    center: vec3;
    constructor(min_: vec3, max_: vec3);
    quadrant(index: number): Aabb;
    distanceX(point: Array<number>): number;
    distanceY(point: Array<number>): number;
    intersectsFrustum(frustum: Frustum): IntersectionResult;
    intersectsPlane(plane: vec4): IntersectionResult;
}
//# sourceMappingURL=aabb.d.ts.map