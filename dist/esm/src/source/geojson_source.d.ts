import { Evented } from '../util/evented';
import { LngLatBounds } from '../geo/lng_lat_bounds';
import type { Source } from './source';
import type { Map } from '../ui/map';
import type { Dispatcher } from '../util/dispatcher';
import type { Tile } from './tile';
import type { Actor } from '../util/actor';
import type { GeoJSONSourceSpecification, PromoteIdSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { GeoJSONSourceDiff } from './geojson_source_diff';
import type { GeoJSONWorkerOptions } from './geojson_worker_source';
export type GeoJSONSourceOptions = GeoJSONSourceSpecification & {
    workerOptions?: GeoJSONWorkerOptions;
    collectResourceTiming?: boolean;
    data: GeoJSON.GeoJSON | string;
};
export type GeoJSONSourceInternalOptions = {
    data?: GeoJSON.GeoJSON | string | undefined;
    cluster?: boolean;
    clusterMaxZoom?: number;
    clusterRadius?: number;
    clusterMinPoints?: number;
    generateId?: boolean;
};
export type SetClusterOptions = {
    cluster?: boolean;
    clusterMaxZoom?: number;
    clusterRadius?: number;
};
export declare class GeoJSONSource extends Evented implements Source {
    type: 'geojson';
    id: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    attribution: string;
    promoteId: PromoteIdSpecification;
    isTileClipped: boolean;
    reparseOverscaled: boolean;
    _data: GeoJSON.GeoJSON | string | undefined;
    _options: GeoJSONSourceInternalOptions;
    workerOptions: GeoJSONWorkerOptions;
    map: Map;
    actor: Actor;
    _isUpdatingWorker: boolean;
    _pendingWorkerUpdate: {
        data?: GeoJSON.GeoJSON | string;
        diff?: GeoJSONSourceDiff;
    };
    _collectResourceTiming: boolean;
    _removed: boolean;
    constructor(id: string, options: GeoJSONSourceOptions, dispatcher: Dispatcher, eventedParent: Evented);
    private _pixelsToTileUnits;
    private _getClusterMaxZoom;
    load(): Promise<void>;
    onAdd(map: Map): void;
    setData(data: GeoJSON.GeoJSON | string): this;
    updateData(diff: GeoJSONSourceDiff): this;
    getData(): Promise<GeoJSON.GeoJSON>;
    private getCoordinatesFromGeometry;
    getBounds(): Promise<LngLatBounds>;
    setClusterOptions(options: SetClusterOptions): this;
    getClusterExpansionZoom(clusterId: number): Promise<number>;
    getClusterChildren(clusterId: number): Promise<Array<GeoJSON.Feature>>;
    getClusterLeaves(clusterId: number, limit: number, offset: number): Promise<Array<GeoJSON.Feature>>;
    _updateWorkerData(): Promise<void>;
    loaded(): boolean;
    loadTile(tile: Tile): Promise<void>;
    abortTile(tile: Tile): Promise<void>;
    unloadTile(tile: Tile): Promise<void>;
    onRemove(): void;
    serialize(): GeoJSONSourceSpecification;
    hasTransition(): boolean;
}
//# sourceMappingURL=geojson_source.d.ts.map