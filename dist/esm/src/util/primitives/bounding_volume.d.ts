import { type vec4 } from 'gl-matrix';
import { type Frustum } from './frustum';
export declare const enum IntersectionResult {
    None = 0,
    Partial = 1,
    Full = 2
}
export interface IBoundingVolume {
    intersectsFrustum(frustum: Frustum): IntersectionResult;
    intersectsPlane(plane: vec4): IntersectionResult;
}
//# sourceMappingURL=bounding_volume.d.ts.map