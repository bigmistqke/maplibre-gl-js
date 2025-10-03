var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { ImageRequest } from '../util/image_request';
import { extend, isImageBitmap, readImageUsingVideoFrame } from '../util/util';
import { browser } from '../util/browser';
import { offscreenCanvasSupported } from '../util/offscreen_canvas_supported';
import { OverscaledTileID } from './tile_id';
import { RasterTileSource } from './raster_tile_source';
import '../data/dem_data';
import { isOffscreenCanvasDistorted } from '../util/offscreen_canvas_distorted';
import { RGBAImage } from '../util/image';
export class RasterDEMTileSource extends RasterTileSource {
    constructor(id, options, dispatcher, eventedParent) {
        super(id, options, dispatcher, eventedParent);
        this.type = 'raster-dem';
        this.maxzoom = 22;
        this._options = extend({ type: 'raster-dem' }, options);
        this.encoding = options.encoding || 'mapbox';
        this.redFactor = options.redFactor;
        this.greenFactor = options.greenFactor;
        this.blueFactor = options.blueFactor;
        this.baseShift = options.baseShift;
    }
    loadTile(tile) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = tile.tileID.canonical.url(this.tiles, this.map.getPixelRatio(), this.scheme);
            const request = this.map._requestManager.transformRequest(url, "Tile");
            tile.neighboringTiles = this._getNeighboringTiles(tile.tileID);
            tile.abortController = new AbortController();
            try {
                const response = yield ImageRequest.getImage(request, tile.abortController, this.map._refreshExpiredTiles);
                delete tile.abortController;
                if (tile.aborted) {
                    tile.state = 'unloaded';
                    return;
                }
                if (response && response.data) {
                    const img = response.data;
                    if (this.map._refreshExpiredTiles && (response.cacheControl || response.expires)) {
                        tile.setExpiryData({ cacheControl: response.cacheControl, expires: response.expires });
                    }
                    const transfer = isImageBitmap(img) && offscreenCanvasSupported();
                    const rawImageData = transfer ? img : yield this.readImageNow(img);
                    const params = {
                        type: this.type,
                        uid: tile.uid,
                        source: this.id,
                        rawImageData,
                        encoding: this.encoding,
                        redFactor: this.redFactor,
                        greenFactor: this.greenFactor,
                        blueFactor: this.blueFactor,
                        baseShift: this.baseShift
                    };
                    if (!tile.actor || tile.state === 'expired') {
                        tile.actor = this.dispatcher.getActor();
                        const data = yield tile.actor.sendAsync({ type: "LDT", data: params });
                        tile.dem = data;
                        tile.needsHillshadePrepare = true;
                        tile.needsTerrainPrepare = true;
                        tile.state = 'loaded';
                    }
                }
            }
            catch (err) {
                delete tile.abortController;
                if (tile.aborted) {
                    tile.state = 'unloaded';
                }
                else if (err) {
                    tile.state = 'errored';
                    throw err;
                }
            }
        });
    }
    readImageNow(img) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof VideoFrame !== 'undefined' && isOffscreenCanvasDistorted()) {
                const width = img.width + 2;
                const height = img.height + 2;
                try {
                    return new RGBAImage({ width, height }, yield readImageUsingVideoFrame(img, -1, -1, width, height));
                }
                catch (_a) {
                }
            }
            return browser.getImageData(img, 1);
        });
    }
    _getNeighboringTiles(tileID) {
        const canonical = tileID.canonical;
        const dim = Math.pow(2, canonical.z);
        const px = (canonical.x - 1 + dim) % dim;
        const pxw = canonical.x === 0 ? tileID.wrap - 1 : tileID.wrap;
        const nx = (canonical.x + 1 + dim) % dim;
        const nxw = canonical.x + 1 === dim ? tileID.wrap + 1 : tileID.wrap;
        const neighboringTiles = {};
        neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y).key] = { backfilled: false };
        neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y).key] = { backfilled: false };
        if (canonical.y > 0) {
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y - 1).key] = { backfilled: false };
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, tileID.wrap, canonical.z, canonical.x, canonical.y - 1).key] = { backfilled: false };
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y - 1).key] = { backfilled: false };
        }
        if (canonical.y + 1 < dim) {
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y + 1).key] = { backfilled: false };
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, tileID.wrap, canonical.z, canonical.x, canonical.y + 1).key] = { backfilled: false };
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y + 1).key] = { backfilled: false };
        }
        return neighboringTiles;
    }
    unloadTile(tile) {
        return __awaiter(this, void 0, void 0, function* () {
            if (tile.demTexture)
                this.map.painter.saveTileTexture(tile.demTexture);
            if (tile.fbo) {
                tile.fbo.destroy();
                delete tile.fbo;
            }
            if (tile.dem)
                delete tile.dem;
            delete tile.neighboringTiles;
            tile.state = 'unloaded';
            if (tile.actor) {
                yield tile.actor.sendAsync({ type: "RDT", data: { type: this.type, uid: tile.uid, source: this.id } });
            }
        });
    }
}
//# sourceMappingURL=raster_dem_tile_source.js.map