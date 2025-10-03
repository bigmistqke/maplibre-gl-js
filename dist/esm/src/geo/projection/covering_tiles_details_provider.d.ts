import { type IBoundingVolume } from '../../util/primitives/bounding_volume';
import { type MercatorCoordinate } from '../mercator_coordinate';
import { type IReadonlyTransform } from '../transform_interface';
import { type CoveringTilesOptionsInternal } from './covering_tiles';
export interface CoveringTilesDetailsProvider {
    distanceToTile2d: (pointX: number, pointY: number, tileID: {
        x: number;
        y: number;
        z: number;
    }, boundingVolume: IBoundingVolume) => number;
    getWrap: (centerCoord: MercatorCoordinate, tileID: {
        x: number;
        y: number;
        z: number;
    }, parentWrap: number) => number;
    getTileBoundingVolume: (tileID: {
        x: number;
        y: number;
        z: number;
    }, wrap: number, elevation: number, options: CoveringTilesOptionsInternal) => IBoundingVolume;
    allowVariableZoom: (transform: IReadonlyTransform, options: CoveringTilesOptionsInternal) => boolean;
    allowWorldCopies: () => boolean;
    prepareNextFrame(): void;
}
//# sourceMappingURL=covering_tiles_details_provider.d.ts.map