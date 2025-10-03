var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Event, ErrorEvent, Evented } from '../util/evented';
import { extend, pick } from '../util/util';
import { loadTileJson } from './load_tilejson';
import { TileBounds } from './tile_bounds';
export class VectorTileSource extends Evented {
    constructor(id, options, dispatcher, eventedParent) {
        super();
        this.id = id;
        this.dispatcher = dispatcher;
        this.type = 'vector';
        this.minzoom = 0;
        this.maxzoom = 22;
        this.scheme = 'xyz';
        this.tileSize = 512;
        this.reparseOverscaled = true;
        this.isTileClipped = true;
        this._loaded = false;
        extend(this, pick(options, ['url', 'scheme', 'tileSize', 'promoteId']));
        this._options = extend({ type: 'vector' }, options);
        this._collectResourceTiming = options.collectResourceTiming;
        if (this.tileSize !== 512) {
            throw new Error('vector tile sources must have a tileSize of 512');
        }
        this.setEventedParent(eventedParent);
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this._loaded = false;
            this.fire(new Event('dataloading', { dataType: 'source' }));
            this._tileJSONRequest = new AbortController();
            try {
                const tileJSON = yield loadTileJson(this._options, this.map._requestManager, this._tileJSONRequest);
                this._tileJSONRequest = null;
                this._loaded = true;
                this.map.style.sourceCaches[this.id].clearTiles();
                if (tileJSON) {
                    extend(this, tileJSON);
                    if (tileJSON.bounds)
                        this.tileBounds = new TileBounds(tileJSON.bounds, this.minzoom, this.maxzoom);
                    this.fire(new Event('data', { dataType: 'source', sourceDataType: 'metadata' }));
                    this.fire(new Event('data', { dataType: 'source', sourceDataType: 'content' }));
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
    hasTile(tileID) {
        return !this.tileBounds || this.tileBounds.contains(tileID.canonical);
    }
    onAdd(map) {
        this.map = map;
        this.load();
    }
    setSourceProperty(callback) {
        if (this._tileJSONRequest) {
            this._tileJSONRequest.abort();
        }
        callback();
        this.load();
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
    onRemove() {
        if (this._tileJSONRequest) {
            this._tileJSONRequest.abort();
            this._tileJSONRequest = null;
        }
    }
    serialize() {
        return extend({}, this._options);
    }
    loadTile(tile) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = tile.tileID.canonical.url(this.tiles, this.map.getPixelRatio(), this.scheme);
            const params = {
                request: this.map._requestManager.transformRequest(url, "Tile"),
                uid: tile.uid,
                tileID: tile.tileID,
                zoom: tile.tileID.overscaledZ,
                tileSize: this.tileSize * tile.tileID.overscaleFactor(),
                type: this.type,
                source: this.id,
                pixelRatio: this.map.getPixelRatio(),
                showCollisionBoxes: this.map.showCollisionBoxes,
                promoteId: this.promoteId,
                subdivisionGranularity: this.map.style.projection.subdivisionGranularity
            };
            params.request.collectResourceTiming = this._collectResourceTiming;
            let messageType = "RT";
            if (!tile.actor || tile.state === 'expired') {
                tile.actor = this.dispatcher.getActor();
                messageType = "LT";
            }
            else if (tile.state === 'loading') {
                return new Promise((resolve, reject) => {
                    tile.reloadPromise = { resolve, reject };
                });
            }
            tile.abortController = new AbortController();
            try {
                const data = yield tile.actor.sendAsync({ type: messageType, data: params }, tile.abortController);
                delete tile.abortController;
                if (tile.aborted) {
                    return;
                }
                this._afterTileLoadWorkerResponse(tile, data);
            }
            catch (err) {
                delete tile.abortController;
                if (tile.aborted) {
                    return;
                }
                if (err && err.status !== 404) {
                    throw err;
                }
                this._afterTileLoadWorkerResponse(tile, null);
            }
        });
    }
    _afterTileLoadWorkerResponse(tile, data) {
        if (data && data.resourceTiming) {
            tile.resourceTiming = data.resourceTiming;
        }
        if (data && this.map._refreshExpiredTiles) {
            tile.setExpiryData(data);
        }
        tile.loadVectorData(data, this.map.painter);
        if (tile.reloadPromise) {
            const reloadPromise = tile.reloadPromise;
            tile.reloadPromise = null;
            this.loadTile(tile).then(reloadPromise.resolve).catch(reloadPromise.reject);
        }
    }
    abortTile(tile) {
        return __awaiter(this, void 0, void 0, function* () {
            if (tile.abortController) {
                tile.abortController.abort();
                delete tile.abortController;
            }
            if (tile.actor) {
                yield tile.actor.sendAsync({
                    type: "AT",
                    data: { uid: tile.uid, type: this.type, source: this.id }
                });
            }
        });
    }
    unloadTile(tile) {
        return __awaiter(this, void 0, void 0, function* () {
            tile.unloadVectorData();
            if (tile.actor) {
                yield tile.actor.sendAsync({
                    type: "RMT",
                    data: {
                        uid: tile.uid,
                        type: this.type,
                        source: this.id
                    }
                });
            }
        });
    }
    hasTransition() {
        return false;
    }
}
//# sourceMappingURL=vector_tile_source.js.map