import { type ExpiryData } from '../util/ajax';
import { WorkerTile } from './worker_tile';
import type { WorkerSource, WorkerTileParameters, TileParameters, WorkerTileResult } from '../source/worker_source';
import type { IActor } from '../util/actor';
import type { StyleLayerIndex } from '../style/style_layer_index';
import { VectorTile } from '@mapbox/vector-tile';
export type LoadVectorTileResult = {
    vectorTile: VectorTile;
    rawData: ArrayBufferLike;
    resourceTiming?: Array<PerformanceResourceTiming>;
} & ExpiryData;
type FetchingState = {
    rawTileData: ArrayBufferLike;
    cacheControl: ExpiryData;
    resourceTiming: any;
};
export type AbortVectorData = () => void;
export type LoadVectorData = (params: WorkerTileParameters, abortController: AbortController) => Promise<LoadVectorTileResult | null>;
export declare class VectorTileWorkerSource implements WorkerSource {
    actor: IActor;
    layerIndex: StyleLayerIndex;
    availableImages: Array<string>;
    fetching: {
        [_: string]: FetchingState;
    };
    loading: {
        [_: string]: WorkerTile;
    };
    loaded: {
        [_: string]: WorkerTile;
    };
    constructor(actor: IActor, layerIndex: StyleLayerIndex, availableImages: Array<string>);
    loadVectorTile(params: WorkerTileParameters, abortController: AbortController): Promise<LoadVectorTileResult>;
    loadTile(params: WorkerTileParameters): Promise<WorkerTileResult | null>;
    reloadTile(params: WorkerTileParameters): Promise<WorkerTileResult>;
    abortTile(params: TileParameters): Promise<void>;
    removeTile(params: TileParameters): Promise<void>;
}
export {};
//# sourceMappingURL=vector_tile_worker_source.d.ts.map