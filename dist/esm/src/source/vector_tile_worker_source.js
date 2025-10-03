var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { getArrayBuffer } from '../util/ajax';
import Protobuf from 'pbf';
import { WorkerTile } from './worker_tile';
import { extend } from '../util/util';
import { RequestPerformance } from '../util/performance';
import { VectorTile } from '@mapbox/vector-tile';
export class VectorTileWorkerSource {
    constructor(actor, layerIndex, availableImages) {
        this.actor = actor;
        this.layerIndex = layerIndex;
        this.availableImages = availableImages;
        this.fetching = {};
        this.loading = {};
        this.loaded = {};
    }
    loadVectorTile(params, abortController) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield getArrayBuffer(params.request, abortController);
            try {
                const vectorTile = new VectorTile(new Protobuf(response.data));
                return {
                    vectorTile,
                    rawData: response.data,
                    cacheControl: response.cacheControl,
                    expires: response.expires
                };
            }
            catch (ex) {
                const bytes = new Uint8Array(response.data);
                const isGzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
                let errorMessage = `Unable to parse the tile at ${params.request.url}, `;
                if (isGzipped) {
                    errorMessage += 'please make sure the data is not gzipped and that you have configured the relevant header in the server';
                }
                else {
                    errorMessage += `got error: ${ex.message}`;
                }
                throw new Error(errorMessage);
            }
        });
    }
    loadTile(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const tileUid = params.uid;
            const perf = (params && params.request && params.request.collectResourceTiming) ?
                new RequestPerformance(params.request) : false;
            const workerTile = new WorkerTile(params);
            this.loading[tileUid] = workerTile;
            const abortController = new AbortController();
            workerTile.abort = abortController;
            try {
                const response = yield this.loadVectorTile(params, abortController);
                delete this.loading[tileUid];
                if (!response) {
                    return null;
                }
                const rawTileData = response.rawData;
                const cacheControl = {};
                if (response.expires)
                    cacheControl.expires = response.expires;
                if (response.cacheControl)
                    cacheControl.cacheControl = response.cacheControl;
                const resourceTiming = {};
                if (perf) {
                    const resourceTimingData = perf.finish();
                    if (resourceTimingData)
                        resourceTiming.resourceTiming = JSON.parse(JSON.stringify(resourceTimingData));
                }
                workerTile.vectorTile = response.vectorTile;
                const parsePromise = workerTile.parse(response.vectorTile, this.layerIndex, this.availableImages, this.actor, params.subdivisionGranularity);
                this.loaded[tileUid] = workerTile;
                this.fetching[tileUid] = { rawTileData, cacheControl, resourceTiming };
                try {
                    const result = yield parsePromise;
                    return extend({ rawTileData: rawTileData.slice(0) }, result, cacheControl, resourceTiming);
                }
                finally {
                    delete this.fetching[tileUid];
                }
            }
            catch (err) {
                delete this.loading[tileUid];
                workerTile.status = 'done';
                this.loaded[tileUid] = workerTile;
                throw err;
            }
        });
    }
    reloadTile(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const uid = params.uid;
            if (!this.loaded || !this.loaded[uid]) {
                throw new Error('Should not be trying to reload a tile that was never loaded or has been removed');
            }
            const workerTile = this.loaded[uid];
            workerTile.showCollisionBoxes = params.showCollisionBoxes;
            if (workerTile.status === 'parsing') {
                const result = yield workerTile.parse(workerTile.vectorTile, this.layerIndex, this.availableImages, this.actor, params.subdivisionGranularity);
                let parseResult;
                if (this.fetching[uid]) {
                    const { rawTileData, cacheControl, resourceTiming } = this.fetching[uid];
                    delete this.fetching[uid];
                    parseResult = extend({ rawTileData: rawTileData.slice(0) }, result, cacheControl, resourceTiming);
                }
                else {
                    parseResult = result;
                }
                return parseResult;
            }
            if (workerTile.status === 'done' && workerTile.vectorTile) {
                return workerTile.parse(workerTile.vectorTile, this.layerIndex, this.availableImages, this.actor, params.subdivisionGranularity);
            }
        });
    }
    abortTile(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const loading = this.loading;
            const uid = params.uid;
            if (loading && loading[uid] && loading[uid].abort) {
                loading[uid].abort.abort();
                delete loading[uid];
            }
        });
    }
    removeTile(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.loaded && this.loaded[params.uid]) {
                delete this.loaded[params.uid];
            }
        });
    }
}
//# sourceMappingURL=vector_tile_worker_source.js.map