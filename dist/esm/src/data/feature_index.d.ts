import type Point from '@mapbox/point-geometry';
import { TransferableGridIndex } from '../util/transferable_grid_index';
import { DictionaryCoder } from '../util/dictionary_coder';
import { type VectorTileLayer, type VectorTileFeature } from '@mapbox/vector-tile';
import { GeoJSONFeature } from '../util/vectortile_to_geojson';
import { type OverscaledTileID } from '../source/tile_id';
import { type SourceFeatureState } from '../source/source_state';
import { FeatureIndexArray } from './array_types.g';
import { type mat4 } from 'gl-matrix';
import type { StyleLayer } from '../style/style_layer';
import type { FeatureFilter, FilterSpecification, PromoteIdSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { IReadonlyTransform } from '../geo/transform_interface';
type QueryParameters = {
    scale: number;
    pixelPosMatrix: mat4;
    transform: IReadonlyTransform;
    tileSize: number;
    queryGeometry: Array<Point>;
    cameraQueryGeometry: Array<Point>;
    queryPadding: number;
    getElevation: undefined | ((x: number, y: number) => number);
    params: {
        filter?: FilterSpecification;
        layers?: Set<string> | null;
        availableImages?: Array<string>;
        globalState?: Record<string, any>;
    };
};
export type QueryResults = {
    [_: string]: QueryResultsItem[];
};
export type QueryResultsItem = {
    featureIndex: number;
    feature: GeoJSONFeature;
    intersectionZ?: boolean | number;
};
export declare class FeatureIndex {
    tileID: OverscaledTileID;
    x: number;
    y: number;
    z: number;
    grid: TransferableGridIndex;
    grid3D: TransferableGridIndex;
    featureIndexArray: FeatureIndexArray;
    promoteId?: PromoteIdSpecification;
    rawTileData: ArrayBuffer;
    bucketLayerIDs: Array<Array<string>>;
    vtLayers: {
        [_: string]: VectorTileLayer;
    };
    sourceLayerCoder: DictionaryCoder;
    constructor(tileID: OverscaledTileID, promoteId?: PromoteIdSpecification | null);
    insert(feature: VectorTileFeature, geometry: Array<Array<Point>>, featureIndex: number, sourceLayerIndex: number, bucketIndex: number, is3D?: boolean): void;
    loadVTLayers(): {
        [_: string]: VectorTileLayer;
    };
    query(args: QueryParameters, styleLayers: {
        [_: string]: StyleLayer;
    }, serializedLayers: {
        [_: string]: any;
    }, sourceFeatureState: SourceFeatureState): QueryResults;
    loadMatchingFeature(result: QueryResults, bucketIndex: number, sourceLayerIndex: number, featureIndex: number, filter: FeatureFilter, filterLayerIDs: Set<string> | undefined, availableImages: Array<string>, styleLayers: {
        [_: string]: StyleLayer;
    }, serializedLayers: {
        [_: string]: any;
    }, sourceFeatureState?: SourceFeatureState, intersectionTest?: (feature: VectorTileFeature, styleLayer: StyleLayer, featureState: any, id: string | number | void) => boolean | number): void;
    lookupSymbolFeatures(symbolFeatureIndexes: Array<number>, serializedLayers: {
        [_: string]: StyleLayer;
    }, bucketIndex: number, sourceLayerIndex: number, filterParams: {
        filterSpec: FilterSpecification;
        globalState: Record<string, any>;
    }, filterLayerIDs: Set<string> | null, availableImages: Array<string>, styleLayers: {
        [_: string]: StyleLayer;
    }): QueryResults;
    hasLayer(id: string): boolean;
    getId(feature: VectorTileFeature, sourceLayerId: string): string | number;
}
export {};
//# sourceMappingURL=feature_index.d.ts.map