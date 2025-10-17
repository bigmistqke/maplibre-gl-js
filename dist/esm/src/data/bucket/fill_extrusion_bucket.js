import { FillExtrusionLayoutArray, PosArray } from '../array_types.g';
import { members as layoutAttributes, centroidAttributes } from './fill_extrusion_attributes';
import { SegmentVector } from '../segment';
import { ProgramConfigurationSet } from '../program_configuration';
import { TriangleIndexArray } from '../index_array_type';
import { EXTENT } from '../extent';
import { VectorTileFeature } from '@mapbox/vector-tile';
import { classifyRings } from '@maplibre/maplibre-gl-style-spec';
const EARCUT_MAX_RINGS = 500;
import { hasPattern, addPatternDependencies } from './pattern_bucket_features';
import { loadGeometry } from '../load_geometry';
import { toEvaluationFeature } from '../evaluation_feature';
import { EvaluationParameters } from '../../style/evaluation_parameters';
import { subdividePolygon, subdivideVertexLine } from '../../render/subdivision';
import { fillLargeMeshArrays } from '../../render/fill_large_mesh_arrays';
const FACTOR = Math.pow(2, 13);
function addVertex(vertexArray, x, y, nx, ny, nz, t, e) {
    vertexArray.emplaceBack(x, y, Math.floor(nx * FACTOR) * 2 + t, ny * FACTOR * 2, nz * FACTOR * 2, Math.round(e));
}
export class FillExtrusionBucket {
    constructor(options) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.hasPattern = false;
        this.layoutVertexArray = new FillExtrusionLayoutArray();
        this.centroidVertexArray = new PosArray();
        this.indexArray = new TriangleIndexArray();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, options.zoom);
        this.segments = new SegmentVector();
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
    }
    populate(features, options, canonical) {
        this.features = [];
        this.hasPattern = hasPattern('fill-extrusion', this.layers, options);
        for (const { feature, id, index, sourceLayerIndex } of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);
            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical))
                continue;
            const bucketFeature = {
                id,
                sourceLayerIndex,
                index,
                geometry: needGeometry ? evaluationFeature.geometry : loadGeometry(feature),
                properties: feature.properties,
                type: feature.type,
                patterns: {}
            };
            if (this.hasPattern) {
                this.features.push(addPatternDependencies('fill-extrusion', this.layers, bucketFeature, { zoom: this.zoom }, options));
            }
            else {
                this.addFeature(bucketFeature, bucketFeature.geometry, index, canonical, {}, options.subdivisionGranularity);
            }
            options.featureIndex.insert(feature, bucketFeature.geometry, index, sourceLayerIndex, this.index, true);
        }
    }
    addFeatures(options, canonical, imagePositions) {
        for (const feature of this.features) {
            const { geometry } = feature;
            this.addFeature(feature, geometry, feature.index, canonical, imagePositions, options.subdivisionGranularity);
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
        return this.layoutVertexArray.length === 0 && this.centroidVertexArray.length === 0;
    }
    uploadPending() {
        return !this.uploaded || this.programConfigurations.needsUpload;
    }
    upload(context) {
        if (!this.uploaded) {
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, layoutAttributes);
            this.centroidVertexBuffer = context.createVertexBuffer(this.centroidVertexArray, centroidAttributes.members, true);
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
        this.centroidVertexBuffer.destroy();
    }
    addFeature(feature, geometry, index, canonical, imagePositions, subdivisionGranularity) {
        for (const polygon of classifyRings(geometry, EARCUT_MAX_RINGS)) {
            const centroid = { x: 0, y: 0, sampleCount: 0 };
            const oldVertexCount = this.layoutVertexArray.length;
            this.processPolygon(centroid, canonical, feature, polygon, subdivisionGranularity);
            const addedVertices = this.layoutVertexArray.length - oldVertexCount;
            const centroidX = Math.floor(centroid.x / centroid.sampleCount);
            const centroidY = Math.floor(centroid.y / centroid.sampleCount);
            for (let i = 0; i < addedVertices; i++) {
                this.centroidVertexArray.emplaceBack(centroidX, centroidY);
            }
        }
        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, { imagePositions, canonical });
    }
    processPolygon(centroid, canonical, feature, polygon, subdivisionGranularity) {
        if (polygon.length < 1) {
            return;
        }
        if (isEntirelyOutside(polygon[0])) {
            return;
        }
        for (const ring of polygon) {
            if (ring.length === 0) {
                continue;
            }
            accumulatePointsToCentroid(centroid, ring);
        }
        const segmentReference = {
            segment: this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray)
        };
        const granularity = subdivisionGranularity.fill.getGranularityForZoomLevel(canonical.z);
        const isPolygon = VectorTileFeature.types[feature.type] === 'Polygon';
        for (const ring of polygon) {
            if (ring.length === 0) {
                continue;
            }
            if (isEntirelyOutside(ring)) {
                continue;
            }
            const subdividedRing = subdivideVertexLine(ring, granularity, isPolygon);
            this._generateSideFaces(subdividedRing, segmentReference);
        }
        if (!isPolygon)
            return;
        const subdividedPolygon = subdividePolygon(polygon, canonical, granularity, false);
        const vertexArray = this.layoutVertexArray;
        fillLargeMeshArrays((x, y) => {
            addVertex(vertexArray, x, y, 0, 0, 1, 1, 0);
        }, this.segments, this.layoutVertexArray, this.indexArray, subdividedPolygon.verticesFlattened, subdividedPolygon.indicesTriangles);
    }
    _generateSideFaces(geometry, segmentReference) {
        let edgeDistance = 0;
        for (let p = 1; p < geometry.length; p++) {
            const p1 = geometry[p];
            const p2 = geometry[p - 1];
            if (isBoundaryEdge(p1, p2)) {
                continue;
            }
            if (segmentReference.segment.vertexLength + 4 > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
                segmentReference.segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);
            }
            const perp = p1.sub(p2)._perp()._unit();
            const dist = p2.dist(p1);
            if (edgeDistance + dist > 32768)
                edgeDistance = 0;
            addVertex(this.layoutVertexArray, p1.x, p1.y, perp.x, perp.y, 0, 0, edgeDistance);
            addVertex(this.layoutVertexArray, p1.x, p1.y, perp.x, perp.y, 0, 1, edgeDistance);
            edgeDistance += dist;
            addVertex(this.layoutVertexArray, p2.x, p2.y, perp.x, perp.y, 0, 0, edgeDistance);
            addVertex(this.layoutVertexArray, p2.x, p2.y, perp.x, perp.y, 0, 1, edgeDistance);
            const bottomRight = segmentReference.segment.vertexLength;
            this.indexArray.emplaceBack(bottomRight, bottomRight + 2, bottomRight + 1);
            this.indexArray.emplaceBack(bottomRight + 1, bottomRight + 2, bottomRight + 3);
            segmentReference.segment.vertexLength += 4;
            segmentReference.segment.primitiveLength += 2;
        }
    }
}
function accumulatePointsToCentroid(centroid, geometry) {
    for (let i = 0; i < geometry.length; i++) {
        const p = geometry[i];
        if (i === geometry.length - 1 && geometry[0].x === p.x && geometry[0].y === p.y) {
            continue;
        }
        centroid.x += p.x;
        centroid.y += p.y;
        centroid.sampleCount++;
    }
}
function isBoundaryEdge(p1, p2) {
    return (p1.x === p2.x && (p1.x < 0 || p1.x > EXTENT)) ||
        (p1.y === p2.y && (p1.y < 0 || p1.y > EXTENT));
}
function isEntirelyOutside(ring) {
    return ring.every(p => p.x < 0) ||
        ring.every(p => p.x > EXTENT) ||
        ring.every(p => p.y < 0) ||
        ring.every(p => p.y > EXTENT);
}
//# sourceMappingURL=fill_extrusion_bucket.js.map