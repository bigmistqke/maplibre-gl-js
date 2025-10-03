import { type mat4, vec4 } from 'gl-matrix';
import { Aabb } from './aabb';
export declare class Frustum {
    points: vec4[];
    planes: vec4[];
    aabb: Aabb;
    constructor(points: vec4[], planes: vec4[], aabb: Aabb);
    static fromInvProjectionMatrix(invProj: mat4, worldSize?: number, zoom?: number, horizonPlane?: vec4, flippedNearFar?: boolean): Frustum;
}
//# sourceMappingURL=frustum.d.ts.map