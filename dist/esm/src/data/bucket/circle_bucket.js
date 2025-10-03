import { CircleLayoutArray } from '../array_types.g';
import { members as layoutAttributes } from './circle_attributes';
import { SegmentVector } from '../segment';
import { ProgramConfigurationSet } from '../program_configuration';
import { TriangleIndexArray } from '../index_array_type';
import { loadGeometry } from '../load_geometry';
import { toEvaluationFeature } from '../evaluation_feature';
import { EXTENT } from '../extent';
import { register } from '../../util/web_worker_transfer';
import { EvaluationParameters } from '../../style/evaluation_parameters';
const VERTEX_MIN_VALUE = -32768;
function addCircleVertex(layoutVertexArray, x, y, extrudeX, extrudeY) {
    layoutVertexArray.emplaceBack(VERTEX_MIN_VALUE + (x * 8) + extrudeX, VERTEX_MIN_VALUE + (y * 8) + extrudeY);
}
export class CircleBucket {
    constructor(options) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.hasPattern = false;
        this.layoutVertexArray = new CircleLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.segments = new SegmentVector();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, options.zoom);
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
    }
    populate(features, options, canonical) {
        const styleLayer = this.layers[0];
        const bucketFeatures = [];
        let circleSortKey = null;
        let sortFeaturesByKey = false;
        let subdivide = styleLayer.type === 'heatmap';
        if (styleLayer.type === 'circle') {
            const circleStyle = styleLayer;
            circleSortKey = circleStyle.layout.get('circle-sort-key');
            sortFeaturesByKey = !circleSortKey.isConstant();
            subdivide = subdivide || circleStyle.paint.get('circle-pitch-alignment') === 'map';
        }
        const granularity = subdivide ? options.subdivisionGranularity.circle : 1;
        for (const { feature, id, index, sourceLayerIndex } of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);
            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical))
                continue;
            const sortKey = sortFeaturesByKey ?
                circleSortKey.evaluate(evaluationFeature, {}, canonical) :
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
            const feature = features[index].feature;
            this.addFeature(bucketFeature, geometry, index, canonical, granularity);
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
        }
        this.programConfigurations.upload(context);
        this.uploaded = true;
    }
    destroy() {
        if (!this.layoutVertexBuffer)
            return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
    }
    addFeature(feature, geometry, index, canonical, granularity = 1) {
        let extrudes;
        switch (granularity) {
            case 1:
                extrudes = [0, 7];
                break;
            case 3:
                extrudes = [0, 2, 5, 7];
                break;
            case 5:
                extrudes = [0, 1, 3, 4, 6, 7];
                break;
            case 7:
                extrudes = [0, 1, 2, 3, 4, 5, 6, 7];
                break;
            default:
                throw new Error(`Invalid circle bucket granularity: ${granularity}; valid values are 1, 3, 5, 7.`);
        }
        const verticesPerAxis = extrudes.length;
        for (const ring of geometry) {
            for (const point of ring) {
                const vx = point.x;
                const vy = point.y;
                if (vx < 0 || vx >= EXTENT || vy < 0 || vy >= EXTENT) {
                    continue;
                }
                const segment = this.segments.prepareSegment(verticesPerAxis * verticesPerAxis, this.layoutVertexArray, this.indexArray, feature.sortKey);
                const index = segment.vertexLength;
                for (let y = 0; y < verticesPerAxis; y++) {
                    for (let x = 0; x < verticesPerAxis; x++) {
                        addCircleVertex(this.layoutVertexArray, vx, vy, extrudes[x], extrudes[y]);
                    }
                }
                for (let y = 0; y < verticesPerAxis - 1; y++) {
                    for (let x = 0; x < verticesPerAxis - 1; x++) {
                        const lowerIndex = index + y * verticesPerAxis + x;
                        const upperIndex = index + (y + 1) * verticesPerAxis + x;
                        this.indexArray.emplaceBack(lowerIndex, upperIndex + 1, lowerIndex + 1);
                        this.indexArray.emplaceBack(lowerIndex, upperIndex, upperIndex + 1);
                    }
                }
                segment.vertexLength += verticesPerAxis * verticesPerAxis;
                segment.primitiveLength += (verticesPerAxis - 1) * (verticesPerAxis - 1) * 2;
            }
        }
        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, { imagePositions: {}, canonical });
    }
}
register('CircleBucket', CircleBucket, { omit: ['layers'] });
//# sourceMappingURL=circle_bucket.js.map