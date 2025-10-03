var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { CanonicalTileID } from './tile_id';
import { Event, ErrorEvent, Evented } from '../util/evented';
import { ImageRequest } from '../util/image_request';
import { Texture } from '../render/texture';
import { MercatorCoordinate } from '../geo/mercator_coordinate';
import { MAX_TILE_ZOOM } from '../util/util';
import { Bounds } from '../geo/bounds';
export class ImageSource extends Evented {
    constructor(id, options, dispatcher, eventedParent) {
        super();
        this.flippedWindingOrder = false;
        this.id = id;
        this.dispatcher = dispatcher;
        this.coordinates = options.coordinates;
        this.type = 'image';
        this.minzoom = 0;
        this.maxzoom = 22;
        this.tileSize = 512;
        this.tiles = {};
        this._loaded = false;
        this.setEventedParent(eventedParent);
        this.options = options;
    }
    load(newCoordinates) {
        return __awaiter(this, void 0, void 0, function* () {
            this._loaded = false;
            this.fire(new Event('dataloading', { dataType: 'source' }));
            this.url = this.options.url;
            this._request = new AbortController();
            try {
                const image = yield ImageRequest.getImage(this.map._requestManager.transformRequest(this.url, "Image"), this._request);
                this._request = null;
                this._loaded = true;
                if (image && image.data) {
                    this.image = image.data;
                    if (newCoordinates) {
                        this.coordinates = newCoordinates;
                    }
                    this._finishLoading();
                }
            }
            catch (err) {
                this._request = null;
                this._loaded = true;
                this.fire(new ErrorEvent(err));
            }
        });
    }
    loaded() {
        return this._loaded;
    }
    updateImage(options) {
        if (!options.url) {
            return this;
        }
        if (this._request) {
            this._request.abort();
            this._request = null;
        }
        this.options.url = options.url;
        this.load(options.coordinates).finally(() => { this.texture = null; });
        return this;
    }
    _finishLoading() {
        if (this.map) {
            this.setCoordinates(this.coordinates);
            this.fire(new Event('data', { dataType: 'source', sourceDataType: 'metadata' }));
        }
    }
    onAdd(map) {
        this.map = map;
        this.load();
    }
    onRemove() {
        if (this._request) {
            this._request.abort();
            this._request = null;
        }
    }
    setCoordinates(coordinates) {
        this.coordinates = coordinates;
        const cornerCoords = coordinates.map(MercatorCoordinate.fromLngLat);
        this.tileID = getCoordinatesCenterTileID(cornerCoords);
        this.terrainTileRanges = this._getOverlappingTileRanges(cornerCoords);
        this.minzoom = this.maxzoom = this.tileID.z;
        this.tileCoords = cornerCoords.map((coord) => this.tileID.getTilePoint(coord)._round());
        this.flippedWindingOrder = hasWrongWindingOrder(this.tileCoords);
        this.fire(new Event('data', { dataType: 'source', sourceDataType: 'content' }));
        return this;
    }
    prepare() {
        if (Object.keys(this.tiles).length === 0 || !this.image) {
            return;
        }
        const context = this.map.painter.context;
        const gl = context.gl;
        if (!this.texture) {
            this.texture = new Texture(context, this.image, gl.RGBA);
            this.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        }
        let newTilesLoaded = false;
        for (const w in this.tiles) {
            const tile = this.tiles[w];
            if (tile.state !== 'loaded') {
                tile.state = 'loaded';
                tile.texture = this.texture;
                newTilesLoaded = true;
            }
        }
        if (newTilesLoaded) {
            this.fire(new Event('data', { dataType: 'source', sourceDataType: 'idle', sourceId: this.id }));
        }
    }
    loadTile(tile) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.tileID && this.tileID.equals(tile.tileID.canonical)) {
                this.tiles[String(tile.tileID.wrap)] = tile;
                tile.buckets = {};
            }
            else {
                tile.state = 'errored';
            }
        });
    }
    serialize() {
        return {
            type: 'image',
            url: this.options.url,
            coordinates: this.coordinates
        };
    }
    hasTransition() {
        return false;
    }
    _getOverlappingTileRanges(coords) {
        const { minX, minY, maxX, maxY } = Bounds.fromPoints(coords);
        const ranges = {};
        for (let z = 0; z <= MAX_TILE_ZOOM; z++) {
            const tilesAtZoom = Math.pow(2, z);
            const minTileX = Math.floor(minX * tilesAtZoom);
            const minTileY = Math.floor(minY * tilesAtZoom);
            const maxTileX = Math.floor(maxX * tilesAtZoom);
            const maxTileY = Math.floor(maxY * tilesAtZoom);
            ranges[z] = {
                minTileX,
                minTileY,
                maxTileX,
                maxTileY
            };
        }
        return ranges;
    }
}
export function getCoordinatesCenterTileID(coords) {
    const bounds = Bounds.fromPoints(coords);
    const dx = bounds.width();
    const dy = bounds.height();
    const dMax = Math.max(dx, dy);
    const zoom = Math.max(0, Math.floor(-Math.log(dMax) / Math.LN2));
    const tilesAtZoom = Math.pow(2, zoom);
    return new CanonicalTileID(zoom, Math.floor((bounds.minX + bounds.maxX) / 2 * tilesAtZoom), Math.floor((bounds.minY + bounds.maxY) / 2 * tilesAtZoom));
}
function hasWrongWindingOrder(coords) {
    const e0x = coords[1].x - coords[0].x;
    const e0y = coords[1].y - coords[0].y;
    const e1x = coords[2].x - coords[0].x;
    const e1y = coords[2].y - coords[0].y;
    const crossProduct = e0x * e1y - e0y * e1x;
    return crossProduct < 0;
}
//# sourceMappingURL=image_source.js.map