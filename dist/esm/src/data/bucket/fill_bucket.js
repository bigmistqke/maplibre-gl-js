import { FillLayoutArray } from '../array_types.g';
import { members as layoutAttributes } from './fill_attributes';
import { SegmentVector } from '../segment';
import { ProgramConfigurationSet } from '../program_configuration';
import { LineIndexArray, TriangleIndexArray } from '../index_array_type';
import { classifyRings } from '@maplibre/maplibre-gl-style-spec';
const EARCUT_MAX_RINGS = 500;
import { register } from '../../util/web_worker_transfer';
import { hasPattern, addPatternDependencies } from './pattern_bucket_features';
import { loadGeometry } from '../load_geometry';
import { toEvaluationFeature } from '../evaluation_feature';
import { EvaluationParameters } from '../../style/evaluation_parameters';
import { subdividePolygon } from '../../render/subdivision';
import { fillLargeMeshArrays } from '../../render/fill_large_mesh_arrays';
export class FillBucket {
    constructor(options) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.hasPattern = false;
        this.patternFeatures = [];
        this.layoutVertexArray = new FillLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.indexArray2 = new LineIndexArray();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, options.zoom);
        this.segments = new SegmentVector();
        this.segments2 = new SegmentVector();
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
    }
    populate(features, options, canonical) {
        this.hasPattern = hasPattern('fill', this.layers, options);
        const fillSortKey = this.layers[0].layout.get('fill-sort-key');
        const sortFeaturesByKey = !fillSortKey.isConstant();
        const bucketFeatures = [];
        for (const { feature, id, index, sourceLayerIndex } of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);
            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical))
                continue;
            const sortKey = sortFeaturesByKey ?
                fillSortKey.evaluate(evaluationFeature, {}, canonical, options.availableImages) :
                undefined;
            const bucketFeature = {
                id,
                properties: feature.properties,
                type: feature.type,
                sourceLayerIndex,
                index,
                geometry: needGeometry ? evaluationFeature.geometry : loadGeometry(feature),
                patterns: {},
                sortKey
            };
            bucketFeatures.push(bucketFeature);
        }
        if (sortFeaturesByKey) {
            bucketFeatures.sort((a, b) => a.sortKey - b.sortKey);
        }
        for (const bucketFeature of bucketFeatures) {
            const { geometry, index, sourceLayerIndex } = bucketFeature;
            if (this.hasPattern) {
                const patternFeature = addPatternDependencies('fill', this.layers, bucketFeature, { zoom: this.zoom }, options);
                this.patternFeatures.push(patternFeature);
            }
            else {
                this.addFeature(bucketFeature, geometry, index, canonical, {}, options.subdivisionGranularity);
            }
            const feature = features[index].feature;
            options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
        }
    }
    update(states, vtLayer, imagePositions) {
        if (!this.stateDependentLayers.length)
            return;
        this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, {
            imagePositions
        });
    }
    addFeatures(options, canonical, imagePositions) {
        for (const feature of this.patternFeatures) {
            this.addFeature(feature, feature.geometry, feature.index, canonical, imagePositions, options.subdivisionGranularity);
        }
    }
    isEmpty() {
        return this.layoutVertexArray.length === 0;
    }
    uploadPending() {
        return !this.uploaded || this.programConfigurations.needsUpload;
    }
    upload(context) {
        if (!this.uploaded) {
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, layoutAttributes);
            this.indexBuffer = context.createIndexBuffer(this.indexArray);
            this.indexBuffer2 = context.createIndexBuffer(this.indexArray2);
        }
        this.programConfigurations.upload(context);
        this.uploaded = true;
    }
    destroy() {
        if (!this.layoutVertexBuffer)
            return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.indexBuffer2.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
        this.segments2.destroy();
    }
    addFeature(feature, geometry, index, canonical, imagePositions, subdivisionGranularity) {
        for (const polygon of classifyRings(geometry, EARCUT_MAX_RINGS)) {
            const subdivided = subdividePolygon(polygon, canonical, subdivisionGranularity.fill.getGranularityForZoomLevel(canonical.z));
            const vertexArray = this.layoutVertexArray;
            fillLargeMeshArrays((x, y) => {
                vertexArray.emplaceBack(x, y);
            }, this.segments, this.layoutVertexArray, this.indexArray, subdivided.verticesFlattened, subdivided.indicesTriangles, this.segments2, this.indexArray2, subdivided.indicesLineList);
        }
        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, { imagePositions, canonical });
    }
}
register('FillBucket', FillBucket, { omit: ['layers', 'patternFeatures'] });
//# sourceMappingURL=fill_bucket.js.map