import { CircleLayoutArray } from '../array_types.g';
import { SegmentVector } from '../segment';
import { ProgramConfigurationSet } from '../program_configuration';
import { TriangleIndexArray } from '../index_array_type';
import type { CanonicalTileID } from '../../source/tile_id';
import type { Bucket, BucketParameters, BucketFeature, IndexedFeature, PopulateParameters } from '../bucket';
import type { CircleStyleLayer } from '../../style/style_layer/circle_style_layer';
import type { HeatmapStyleLayer } from '../../style/style_layer/heatmap_style_layer';
import type { Context } from '../../gl/context';
import type { IndexBuffer } from '../../gl/index_buffer';
import type { VertexBuffer } from '../../gl/vertex_buffer';
import type Point from '@mapbox/point-geometry';
import type { FeatureStates } from '../../source/source_state';
import type { ImagePosition } from '../../render/image_atlas';
import type { VectorTileLayer } from '@mapbox/vector-tile';
import { type CircleGranularity } from '../../render/subdivision_granularity_settings';
export declare class CircleBucket<Layer extends CircleStyleLayer | HeatmapStyleLayer> implements Bucket {
    index: number;
    zoom: number;
    overscaling: number;
    layerIds: Array<string>;
    layers: Array<Layer>;
    stateDependentLayers: Array<Layer>;
    stateDependentLayerIds: Array<string>;
    layoutVertexArray: CircleLayoutArray;
    layoutVertexBuffer: VertexBuffer;
    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;
    hasPattern: boolean;
    programConfigurations: ProgramConfigurationSet<Layer>;
    segments: SegmentVector;
    uploaded: boolean;
    constructor(options: BucketParameters<Layer>);
    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID): void;
    update(states: FeatureStates, vtLayer: VectorTileLayer, imagePositions: {
        [_: string]: ImagePosition;
    }): void;
    isEmpty(): boolean;
    uploadPending(): boolean;
    upload(context: Context): void;
    destroy(): void;
    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID, granularity?: CircleGranularity): void;
}
//# sourceMappingURL=circle_bucket.d.ts.map