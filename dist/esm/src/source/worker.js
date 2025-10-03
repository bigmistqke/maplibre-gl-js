var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Actor } from '../util/actor';
import { StyleLayerIndex } from '../style/style_layer_index';
import { VectorTileWorkerSource } from './vector_tile_worker_source';
import { RasterDEMTileWorkerSource } from './raster_dem_tile_worker_source';
import { rtlWorkerPlugin } from './rtl_text_plugin_worker';
import { GeoJSONWorkerSource } from './geojson_worker_source';
import { isWorker } from '../util/util';
import { addProtocol, removeProtocol } from './protocol_crud';
export default class Worker {
    constructor(self) {
        this.self = self;
        this.actor = new Actor(self);
        this.layerIndexes = {};
        this.availableImages = {};
        this.workerSources = {};
        this.demWorkerSources = {};
        this.externalWorkerSourceTypes = {};
        this.globalStates = new Map();
        this.self.registerWorkerSource = (name, WorkerSource) => {
            if (this.externalWorkerSourceTypes[name]) {
                throw new Error(`Worker source with name "${name}" already registered.`);
            }
            this.externalWorkerSourceTypes[name] = WorkerSource;
        };
        this.self.addProtocol = addProtocol;
        this.self.removeProtocol = removeProtocol;
        this.self.registerRTLTextPlugin = (rtlTextPlugin) => {
            rtlWorkerPlugin.setMethods(rtlTextPlugin);
        };
        this.actor.registerMessageHandler("LDT", (mapId, params) => {
            return this._getDEMWorkerSource(mapId, params.source).loadTile(params);
        });
        this.actor.registerMessageHandler("RDT", (mapId, params) => __awaiter(this, void 0, void 0, function* () {
            this._getDEMWorkerSource(mapId, params.source).removeTile(params);
        }));
        this.actor.registerMessageHandler("GCEZ", (mapId, params) => __awaiter(this, void 0, void 0, function* () {
            return this._getWorkerSource(mapId, params.type, params.source).getClusterExpansionZoom(params);
        }));
        this.actor.registerMessageHandler("GCC", (mapId, params) => __awaiter(this, void 0, void 0, function* () {
            return this._getWorkerSource(mapId, params.type, params.source).getClusterChildren(params);
        }));
        this.actor.registerMessageHandler("GCL", (mapId, params) => __awaiter(this, void 0, void 0, function* () {
            return this._getWorkerSource(mapId, params.type, params.source).getClusterLeaves(params);
        }));
        this.actor.registerMessageHandler("LD", (mapId, params) => {
            return this._getWorkerSource(mapId, params.type, params.source).loadData(params);
        });
        this.actor.registerMessageHandler("GD", (mapId, params) => {
            return this._getWorkerSource(mapId, params.type, params.source).getData();
        });
        this.actor.registerMessageHandler("LT", (mapId, params) => {
            return this._getWorkerSource(mapId, params.type, params.source).loadTile(params);
        });
        this.actor.registerMessageHandler("RT", (mapId, params) => {
            return this._getWorkerSource(mapId, params.type, params.source).reloadTile(params);
        });
        this.actor.registerMessageHandler("AT", (mapId, params) => {
            return this._getWorkerSource(mapId, params.type, params.source).abortTile(params);
        });
        this.actor.registerMessageHandler("RMT", (mapId, params) => {
            return this._getWorkerSource(mapId, params.type, params.source).removeTile(params);
        });
        this.actor.registerMessageHandler("RS", (mapId, params) => __awaiter(this, void 0, void 0, function* () {
            if (!this.workerSources[mapId] ||
                !this.workerSources[mapId][params.type] ||
                !this.workerSources[mapId][params.type][params.source]) {
                return;
            }
            const worker = this.workerSources[mapId][params.type][params.source];
            delete this.workerSources[mapId][params.type][params.source];
            if (worker.removeSource !== undefined) {
                worker.removeSource(params);
            }
        }));
        this.actor.registerMessageHandler("RM", (mapId) => __awaiter(this, void 0, void 0, function* () {
            delete this.layerIndexes[mapId];
            delete this.availableImages[mapId];
            delete this.workerSources[mapId];
            delete this.demWorkerSources[mapId];
            this.globalStates.delete(mapId);
        }));
        this.actor.registerMessageHandler("SR", (_mapId, params) => __awaiter(this, void 0, void 0, function* () {
            this.referrer = params;
        }));
        this.actor.registerMessageHandler("SRPS", (mapId, params) => {
            return this._syncRTLPluginState(mapId, params);
        });
        this.actor.registerMessageHandler("IS", (_mapId, params) => __awaiter(this, void 0, void 0, function* () {
            this.self.importScripts(params);
        }));
        this.actor.registerMessageHandler("SI", (mapId, params) => {
            return this._setImages(mapId, params);
        });
        this.actor.registerMessageHandler("UL", (mapId, params) => __awaiter(this, void 0, void 0, function* () {
            this._getLayerIndex(mapId).update(params.layers, params.removedIds, this._getGlobalState(mapId));
        }));
        this.actor.registerMessageHandler("UGS", (mapId, params) => __awaiter(this, void 0, void 0, function* () {
            const globalState = this._getGlobalState(mapId);
            for (const key in params) {
                globalState[key] = params[key];
            }
        }));
        this.actor.registerMessageHandler("SL", (mapId, params) => __awaiter(this, void 0, void 0, function* () {
            this._getLayerIndex(mapId).replace(params, this._getGlobalState(mapId));
        }));
    }
    _getGlobalState(mapId) {
        let state = this.globalStates.get(mapId);
        if (!state) {
            state = {};
            this.globalStates.set(mapId, state);
        }
        return state;
    }
    _setImages(mapId, images) {
        return __awaiter(this, void 0, void 0, function* () {
            this.availableImages[mapId] = images;
            for (const workerSource in this.workerSources[mapId]) {
                const ws = this.workerSources[mapId][workerSource];
                for (const source in ws) {
                    ws[source].availableImages = images;
                }
            }
        });
    }
    _syncRTLPluginState(mapId, incomingState) {
        return __awaiter(this, void 0, void 0, function* () {
            const state = yield rtlWorkerPlugin.syncState(incomingState, this.self.importScripts);
            return state;
        });
    }
    _getAvailableImages(mapId) {
        let availableImages = this.availableImages[mapId];
        if (!availableImages) {
            availableImages = [];
        }
        return availableImages;
    }
    _getLayerIndex(mapId) {
        let layerIndexes = this.layerIndexes[mapId];
        if (!layerIndexes) {
            layerIndexes = this.layerIndexes[mapId] = new StyleLayerIndex();
        }
        return layerIndexes;
    }
    _getWorkerSource(mapId, sourceType, sourceName) {
        if (!this.workerSources[mapId])
            this.workerSources[mapId] = {};
        if (!this.workerSources[mapId][sourceType])
            this.workerSources[mapId][sourceType] = {};
        if (!this.workerSources[mapId][sourceType][sourceName]) {
            const actor = {
                sendAsync: (message, abortController) => {
                    message.targetMapId = mapId;
                    return this.actor.sendAsync(message, abortController);
                }
            };
            switch (sourceType) {
                case 'vector':
                    this.workerSources[mapId][sourceType][sourceName] = new VectorTileWorkerSource(actor, this._getLayerIndex(mapId), this._getAvailableImages(mapId));
                    break;
                case 'geojson':
                    this.workerSources[mapId][sourceType][sourceName] = new GeoJSONWorkerSource(actor, this._getLayerIndex(mapId), this._getAvailableImages(mapId));
                    break;
                default:
                    this.workerSources[mapId][sourceType][sourceName] = new (this.externalWorkerSourceTypes[sourceType])(actor, this._getLayerIndex(mapId), this._getAvailableImages(mapId));
                    break;
            }
        }
        return this.workerSources[mapId][sourceType][sourceName];
    }
    _getDEMWorkerSource(mapId, sourceType) {
        if (!this.demWorkerSources[mapId])
            this.demWorkerSources[mapId] = {};
        if (!this.demWorkerSources[mapId][sourceType]) {
            this.demWorkerSources[mapId][sourceType] = new RasterDEMTileWorkerSource();
        }
        return this.demWorkerSources[mapId][sourceType];
    }
}
if (isWorker(self)) {
    self.worker = new Worker(self);
}
//# sourceMappingURL=worker.js.map