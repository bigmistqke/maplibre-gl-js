import type { mat4 } from 'gl-matrix';
import type { OverscaledTileID } from '../../source/tile_id';
export type ProjectionData = {
    mainMatrix: mat4;
    tileMercatorCoords: [number, number, number, number];
    clippingPlane: [number, number, number, number];
    projectionTransition: number;
    fallbackMatrix: mat4;
};
export type ProjectionDataParams = {
    overscaledTileID: OverscaledTileID | null;
    aligned?: boolean;
    applyTerrainMatrix?: boolean;
    applyGlobeMatrix?: boolean;
};
//# sourceMappingURL=projection_data.d.ts.map