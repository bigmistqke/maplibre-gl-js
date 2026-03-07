import {FillLayoutArray} from '../array_types.g';

import {members as layoutAttributes} from './fill_attributes';
import {SegmentVector} from '../segment';
import {ProgramConfigurationSet} from '../program_configuration';
import {LineIndexArray, TriangleIndexArray} from '../index_array_type';
import {register} from '../../util/web_worker_transfer';
import {hasPattern, addPatternDependencies} from './pattern_bucket_features';
import {triangulatePolygon} from '../primitives/triangulate_polygon';
import {initBucketState, extractFeatures, uploadBucket, destroyBucket} from './bucket_utils';

import type {CanonicalTileID} from '../../tile/tile_id';
import type {
    Bucket,
    BucketParameters,
    BucketFeature,
    IndexedFeature,
    PopulateParameters
} from '../bucket';
import type {FillStyleLayer} from '../../style/style_layer/fill_style_layer';
import type {Context} from '../../gl/context';
import type {IndexBuffer} from '../../gl/index_buffer';
import type {VertexBuffer} from '../../gl/vertex_buffer';
import type Point from '@mapbox/point-geometry';
import type {FeatureStates} from '../../source/source_state';
import type {ImagePosition} from '../../render/image_atlas';
import type {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';
import type {VectorTileLayerLike} from '@maplibre/vt-pbf';

export class FillBucket implements Bucket {
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

    hasDependencies: boolean;
    programConfigurations: ProgramConfigurationSet<FillStyleLayer>;
    segments: SegmentVector;
    segments2: SegmentVector;
    uploaded: boolean;

    constructor(options: BucketParameters<FillStyleLayer>) {
        const state = initBucketState(options, () => new FillLayoutArray());
        Object.assign(this, state);
        this.patternFeatures = [];
        this.indexArray2 = new LineIndexArray();
        this.segments2 = new SegmentVector();
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID) {
        this.hasDependencies = hasPattern('fill', this.layers, options);
        const bucketFeatures = extractFeatures(features, this.layers[0], this.zoom, canonical, options, 'fill-sort-key');

        for (const bucketFeature of bucketFeatures) {
            const {geometry, index, sourceLayerIndex} = bucketFeature;

            if (this.hasDependencies) {
                const patternFeature = addPatternDependencies('fill', this.layers, bucketFeature, {zoom: this.zoom}, options);
                // pattern features are added only once the pattern is loaded into the image atlas
                // so are stored during populate until later updated with positions by tile worker in addFeatures
                this.patternFeatures.push(patternFeature);
            } else {
                this.addFeature(bucketFeature, geometry, index, canonical, {}, options.subdivisionGranularity);
            }

            const feature = features[index].feature;
            options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
        }
    }

    update(states: FeatureStates, vtLayer: VectorTileLayerLike, imagePositions: {
        [_: string]: ImagePosition;
    }) {
        if (!this.stateDependentLayers.length) return;
        this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, {
            imagePositions
        });
    }

    addFeatures(options: PopulateParameters, canonical: CanonicalTileID, imagePositions: {
        [_: string]: ImagePosition;
    }) {
        for (const feature of this.patternFeatures) {
            this.addFeature(feature, feature.geometry, feature.index, canonical, imagePositions, options.subdivisionGranularity);
        }
    }

    isEmpty() {
        return this.layoutVertexArray.length === 0;
    }

    uploadPending(): boolean {
        return !this.uploaded || this.programConfigurations.needsUpload;
    }

    upload(context: Context) {
        if (!this.uploaded) {
            this.indexBuffer2 = context.createIndexBuffer(this.indexArray2);
        }
        uploadBucket(this as any, context, layoutAttributes);
    }

    destroy() {
        destroyBucket(this as any);
        this.indexBuffer2?.destroy();
        this.segments2?.destroy();
    }

    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID, imagePositions: {
        [_: string]: ImagePosition;
    }, subdivisionGranularity: SubdivisionGranularitySetting) {
        const vertexArray = this.layoutVertexArray;

        triangulatePolygon(geometry, canonical, subdivisionGranularity.fill.getGranularityForZoomLevel(canonical.z), {
            addVertex: (x, y) => { vertexArray.emplaceBack(x, y); },
            vertexArray: this.layoutVertexArray,
            triangleIndexArray: this.indexArray,
            triangleSegments: this.segments,
            lineIndexArray: this.indexArray2,
            lineSegments: this.segments2,
        });

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, {imagePositions, canonical});
    }
}

register('FillBucket', FillBucket, {omit: ['layers', 'patternFeatures']});
