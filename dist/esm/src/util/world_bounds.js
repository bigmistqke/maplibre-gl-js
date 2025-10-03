import { MAX_TILE_ZOOM, MIN_TILE_ZOOM } from './util';
import { MercatorCoordinate } from '../geo/mercator_coordinate';
export function isInBoundsForTileZoomXY(zoom, x, y) {
    return !(zoom < MIN_TILE_ZOOM ||
        zoom > MAX_TILE_ZOOM ||
        y < 0 ||
        y >= Math.pow(2, zoom) ||
        x < 0 ||
        x >= Math.pow(2, zoom));
}
export function isInBoundsForZoomLngLat(zoom, lnglat) {
    const { x, y } = MercatorCoordinate.fromLngLat(lnglat);
    return !(zoom < MIN_TILE_ZOOM ||
        zoom > MAX_TILE_ZOOM ||
        y < 0 ||
        y >= 1 ||
        x < 0 ||
        x >= 1);
}
//# sourceMappingURL=world_bounds.js.map