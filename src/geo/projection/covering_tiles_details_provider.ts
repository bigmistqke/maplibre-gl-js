import {type IBoundingVolume} from '../../util/primitives/bounding_volume';
import {type MercatorCoordinate} from '../mercator_coordinate';
import {type IReadonlyTransform} from '../transform_interface';
import {type CoveringTilesOptionsInternal} from './covering_tiles';

// Default generic is `any` because callers (covering_tiles.ts) pass bounding volumes
// from getTileBoundingVolume back to distanceToTile2d on the same provider,
// so the concrete type is self-consistent at runtime. Using IBoundingVolume as default
// would fail due to generic invariance (TBoundingVolume appears in both parameter and return positions).
export interface CoveringTilesDetailsProvider<TBoundingVolume extends IBoundingVolume = any> {
    /**
     * Returns the distance from the point to the tile
     * @param pointX - point x.
     * @param pointY - point y.
     * @param tileID - Tile x, y and z for zoom.
     * @param boundingVolume - tile bounding volume
     */
    distanceToTile2d: (pointX: number, pointY: number, tileID: {x: number; y: number; z: number}, boundingVolume: TBoundingVolume) => number;

    /**
     * Returns the wrap value for a given tile.
     */
    getWrap: (centerCoord: MercatorCoordinate, tileID: {x:number; y: number; z: number}, parentWrap: number) => number;

    /**
     * Returns the bounding volume of the specified tile.
     * @param tileID - Tile x, y and z for zoom.
     * @param wrap - wrap number of the tile.
     * @param elevation - camera center point elevation.
     * @param options - CoveringTilesOptions.
     */
    getTileBoundingVolume: (tileID: {x: number; y: number; z: number}, wrap: number, elevation: number, options: CoveringTilesOptionsInternal) => TBoundingVolume;

    /**
     * Whether to allow variable zoom, which is used at high pitch angle to avoid loading an excessive amount of tiles.
     */
    allowVariableZoom: (transform: IReadonlyTransform, options: CoveringTilesOptionsInternal) => boolean;

    /**
     * Whether to allow world copies to be rendered.
     */
    allowWorldCopies: () => boolean;

    /**
     * Prepare cache for the next frame.
     */
    prepareNextFrame(): void;
}
