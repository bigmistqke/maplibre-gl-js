import { OverscaledTileID } from '../../source/tile_id';
import { Aabb } from '../../util/primitives/aabb';
import { clamp } from '../../util/util';
export class MercatorCoveringTilesDetailsProvider {
    distanceToTile2d(pointX, pointY, _tileID, aabb) {
        const distanceX = aabb.distanceX([pointX, pointY]);
        const distanceY = aabb.distanceY([pointX, pointY]);
        return Math.hypot(distanceX, distanceY);
    }
    getWrap(centerCoord, tileID, parentWrap) {
        return parentWrap;
    }
    getTileBoundingVolume(tileID, wrap, elevation, options) {
        var _a, _b;
        let minElevation = 0;
        let maxElevation = 0;
        if (options === null || options === void 0 ? void 0 : options.terrain) {
            const overscaledTileID = new OverscaledTileID(tileID.z, wrap, tileID.z, tileID.x, tileID.y);
            const minMax = options.terrain.getMinMaxElevation(overscaledTileID);
            minElevation = (_a = minMax.minElevation) !== null && _a !== void 0 ? _a : Math.min(0, elevation);
            maxElevation = (_b = minMax.maxElevation) !== null && _b !== void 0 ? _b : Math.max(0, elevation);
        }
        const numTiles = 1 << tileID.z;
        return new Aabb([wrap + tileID.x / numTiles, tileID.y / numTiles, minElevation], [wrap + (tileID.x + 1) / numTiles, (tileID.y + 1) / numTiles, maxElevation]);
    }
    allowVariableZoom(transform, options) {
        const zfov = transform.fov * (Math.abs(Math.cos(transform.rollInRadians)) * transform.height + Math.abs(Math.sin(transform.rollInRadians)) * transform.width) / transform.height;
        const maxConstantZoomPitch = clamp(78.5 - zfov / 2, 0.0, 60.0);
        return (!!options.terrain || transform.pitch > maxConstantZoomPitch);
    }
    allowWorldCopies() {
        return true;
    }
    prepareNextFrame() {
    }
}
//# sourceMappingURL=mercator_covering_tiles_details_provider.js.map