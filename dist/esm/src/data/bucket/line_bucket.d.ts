import { LineLayoutArray, LineExtLayoutArray } from '../array_types.g';
import { SegmentVector } from '../segment';
import { ProgramConfigurationSet } from '../program_configuration';
import { TriangleIndexArray } from '../index_array_type';
import type { CanonicalTileID } from '../../source/tile_id';
import type { Bucket, BucketParameters, BucketFeature, IndexedFeature, PopulateParameters } from '../bucket';
import type { LineStyleLayer } from '../../style/style_layer/line_style_layer';
import type Point from '@mapbox/point-geometry';
import type { Segment } from '../segment';
import { type RGBAImage } from '../../util/image';
import type { Context } from '../../gl/context';
import type { Texture } from '../../render/texture';
import type { IndexBuffer } from '../../gl/index_buffer';
import type { VertexBuffer } from '../../gl/vertex_buffer';
import type { FeatureStates } from '../../source/source_state';
import type { ImagePosition } from '../../render/image_atlas';
import type { VectorTileLayer } from '@mapbox/vector-tile';
import type { SubdivisionGranularitySetting } from '../../render/subdivision_granularity_settings';
type LineClips = {
    start: number;
    end: number;
};
type GradientTexture = {
    texture?: Texture;
    gradient?: RGBAImage;
    version?: number;
};
export declare class LineBucket implements Bucket {
    distance: number;
    totalDistance: number;
    maxLineLength: number;
    scaledDistance: number;
    lineClips?: LineClips;
    e1: number;
    e2: number;
    index: number;
    zoom: number;
    overscaling: number;
    layers: Array<LineStyleLayer>;
    layerIds: Array<string>;
    gradients: {
        [x: string]: GradientTexture;
    };
    stateDependentLayers: Array<any>;
    stateDependentLayerIds: Array<string>;
    patternFeatures: Array<BucketFeature>;
    lineClipsArray: Array<LineClips>;
    layoutVertexArray: LineLayoutArray;
    layoutVertexBuffer: VertexBuffer;
    layoutVertexArray2: LineExtLayoutArray;
    layoutVertexBuffer2: VertexBuffer;
    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;
    hasPattern: boolean;
    programConfigurations: ProgramConfigurationSet<LineStyleLayer>;
    segments: SegmentVector;
    uploaded: boolean;
    constructor(options: BucketParameters<LineStyleLayer>);
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
    lineFeatureClips(feature: BucketFeature): LineClips | undefined;
    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID, imagePositions: {
        [_: string]: ImagePosition;
    }, subdivisionGranularity: SubdivisionGranularitySetting): void;
    addLine(vertices: Array<Point>, feature: BucketFeature, join: string, cap: string, miterLimit: number, roundLimit: number, canonical: CanonicalTileID | undefined, subdivisionGranularity: SubdivisionGranularitySetting): void;
    addCurrentVertex(p: Point, normal: Point, endLeft: number, endRight: number, segment: Segment, round?: boolean): void;
    addHalfVertex({ x, y }: Point, extrudeX: number, extrudeY: number, round: boolean, up: boolean, dir: number, segment: Segment): void;
    updateScaledDistance(): void;
    updateDistance(prev: Point, next: Point): void;
}
export {};
//# sourceMappingURL=line_bucket.d.ts.map