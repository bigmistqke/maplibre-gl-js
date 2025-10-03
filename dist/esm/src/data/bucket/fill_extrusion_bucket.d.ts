import { FillExtrusionLayoutArray, PosArray } from '../array_types.g';
import { SegmentVector } from '../segment';
import { ProgramConfigurationSet } from '../program_configuration';
import { TriangleIndexArray } from '../index_array_type';
import { type VectorTileLayer } from '@mapbox/vector-tile';
import type { CanonicalTileID } from '../../source/tile_id';
import type { Bucket, BucketParameters, BucketFeature, IndexedFeature, PopulateParameters } from '../bucket';
import type { FillExtrusionStyleLayer } from '../../style/style_layer/fill_extrusion_style_layer';
import type { Context } from '../../gl/context';
import type { IndexBuffer } from '../../gl/index_buffer';
import type { VertexBuffer } from '../../gl/vertex_buffer';
import type Point from '@mapbox/point-geometry';
import type { FeatureStates } from '../../source/source_state';
import type { ImagePosition } from '../../render/image_atlas';
import type { SubdivisionGranularitySetting } from '../../render/subdivision_granularity_settings';
export declare class FillExtrusionBucket implements Bucket {
    index: number;
    zoom: number;
    overscaling: number;
    layers: Array<FillExtrusionStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<FillExtrusionStyleLayer>;
    stateDependentLayerIds: Array<string>;
    layoutVertexArray: FillExtrusionLayoutArray;
    layoutVertexBuffer: VertexBuffer;
    centroidVertexArray: PosArray;
    centroidVertexBuffer: VertexBuffer;
    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;
    hasPattern: boolean;
    programConfigurations: ProgramConfigurationSet<FillExtrusionStyleLayer>;
    segments: SegmentVector;
    uploaded: boolean;
    features: Array<BucketFeature>;
    constructor(options: BucketParameters<FillExtrusionStyleLayer>);
    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID): void;
    addFeatures(options: PopulateParameters, canonical: CanonicalTileID, imagePositions: {
        [_: string]: ImagePosition;
    }): void;
    update(states: FeatureStates, vtLayer: VectorTileLayer, imagePositions: {
        [_: string]: ImagePosition;
    }): void;
    isEmpty(): boolean;
    uploadPending(): boolean;
    upload(context: Context): void;
    destroy(): void;
    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID, imagePositions: {
        [_: string]: ImagePosition;
    }, subdivisionGranularity: SubdivisionGranularitySetting): void;
    private processPolygon;
    private _generateSideFaces;
}
//# sourceMappingURL=fill_extrusion_bucket.d.ts.map