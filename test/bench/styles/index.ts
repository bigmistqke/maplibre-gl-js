import locationsWithTileID from '../lib/locations_with_tile_id';
import styleBenchmarkLocations from '../data/style-benchmark-locations.json' with {type: 'json'};
import StyleLayerCreate from '../benchmarks/style_layer_create';
import Validate from '../benchmarks/style_validate';
import Layout from '../benchmarks/layout';
import Paint from '../benchmarks/paint';
import QueryPoint from '../benchmarks/query_point';
import QueryBox from '../benchmarks/query_box';

import {getGlobalWorkerPool} from '../../../src/util/global_worker_pool';

const locations = locationsWithTileID(styleBenchmarkLocations.features as GeoJSON.Feature<GeoJSON.Point>[]);

interface BenchmarkVersion {
    name: string;
    bench: any;
}

interface RegisteredBenchmark {
    name: string;
    versions: BenchmarkVersion[];
    location?: any;
}

const benchmarks: RegisteredBenchmark[] = [];
(window as any).benchmarks = benchmarks;

function register(name: string, Benchmark: any, locations?: any, location?: any) {
    const versions: BenchmarkVersion[] = [];

    const styles = process.env.MAPLIBRE_STYLES;
    if (styles) {
        for (const style of styles) {
            versions.push({
                name: typeof style === 'string' ? style : (style as any).name,
                bench: new Benchmark(style, locations)
            });
        }
    }
    benchmarks.push({name, versions, location});
}

register('StyleLayerCreate', StyleLayerCreate);
register('Validate', Validate);
locations.forEach(location => register('Layout', Layout, location.tileID, location));
locations.forEach(location => register('Paint', Paint, [location], location));
register('QueryPoint', QueryPoint, locations);
register('QueryBox', QueryBox, locations);

Promise.resolve().then(() => {
    // Ensure the global worker pool is never drained. Browsers have resource limits
    // on the max number of workers that can be created per page.
    // We do this async to avoid creating workers before the worker bundle blob
    // URL has been set up, which happens after this module is executed.
    getGlobalWorkerPool().acquire(-1);
});

export * from '../../../src';
