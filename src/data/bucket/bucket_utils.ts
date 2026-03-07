import {SegmentVector} from '../segment';
import {ProgramConfigurationSet} from '../program_configuration';
import {TriangleIndexArray, LineIndexArray} from '../index_array_type';
import {loadGeometry} from '../load_geometry';
import {toEvaluationFeature} from '../evaluation_feature';
import {EvaluationParameters} from '../../style/evaluation_parameters';

import type {StructArray, StructArrayLayout} from '../../util/struct_array';
import type {Context} from '../../gl/context';
import type {IndexBuffer} from '../../gl/index_buffer';
import type {VertexBuffer} from '../../gl/vertex_buffer';
import type {CanonicalTileID} from '../../tile/tile_id';
import type {TypedStyleLayer} from '../../style/style_layer/typed_style_layer';
import type {
    BucketParameters,
    BucketFeature,
    IndexedFeature,
    PopulateParameters,
} from '../bucket';

/**
 * Common bucket state — the fields that every bucket has.
 */
export interface BucketState<Layer extends TypedStyleLayer> {
    index: number;
    zoom: number;
    overscaling: number;
    layers: Array<Layer>;
    layerIds: Array<string>;
    stateDependentLayerIds: Array<string>;
    stateDependentLayers: Array<Layer>;
    hasDependencies: boolean;
    uploaded: boolean;

    layoutVertexArray: StructArray;
    layoutVertexBuffer: VertexBuffer;
    programConfigurations: ProgramConfigurationSet<Layer>;
    segments: SegmentVector;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;
}

/**
 * Initialize common bucket state from BucketParameters.
 */
export function initBucketState<Layer extends TypedStyleLayer>(
    options: BucketParameters<Layer>,
    createLayoutArray: () => StructArray,
): Omit<BucketState<Layer>, 'layoutVertexBuffer' | 'indexBuffer' | 'stateDependentLayers'> {
    return {
        index: options.index,
        zoom: options.zoom,
        overscaling: options.overscaling,
        layers: options.layers,
        layerIds: options.layers.map(l => l.id),
        stateDependentLayerIds: options.layers.filter(l => l.isStateDependent()).map(l => l.id),
        hasDependencies: false,
        uploaded: false,
        layoutVertexArray: createLayoutArray(),
        programConfigurations: new ProgramConfigurationSet(options.layers, options.zoom),
        segments: new SegmentVector(),
        indexArray: new TriangleIndexArray(),
    };
}

/**
 * Filter and extract features from a vector tile layer.
 * Handles geometry loading, evaluation, filtering, and sort key evaluation.
 */
export function extractFeatures<Layer extends TypedStyleLayer>(
    features: Array<IndexedFeature>,
    layer: Layer,
    zoom: number,
    canonical: CanonicalTileID,
    options: PopulateParameters,
    sortKeyProperty?: string,
): Array<BucketFeature> {
    const sortKey = sortKeyProperty ? layer.layout.get(sortKeyProperty as any) : null;
    const sortFeaturesByKey = sortKey && !sortKey.isConstant();
    const bucketFeatures: BucketFeature[] = [];

    for (const {feature, id, index, sourceLayerIndex} of features) {
        const needGeometry = layer._featureFilter.needGeometry;
        const evaluationFeature = toEvaluationFeature(feature, needGeometry);

        if (!layer._featureFilter.filter(new EvaluationParameters(zoom), evaluationFeature, canonical)) continue;

        const sortKeyValue = sortFeaturesByKey
            ? sortKey.evaluate(evaluationFeature, {}, canonical, options.availableImages)
            : undefined;

        bucketFeatures.push({
            id,
            properties: feature.properties,
            type: feature.type,
            sourceLayerIndex,
            index,
            geometry: needGeometry ? evaluationFeature.geometry : loadGeometry(feature),
            patterns: {},
            sortKey: sortKeyValue,
        });
    }

    if (sortFeaturesByKey) {
        bucketFeatures.sort((a, b) => a.sortKey - b.sortKey);
    }

    return bucketFeatures;
}

/**
 * Upload common bucket buffers to the GPU.
 */
export function uploadBucket<Layer extends TypedStyleLayer>(
    state: BucketState<Layer>,
    context: Context,
    layoutAttributes: StructArrayLayout['members'],
) {
    if (!state.uploaded) {
        state.layoutVertexBuffer = context.createVertexBuffer(state.layoutVertexArray, layoutAttributes);
        state.indexBuffer = context.createIndexBuffer(state.indexArray);
    }
    state.programConfigurations.upload(context);
    state.uploaded = true;
}

/**
 * Destroy common bucket GPU resources.
 */
export function destroyBucket<Layer extends TypedStyleLayer>(state: BucketState<Layer>) {
    if (!state.layoutVertexBuffer) return;
    state.layoutVertexBuffer.destroy();
    state.indexBuffer.destroy();
    state.programConfigurations.destroy();
    state.segments.destroy();
}
