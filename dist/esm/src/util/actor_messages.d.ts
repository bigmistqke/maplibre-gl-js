import type { LoadGeoJSONParameters } from '../source/geojson_worker_source';
import type { TileParameters, WorkerDEMTileParameters, WorkerTileParameters, WorkerTileResult } from '../source/worker_source';
import type { DEMData } from '../data/dem_data';
import type { StyleImage } from '../style/style_image';
import type { StyleGlyph } from '../style/style_glyph';
import type { PluginState } from '../source/rtl_text_plugin_status';
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { OverscaledTileID } from '../source/tile_id';
import type { GetResourceResponse, RequestParameters } from './ajax';
export type ClusterIDAndSource = {
    type: 'geojson';
    clusterId: number;
    source: string;
};
export type GetClusterLeavesParams = ClusterIDAndSource & {
    limit: number;
    offset: number;
};
export type GeoJSONWorkerSourceLoadDataResult = {
    data?: GeoJSON.GeoJSON;
    resourceTiming?: {
        [_: string]: Array<PerformanceResourceTiming>;
    };
    abandoned?: boolean;
};
export type RemoveSourceParams = {
    source: string;
    type: string;
};
export type UpdateLayersParameters = {
    layers: Array<LayerSpecification>;
    removedIds: Array<string>;
};
export type GetImagesParameters = {
    icons: Array<string>;
    source: string;
    tileID: OverscaledTileID;
    type: string;
};
export type GetGlyphsParameters = {
    type: string;
    stacks: {
        [_: string]: Array<number>;
    };
    source: string;
    tileID: OverscaledTileID;
};
export type GetGlyphsResponse = {
    [stack: string]: {
        [id: number]: StyleGlyph;
    };
};
export type GetImagesResponse = {
    [_: string]: StyleImage;
};
export declare const enum MessageType {
    loadDEMTile = "LDT",
    getClusterExpansionZoom = "GCEZ",
    getClusterChildren = "GCC",
    getClusterLeaves = "GCL",
    loadData = "LD",
    getData = "GD",
    loadTile = "LT",
    reloadTile = "RT",
    getGlyphs = "GG",
    getImages = "GI",
    setImages = "SI",
    updateGlobalState = "UGS",
    setLayers = "SL",
    updateLayers = "UL",
    syncRTLPluginState = "SRPS",
    setReferrer = "SR",
    removeSource = "RS",
    removeMap = "RM",
    importScript = "IS",
    removeTile = "RMT",
    abortTile = "AT",
    removeDEMTile = "RDT",
    getResource = "GR"
}
export type RequestResponseMessageMap = {
    [MessageType.loadDEMTile]: [WorkerDEMTileParameters, DEMData];
    [MessageType.getClusterExpansionZoom]: [ClusterIDAndSource, number];
    [MessageType.getClusterChildren]: [ClusterIDAndSource, Array<GeoJSON.Feature>];
    [MessageType.getClusterLeaves]: [GetClusterLeavesParams, Array<GeoJSON.Feature>];
    [MessageType.loadData]: [LoadGeoJSONParameters, GeoJSONWorkerSourceLoadDataResult];
    [MessageType.getData]: [LoadGeoJSONParameters, GeoJSON.GeoJSON];
    [MessageType.loadTile]: [WorkerTileParameters, WorkerTileResult];
    [MessageType.reloadTile]: [WorkerTileParameters, WorkerTileResult];
    [MessageType.getGlyphs]: [GetGlyphsParameters, GetGlyphsResponse];
    [MessageType.getImages]: [GetImagesParameters, GetImagesResponse];
    [MessageType.setImages]: [string[], void];
    [MessageType.updateGlobalState]: [Record<string, any>, void];
    [MessageType.setLayers]: [Array<LayerSpecification>, void];
    [MessageType.updateLayers]: [UpdateLayersParameters, void];
    [MessageType.syncRTLPluginState]: [PluginState, PluginState];
    [MessageType.setReferrer]: [string, void];
    [MessageType.removeSource]: [RemoveSourceParams, void];
    [MessageType.removeMap]: [undefined, void];
    [MessageType.importScript]: [string, void];
    [MessageType.removeTile]: [TileParameters, void];
    [MessageType.abortTile]: [TileParameters, void];
    [MessageType.removeDEMTile]: [TileParameters, void];
    [MessageType.getResource]: [RequestParameters, GetResourceResponse<any>];
};
export type ActorMessage<T extends MessageType> = {
    type: T;
    data: RequestResponseMessageMap[T][0];
    targetMapId?: string | number | null;
    mustQueue?: boolean;
    sourceMapId?: string | number | null;
};
//# sourceMappingURL=actor_messages.d.ts.map