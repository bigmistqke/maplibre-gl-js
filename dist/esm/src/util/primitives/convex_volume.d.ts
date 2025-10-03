import { vec3, type vec4 } from 'gl-matrix';
import { type Frustum } from './frustum';
import { IntersectionResult, type IBoundingVolume } from './bounding_volume';
export declare class ConvexVolume implements IBoundingVolume {
    min: vec3;
    max: vec3;
    points: vec3[];
    planes: vec4[];
    constructor(points: vec3[], planes: vec4[], min: vec3, max: vec3);
    static fromAabb(min: vec3, max: vec3): ConvexVolume;
    static fromCenterSizeAngles(center: vec3, halfSize: vec3, angles: vec3): ConvexVolume;
    intersectsFrustum(frustum: Frustum): IntersectionResult;
    intersectsPlane(plane: vec4): IntersectionResult;
}
//# sourceMappingURL=convex_volume.d.ts.map