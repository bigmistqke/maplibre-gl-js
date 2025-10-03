import { type CoveringTilesOptionsInternal } from './covering_tiles';
import type { IReadonlyTransform } from '../transform_interface';
import type { MercatorCoordinate } from '../mercator_coordinate';
import type { CoveringTilesDetailsProvider } from './covering_tiles_details_provider';
import { ConvexVolume } from '../../util/primitives/convex_volume';
export declare class GlobeCoveringTilesDetailsProvider implements CoveringTilesDetailsProvider {
    private _boundingVolumeCache;
    prepareNextFrame(): void;
    distanceToTile2d(pointX: number, pointY: number, tileID: {
        x: number;
        y: number;
        z: number;
    }, _bv: ConvexVolume): number;
    getWrap(centerCoord: MercatorCoordinate, tileID: {
        x: number;
        y: number;
        z: number;
    }, _parentWrap: number): number;
    allowVariableZoom(transform: IReadonlyTransform, options: CoveringTilesOptionsInternal): boolean;
    allowWorldCopies(): boolean;
    getTileBoundingVolume(tileID: {
        x: number;
        y: number;
        z: number;
    }, wrap: number, elevation: number, options: CoveringTilesOptionsInternal): ConvexVolume;
    private _computeTileBoundingVolume;
}
//# sourceMappingURL=globe_covering_tiles_details_provider.d.ts.map