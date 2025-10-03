import Supercluster, { type Options as SuperclusterOptions, type ClusterProperties } from 'supercluster';
import geojsonvt, { type Options as GeoJSONVTOptions } from 'geojson-vt';
import { VectorTileWorkerSource } from './vector_tile_worker_source';
import type { WorkerTileParameters, WorkerTileResult } from '../source/worker_source';
import type { LoadVectorTileResult } from './vector_tile_worker_source';
import type { RequestParameters } from '../util/ajax';
import { type GeoJSONSourceDiff, type GeoJSONFeatureId } from './geojson_source_diff';
import type { ClusterIDAndSource, GeoJSONWorkerSourceLoadDataResult, RemoveSourceParams } from '../util/actor_messages';
export type GeoJSONWorkerOptions = {
    source?: string;
    cluster?: boolean;
    geojsonVtOptions?: GeoJSONVTOptions;
    superclusterOptions?: SuperclusterOptions<any, any>;
    clusterProperties?: ClusterProperties;
    filter?: Array<unknown>;
    promoteId?: string;
    collectResourceTiming?: boolean;
};
export type LoadGeoJSONParameters = GeoJSONWorkerOptions & {
    type: 'geojson';
    request?: RequestParameters;
    data?: string;
    dataDiff?: GeoJSONSourceDiff;
};
export type LoadGeoJSON = (params: LoadGeoJSONParameters, abortController: AbortController) => Promise<GeoJSON.GeoJSON>;
type GeoJSONIndex = ReturnType<typeof geojsonvt> | Supercluster;
export declare class GeoJSONWorkerSource extends VectorTileWorkerSource {
    _pendingData: Promise<GeoJSON.GeoJSON>;
    _pendingRequest: AbortController;
    _geoJSONIndex: GeoJSONIndex;
    _dataUpdateable: Map<GeoJSONFeatureId, import("geojson").Feature<import("geojson").Geometry, {
        [name: string]: any;
    }>>;
    loadVectorTile(params: WorkerTileParameters, _abortController: AbortController): Promise<LoadVectorTileResult | null>;
    loadData(params: LoadGeoJSONParameters): Promise<GeoJSONWorkerSourceLoadDataResult>;
    getData(): Promise<GeoJSON.GeoJSON>;
    reloadTile(params: WorkerTileParameters): Promise<WorkerTileResult>;
    loadAndProcessGeoJSON(params: LoadGeoJSONParameters, abortController: AbortController): Promise<GeoJSON.GeoJSON>;
    loadGeoJSON(params: LoadGeoJSONParameters, abortController: AbortController): Promise<GeoJSON.GeoJSON>;
    removeSource(_params: RemoveSourceParams): Promise<void>;
    getClusterExpansionZoom(params: ClusterIDAndSource): number;
    getClusterChildren(params: ClusterIDAndSource): Array<GeoJSON.Feature>;
    getClusterLeaves(params: {
        clusterId: number;
        limit: number;
        offset: number;
    }): Array<GeoJSON.Feature>;
}
export {};
//# sourceMappingURL=geojson_worker_source.d.ts.map