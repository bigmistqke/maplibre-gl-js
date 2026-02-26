import {GeoJSONSource} from '../source/geojson_source';
import {GeoJSONWorkerSource} from '../source/geojson_worker_source';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const geojsonBase: Feature = {
    sources: {
        geojson: {Source: GeoJSONSource as any},
    },
    workerSources: {
        geojson: {WorkerSource: GeoJSONWorkerSource},
    },
};

export function geojson(...capabilities: Feature[]): Feature {
    return merge(geojsonBase, ...capabilities);
}
