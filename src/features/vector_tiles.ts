import {VectorTileSource} from '../source/vector_tile_source';
import {VectorTileWorkerSource} from '../source/vector_tile_worker_source';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const vectorTilesBase: Feature = {
    sources: {
        vector: {Source: VectorTileSource as any},
    },
    workerSources: {
        vector: {WorkerSource: VectorTileWorkerSource},
    },
};

export function vectorTiles(...capabilities: Feature[]): Feature {
    return merge(vectorTilesBase, ...capabilities);
}
