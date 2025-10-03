import { OverscaledTileID } from '../../source/tile_id';
import { type vec4 } from 'gl-matrix';
import type { IReadonlyTransform } from '../transform_interface';
import type { Terrain } from '../../render/terrain';
import type { Frustum } from '../../util/primitives/frustum';
import { type IBoundingVolume, IntersectionResult } from '../../util/primitives/bounding_volume';
export type CoveringTilesOptions = {
    minzoom?: number;
    maxzoom?: number;
    roundZoom?: boolean;
    tileSize: number;
};
export type CoveringTilesOptionsInternal = CoveringTilesOptions & {
    reparseOverscaled?: boolean;
    terrain?: Terrain;
    calculateTileZoom?: CalculateTileZoomFunction;
};
export type CalculateTileZoomFunction = (requestedCenterZoom: number, distanceToTile2D: number, distanceToTileZ: number, distanceToCenter3D: number, cameraVerticalFOV: number) => number;
export declare function isTileVisible(frustum: Frustum, tileBoundingVolume: IBoundingVolume, plane?: vec4): IntersectionResult;
export declare function createCalculateTileZoomFunction(maxZoomLevelsOnScreen: number, tileCountMaxMinRatio: number): CalculateTileZoomFunction;
export declare function coveringZoomLevel(transform: IReadonlyTransform, options: CoveringTilesOptions): number;
export declare function coveringTiles(transform: IReadonlyTransform, options: CoveringTilesOptionsInternal): OverscaledTileID[];
//# sourceMappingURL=covering_tiles.d.ts.map