import type { CollisionBoxArray } from './array_types.g';
import type { Style } from '../style/style';
import type { TypedStyleLayer } from '../style/style_layer/typed_style_layer';
import type { FeatureIndex } from './feature_index';
import type { Context } from '../gl/context';
import type { FeatureStates } from '../source/source_state';
import type { ImagePosition } from '../render/image_atlas';
import type { CanonicalTileID } from '../source/tile_id';
import type { VectorTileFeature, VectorTileLayer } from '@mapbox/vector-tile';
import type Point from '@mapbox/point-geometry';
import type { SubdivisionGranularitySetting } from '../render/subdivision_granularity_settings';
export type BucketParameters<Layer extends TypedStyleLayer> = {
    index: number;
    layers: Array<Layer>;
    zoom: number;
    pixelRatio: number;
    overscaling: number;
    collisionBoxArray: CollisionBoxArray;
    sourceLayerIndex: number;
    sourceID: string;
};
export type PopulateParameters = {
    featureIndex: FeatureIndex;
    iconDependencies: {};
    patternDependencies: {};
    glyphDependencies: {};
    availableImages: Array<string>;
    subdivisionGranularity: SubdivisionGranularitySetting;
};
export type IndexedFeature = {
    feature: VectorTileFeature;
    id: number | string;
    index: number;
    sourceLayerIndex: number;
};
export type BucketFeature = {
    index: number;
    sourceLayerIndex: number;
    geometry: Array<Array<Point>>;
    properties: any;
    type: 0 | 1 | 2 | 3;
    id?: any;
    readonly patterns: {
        [_: string]: {
            'min': string;
            'mid': string;
            'max': string;
        };
    };
    sortKey?: number;
};
export interface Bucket {
    layerIds: Array<string>;
    hasPattern: boolean;
    readonly layers: Array<any>;
    readonly stateDependentLayers: Array<any>;
    readonly stateDependentLayerIds: Array<string>;
    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID): void;
    update(states: FeatureStates, vtLayer: VectorTileLayer, imagePositions: {
        [_: string]: ImagePosition;
    }): void;
    isEmpty(): boolean;
    upload(context: Context): void;
    uploadPending(): boolean;
    destroy(): void;
}
export declare function deserialize(input: Array<Bucket>, style: Style): {
    [_: string]: Bucket;
};
//# sourceMappingURL=bucket.d.ts.map