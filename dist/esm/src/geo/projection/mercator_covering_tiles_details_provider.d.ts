import { Aabb } from '../../util/primitives/aabb';
import { type MercatorCoordinate } from '../mercator_coordinate';
import { type IReadonlyTransform } from '../transform_interface';
import { type CoveringTilesOptionsInternal } from './covering_tiles';
import { type CoveringTilesDetailsProvider } from './covering_tiles_details_provider';
export declare class MercatorCoveringTilesDetailsProvider implements CoveringTilesDetailsProvider {
    distanceToTile2d(pointX: number, pointY: number, _tileID: {
        x: number;
        y: number;
        z: number;
    }, aabb: Aabb): number;
    getWrap(centerCoord: MercatorCoordinate, tileID: {
        x: number;
        y: number;
        z: number;
    }, parentWrap: number): number;
    getTileBoundingVolume(tileID: {
        x: number;
        y: number;
        z: number;
    }, wrap: number, elevation: number, options: CoveringTilesOptionsInternal): Aabb;
    allowVariableZoom(transform: IReadonlyTransform, options: CoveringTilesOptionsInternal): boolean;
    allowWorldCopies(): boolean;
    prepareNextFrame(): void;
}
//# sourceMappingURL=mercator_covering_tiles_details_provider.d.ts.map