import { FillLayoutArray } from '../array_types.g';
import { SegmentVector } from '../segment';
import { ProgramConfigurationSet } from '../program_configuration';
import { LineIndexArray, TriangleIndexArray } from '../index_array_type';
import type { CanonicalTileID } from '../../source/tile_id';
import type { Bucket, BucketParameters, BucketFeature, IndexedFeature, PopulateParameters } from '../bucket';
import type { FillStyleLayer } from '../../style/style_layer/fill_style_layer';
import type { Context } from '../../gl/context';
import type { IndexBuffer } from '../../gl/index_buffer';
import type { VertexBuffer } from '../../gl/vertex_buffer';
import type Point from '@mapbox/point-geometry';
import type { FeatureStates } from '../../source/source_state';
import type { ImagePosition } from '../../render/image_atlas';
import type { VectorTileLayer } from '@mapbox/vector-tile';
import type { SubdivisionGranularitySetting } from '../../render/subdivision_granularity_settings';
export declare class FillBucket implements Bucket {
    index: number;
    zoom: number;
    overscaling: number;
    layers: Array<FillStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<FillStyleLayer>;
    stateDependentLayerIds: Array<string>;
    patternFeatures: Array<BucketFeature>;
    layoutVertexArray: FillLayoutArray;
    layoutVertexBuffer: VertexBuffer;
    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;
    indexArray2: LineIndexArray;
    indexBuffer2: IndexBuffer;
    hasPattern: boolean;
    programConfigurations: ProgramConfigurationSet<FillStyleLayer>;
    segments: SegmentVector;
    segments2: SegmentVector;
    uploaded: boolean;
    constructor(options: BucketParameters<FillStyleLayer>);
    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID): void;
    update(states: FeatureStates, vtLayer: VectorTileLayer, imagePositions: {
        [_: string]: ImagePosition;
    }): void;
    addFeatures(options: PopulateParameters, canonical: CanonicalTileID, imagePositions: {
        [_: string]: ImagePosition;
    }): void;
    isEmpty(): boolean;
    uploadPending(): boolean;
    upload(context: Context): void;
    destroy(): void;
    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID, imagePositions: {
        [_: string]: ImagePosition;
    }, subdivisionGranularity: SubdivisionGranularitySetting): void;
}
//# sourceMappingURL=fill_bucket.d.ts.map