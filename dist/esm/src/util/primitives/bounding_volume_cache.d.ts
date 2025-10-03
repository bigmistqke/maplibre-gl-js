import { type CoveringTilesOptionsInternal } from '../../geo/projection/covering_tiles';
import { type IBoundingVolume } from './bounding_volume';
type BoundingVolumeFactory<T extends IBoundingVolume> = (tileID: {
    x: number;
    y: number;
    z: number;
}, wrap: number, elevation: number, options: CoveringTilesOptionsInternal) => T;
export declare class BoundingVolumeCache<T extends IBoundingVolume> {
    private _cachePrevious;
    private _cache;
    private _hadAnyChanges;
    private _boundingVolumeFactory;
    constructor(boundingVolumeFactory: BoundingVolumeFactory<T>);
    swapBuffers(): void;
    getTileBoundingVolume(tileID: {
        x: number;
        y: number;
        z: number;
    }, wrap: number, elevation: number, options: CoveringTilesOptionsInternal): T;
}
export {};
//# sourceMappingURL=bounding_volume_cache.d.ts.map