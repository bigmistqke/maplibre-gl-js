import { EXTENT } from '../data/extent';
export function pixelsToTileUnits(tile, pixelValue, z) {
    return pixelValue * (EXTENT / (tile.tileSize * Math.pow(2, z - tile.tileID.overscaledZ)));
}
//# sourceMappingURL=pixels_to_tile_units.js.map