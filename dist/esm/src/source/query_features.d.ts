import type Point from '@mapbox/point-geometry';
import type { SourceCache } from './source_cache';
import type { StyleLayer } from '../style/style_layer';
import type { CollisionIndex } from '../symbol/collision_index';
import type { IReadonlyTransform } from '../geo/transform_interface';
import type { RetainedQueryData } from '../symbol/placement';
import type { FilterSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { GeoJSONFeature, MapGeoJSONFeature } from '../util/vectortile_to_geojson';
import type { QueryResultsItem } from '../data/feature_index';
import type { OverscaledTileID } from './tile_id';
export type QueryRenderedFeaturesOptions = {
    layers?: Array<string> | Set<string>;
    filter?: FilterSpecification;
    availableImages?: Array<string>;
    validate?: boolean;
};
export type QueryRenderedFeaturesOptionsStrict = Omit<QueryRenderedFeaturesOptions, 'layers'> & {
    layers: Set<string> | null;
    globalState?: Record<string, any>;
};
export type QuerySourceFeatureOptions = {
    sourceLayer?: string;
    filter?: FilterSpecification;
    validate?: boolean;
};
export type QuerySourceFeatureOptionsStrict = QuerySourceFeatureOptions & {
    globalState?: Record<string, any>;
};
export type QueryRenderedFeaturesResults = {
    [key: string]: QueryRenderedFeaturesResultsItem[];
};
export type QueryRenderedFeaturesResultsItem = QueryResultsItem & {
    feature: MapGeoJSONFeature;
};
export declare function queryRenderedFeatures(sourceCache: SourceCache, styleLayers: {
    [_: string]: StyleLayer;
}, serializedLayers: {
    [_: string]: any;
}, queryGeometry: Array<Point>, params: QueryRenderedFeaturesOptionsStrict | undefined, transform: IReadonlyTransform, getElevation: undefined | ((id: OverscaledTileID, x: number, y: number) => number)): QueryRenderedFeaturesResults;
export declare function queryRenderedSymbols(styleLayers: {
    [_: string]: StyleLayer;
}, serializedLayers: {
    [_: string]: StyleLayer;
}, sourceCaches: {
    [_: string]: SourceCache;
}, queryGeometry: Array<Point>, params: QueryRenderedFeaturesOptionsStrict, collisionIndex: CollisionIndex, retainedQueryData: {
    [_: number]: RetainedQueryData;
}): QueryRenderedFeaturesResults;
export declare function querySourceFeatures(sourceCache: SourceCache, params: QuerySourceFeatureOptionsStrict | undefined): GeoJSONFeature[];
//# sourceMappingURL=query_features.d.ts.map