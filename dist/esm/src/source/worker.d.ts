import { Actor, type ActorTarget } from '../util/actor';
import { StyleLayerIndex } from '../style/style_layer_index';
import { RasterDEMTileWorkerSource } from './raster_dem_tile_worker_source';
import type { WorkerSource, WorkerSourceConstructor } from '../source/worker_source';
import type { WorkerGlobalScopeInterface } from '../util/web_worker';
export default class Worker {
    self: WorkerGlobalScopeInterface & ActorTarget;
    actor: Actor;
    layerIndexes: {
        [_: string]: StyleLayerIndex;
    };
    availableImages: {
        [_: string]: Array<string>;
    };
    externalWorkerSourceTypes: {
        [_: string]: WorkerSourceConstructor;
    };
    workerSources: {
        [_: string]: {
            [_: string]: {
                [_: string]: WorkerSource;
            };
        };
    };
    demWorkerSources: {
        [_: string]: {
            [_: string]: RasterDEMTileWorkerSource;
        };
    };
    referrer: string;
    globalStates: Map<string, Record<string, any>>;
    constructor(self: WorkerGlobalScopeInterface & ActorTarget);
    private _getGlobalState;
    private _setImages;
    private _syncRTLPluginState;
    private _getAvailableImages;
    private _getLayerIndex;
    private _getWorkerSource;
    private _getDEMWorkerSource;
}
//# sourceMappingURL=worker.d.ts.map