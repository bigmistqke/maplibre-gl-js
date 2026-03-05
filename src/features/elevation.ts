import {RasterDEMTileSource} from '../source/raster_dem_tile_source';
import {RasterDEMTileWorkerSource} from '../source/raster_dem_tile_worker_source';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const elevationBase: Feature = {
    sources: {
        'raster-dem': {Source: RasterDEMTileSource},
    },
    workerSources: {
        'raster-dem': {WorkerSource: RasterDEMTileWorkerSource},
    },
};

export function elevation(...features: Feature[]): Feature {
    return merge(elevationBase, ...features);
}

// Re-export sub-features for convenience
export {hillshade} from './hillshade';
export {colorRelief} from './color_relief';
