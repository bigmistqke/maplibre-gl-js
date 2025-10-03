var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { extend, pick } from '../util/util';
import { ImageRequest } from '../util/image_request';
import { Event, ErrorEvent, Evented } from '../util/evented';
import { loadTileJson } from './load_tilejson';
import { TileBounds } from './tile_bounds';
import { Texture } from '../render/texture';
export class RasterTileSource extends Evented {
    constructor(id, options, dispatcher, eventedParent) {
        super();
        this.id = id;
        this.dispatcher = dispatcher;
        this.setEventedParent(eventedParent);
        this.type = 'raster';
        this.minzoom = 0;
        this.maxzoom = 22;
        this.roundZoom = true;
        this.scheme = 'xyz';
        this.tileSize = 512;
        this._loaded = false;
        this._options = extend({ type: 'raster' }, options);
        extend(this, pick(options, ['url', 'scheme', 'tileSize']));
    }
    load() {
        return __awaiter(this, arguments, void 0, function* (sourceDataChanged = false) {
            this._loaded = false;
            this.fire(new Event('dataloading', { dataType: 'source' }));
            this._tileJSONRequest = new AbortController();
            try {
                const tileJSON = yield loadTileJson(this._options, this.map._requestManager, this._tileJSONRequest);
                this._tileJSONRequest = null;
                this._loaded = true;
                if (tileJSON) {
                    extend(this, tileJSON);
                    if (tileJSON.bounds)
                        this.tileBounds = new TileBounds(tileJSON.bounds, this.minzoom, this.maxzoom);
                    this.fire(new Event('data', { dataType: 'source', sourceDataType: 'metadata' }));
                    this.fire(new Event('data', { dataType: 'source', sourceDataType: 'content', sourceDataChanged }));
                }
            }
            catch (err) {
                this._tileJSONRequest = null;
                this._loaded = true;
                this.fire(new ErrorEvent(err));
            }
        });
    }
    loaded() {
        return this._loaded;
    }
    onAdd(map) {
        this.map = map;
        this.load();
    }
    onRemove() {
        if (this._tileJSONRequest) {
            this._tileJSONRequest.abort();
            this._tileJSONRequest = null;
        }
    }
    setSourceProperty(callback) {
        if (this._tileJSONRequest) {
            this._tileJSONRequest.abort();
            this._tileJSONRequest = null;
        }
        callback();
        this.load(true);
    }
    setTiles(tiles) {
        this.setSourceProperty(() => {
            this._options.tiles = tiles;
        });
        return this;
    }
    setUrl(url) {
        this.setSourceProperty(() => {
            this.url = url;
            this._options.url = url;
        });
        return this;
    }
    serialize() {
        return extend({}, this._options);
    }
    hasTile(tileID) {
        return !this.tileBounds || this.tileBounds.contains(tileID.canonical);
    }
    loadTile(tile) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = tile.tileID.canonical.url(this.tiles, this.map.getPixelRatio(), this.scheme);
            tile.abortController = new AbortController();
            try {
                const response = yield ImageRequest.getImage(this.map._requestManager.transformRequest(url, "Tile"), tile.abortController, this.map._refreshExpiredTiles);
                delete tile.abortController;
                if (tile.aborted) {
                    tile.state = 'unloaded';
                    return;
                }
                if (response && response.data) {
                    if (this.map._refreshExpiredTiles && (response.cacheControl || response.expires)) {
                        tile.setExpiryData({ cacheControl: response.cacheControl, expires: response.expires });
                    }
                    const context = this.map.painter.context;
                    const gl = context.gl;
                    const img = response.data;
                    tile.texture = this.map.painter.getTileTexture(img.width);
                    if (tile.texture) {
                        tile.texture.update(img, { useMipmap: true });
                    }
                    else {
                        tile.texture = new Texture(context, img, gl.RGBA, { useMipmap: true });
                        tile.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);
                    }
                    tile.state = 'loaded';
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
    abortTile(tile) {
        return __awaiter(this, void 0, void 0, function* () {
            if (tile.abortController) {
                tile.abortController.abort();
                delete tile.abortController;
            }
        });
    }
    unloadTile(tile) {
        return __awaiter(this, void 0, void 0, function* () {
            if (tile.texture) {
                this.map.painter.saveTileTexture(tile.texture);
            }
        });
    }
    hasTransition() {
        return false;
    }
}
//# sourceMappingURL=raster_tile_source.js.map