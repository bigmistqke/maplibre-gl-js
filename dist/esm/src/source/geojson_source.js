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
import { extend, warnOnce } from '../util/util';
import { EXTENT } from '../data/extent';
import { browser } from '../util/browser';
import { LngLatBounds } from '../geo/lng_lat_bounds';
import { mergeSourceDiffs } from './geojson_source_diff';
export class GeoJSONSource extends Evented {
    constructor(id, options, dispatcher, eventedParent) {
        super();
        this.id = id;
        this.type = 'geojson';
        this.minzoom = 0;
        this.maxzoom = 18;
        this.tileSize = 512;
        this.isTileClipped = true;
        this.reparseOverscaled = true;
        this._removed = false;
        this._isUpdatingWorker = false;
        this._pendingWorkerUpdate = { data: options.data };
        this.actor = dispatcher.getActor();
        this.setEventedParent(eventedParent);
        this._data = options.data;
        this._options = extend({}, options);
        this._collectResourceTiming = options.collectResourceTiming;
        if (options.maxzoom !== undefined)
            this.maxzoom = options.maxzoom;
        if (options.type)
            this.type = options.type;
        if (options.attribution)
            this.attribution = options.attribution;
        this.promoteId = options.promoteId;
        if (options.clusterMaxZoom !== undefined && this.maxzoom <= options.clusterMaxZoom) {
            warnOnce(`The maxzoom value "${this.maxzoom}" is expected to be greater than the clusterMaxZoom value "${options.clusterMaxZoom}".`);
        }
        this.workerOptions = extend({
            source: this.id,
            cluster: options.cluster || false,
            geojsonVtOptions: {
                buffer: this._pixelsToTileUnits(options.buffer !== undefined ? options.buffer : 128),
                tolerance: this._pixelsToTileUnits(options.tolerance !== undefined ? options.tolerance : 0.375),
                extent: EXTENT,
                maxZoom: this.maxzoom,
                lineMetrics: options.lineMetrics || false,
                generateId: options.generateId || false
            },
            superclusterOptions: {
                maxZoom: this._getClusterMaxZoom(options.clusterMaxZoom),
                minPoints: Math.max(2, options.clusterMinPoints || 2),
                extent: EXTENT,
                radius: this._pixelsToTileUnits(options.clusterRadius || 50),
                log: false,
                generateId: options.generateId || false
            },
            clusterProperties: options.clusterProperties,
            filter: options.filter
        }, options.workerOptions);
        if (typeof this.promoteId === 'string') {
            this.workerOptions.promoteId = this.promoteId;
        }
    }
    _pixelsToTileUnits(pixelValue) {
        return pixelValue * (EXTENT / this.tileSize);
    }
    _getClusterMaxZoom(clusterMaxZoom) {
        const effectiveClusterMaxZoom = clusterMaxZoom ? Math.round(clusterMaxZoom) : this.maxzoom - 1;
        if (!(Number.isInteger(clusterMaxZoom) || clusterMaxZoom === undefined)) {
            warnOnce(`Integer expected for option 'clusterMaxZoom': provided value "${clusterMaxZoom}" rounded to "${effectiveClusterMaxZoom}"`);
        }
        return effectiveClusterMaxZoom;
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._updateWorkerData();
        });
    }
    onAdd(map) {
        this.map = map;
        this.load();
    }
    setData(data) {
        this._data = data;
        this._pendingWorkerUpdate = { data };
        this._updateWorkerData();
        return this;
    }
    updateData(diff) {
        this._pendingWorkerUpdate.diff = mergeSourceDiffs(this._pendingWorkerUpdate.diff, diff);
        this._updateWorkerData();
        return this;
    }
    getData() {
        return __awaiter(this, void 0, void 0, function* () {
            const options = extend({ type: this.type }, this.workerOptions);
            return this.actor.sendAsync({ type: "GD", data: options });
        });
    }
    getCoordinatesFromGeometry(geometry) {
        if (geometry.type === 'GeometryCollection') {
            return geometry.geometries.map((g) => g.coordinates).flat(Infinity);
        }
        return geometry.coordinates.flat(Infinity);
    }
    getBounds() {
        return __awaiter(this, void 0, void 0, function* () {
            const bounds = new LngLatBounds();
            const data = yield this.getData();
            let coordinates;
            switch (data.type) {
                case 'FeatureCollection':
                    coordinates = data.features.map(f => this.getCoordinatesFromGeometry(f.geometry)).flat(Infinity);
                    break;
                case 'Feature':
                    coordinates = this.getCoordinatesFromGeometry(data.geometry);
                    break;
                default:
                    coordinates = this.getCoordinatesFromGeometry(data);
                    break;
            }
            if (coordinates.length == 0) {
                return bounds;
            }
            for (let i = 0; i < coordinates.length - 1; i += 2) {
                bounds.extend([coordinates[i], coordinates[i + 1]]);
            }
            return bounds;
        });
    }
    setClusterOptions(options) {
        this.workerOptions.cluster = options.cluster;
        if (options) {
            if (options.clusterRadius !== undefined)
                this.workerOptions.superclusterOptions.radius = this._pixelsToTileUnits(options.clusterRadius);
            if (options.clusterMaxZoom !== undefined) {
                this.workerOptions.superclusterOptions.maxZoom = this._getClusterMaxZoom(options.clusterMaxZoom);
            }
        }
        this._updateWorkerData();
        return this;
    }
    getClusterExpansionZoom(clusterId) {
        return this.actor.sendAsync({ type: "GCEZ", data: { type: this.type, clusterId, source: this.id } });
    }
    getClusterChildren(clusterId) {
        return this.actor.sendAsync({ type: "GCC", data: { type: this.type, clusterId, source: this.id } });
    }
    getClusterLeaves(clusterId, limit, offset) {
        return this.actor.sendAsync({ type: "GCL", data: {
                type: this.type,
                source: this.id,
                clusterId,
                limit,
                offset
            } });
    }
    _updateWorkerData() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._isUpdatingWorker)
                return;
            const { data, diff } = this._pendingWorkerUpdate;
            if (!data && !diff) {
                warnOnce(`No data or diff provided to GeoJSONSource ${this.id}.`);
                return;
            }
            const options = extend({ type: this.type }, this.workerOptions);
            if (data) {
                if (typeof data === 'string') {
                    options.request = this.map._requestManager.transformRequest(browser.resolveURL(data), "Source");
                    options.request.collectResourceTiming = this._collectResourceTiming;
                }
                else {
                    options.data = JSON.stringify(data);
                }
                this._pendingWorkerUpdate.data = undefined;
            }
            else if (diff) {
                options.dataDiff = diff;
                this._pendingWorkerUpdate.diff = undefined;
            }
            this._isUpdatingWorker = true;
            this.fire(new Event('dataloading', { dataType: 'source' }));
            try {
                const result = yield this.actor.sendAsync({ type: "LD", data: options });
                this._isUpdatingWorker = false;
                if (this._removed || result.abandoned) {
                    this.fire(new Event('dataabort', { dataType: 'source' }));
                    return;
                }
                this._data = result.data;
                let resourceTiming = null;
                if (result.resourceTiming && result.resourceTiming[this.id]) {
                    resourceTiming = result.resourceTiming[this.id].slice(0);
                }
                const eventData = { dataType: 'source' };
                if (this._collectResourceTiming && resourceTiming && resourceTiming.length > 0) {
                    extend(eventData, { resourceTiming });
                }
                this.fire(new Event('data', Object.assign(Object.assign({}, eventData), { sourceDataType: 'metadata' })));
                this.fire(new Event('data', Object.assign(Object.assign({}, eventData), { sourceDataType: 'content' })));
            }
            catch (err) {
                this._isUpdatingWorker = false;
                if (this._removed) {
                    this.fire(new Event('dataabort', { dataType: 'source' }));
                    return;
                }
                this.fire(new ErrorEvent(err));
            }
            finally {
                if (this._pendingWorkerUpdate.data || this._pendingWorkerUpdate.diff) {
                    this._updateWorkerData();
                }
            }
        });
    }
    loaded() {
        return !this._isUpdatingWorker && this._pendingWorkerUpdate.data === undefined && this._pendingWorkerUpdate.diff === undefined;
    }
    loadTile(tile) {
        return __awaiter(this, void 0, void 0, function* () {
            const message = !tile.actor ? "LT" : "RT";
            tile.actor = this.actor;
            const params = {
                type: this.type,
                uid: tile.uid,
                tileID: tile.tileID,
                zoom: tile.tileID.overscaledZ,
                maxZoom: this.maxzoom,
                tileSize: this.tileSize,
                source: this.id,
                pixelRatio: this.map.getPixelRatio(),
                showCollisionBoxes: this.map.showCollisionBoxes,
                promoteId: this.promoteId,
                subdivisionGranularity: this.map.style.projection.subdivisionGranularity
            };
            tile.abortController = new AbortController();
            const data = yield this.actor.sendAsync({ type: message, data: params }, tile.abortController);
            delete tile.abortController;
            tile.unloadVectorData();
            if (!tile.aborted) {
                tile.loadVectorData(data, this.map.painter, message === "RT");
            }
        });
    }
    abortTile(tile) {
        return __awaiter(this, void 0, void 0, function* () {
            if (tile.abortController) {
                tile.abortController.abort();
                delete tile.abortController;
            }
            tile.aborted = true;
        });
    }
    unloadTile(tile) {
        return __awaiter(this, void 0, void 0, function* () {
            tile.unloadVectorData();
            yield this.actor.sendAsync({ type: "RMT", data: { uid: tile.uid, type: this.type, source: this.id } });
        });
    }
    onRemove() {
        this._removed = true;
        this.actor.sendAsync({ type: "RS", data: { type: this.type, source: this.id } });
    }
    serialize() {
        return extend({}, this._options, {
            type: this.type,
            data: this._data
        });
    }
    hasTransition() {
        return false;
    }
}
//# sourceMappingURL=geojson_source.js.map