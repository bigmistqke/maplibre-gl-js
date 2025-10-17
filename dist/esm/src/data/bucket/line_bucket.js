import { LineLayoutArray, LineExtLayoutArray } from '../array_types.g';
import { members as layoutAttributes } from './line_attributes';
import { members as layoutAttributesExt } from './line_attributes_ext';
import { SegmentVector } from '../segment';
import { ProgramConfigurationSet } from '../program_configuration';
import { TriangleIndexArray } from '../index_array_type';
import { EXTENT } from '../extent';
import { VectorTileFeature } from '@mapbox/vector-tile';
import { hasPattern, addPatternDependencies } from './pattern_bucket_features';
import { loadGeometry } from '../load_geometry';
import { toEvaluationFeature } from '../evaluation_feature';
import { EvaluationParameters } from '../../style/evaluation_parameters';
import { subdivideVertexLine } from '../../render/subdivision';
const EXTRUDE_SCALE = 63;
const COS_HALF_SHARP_CORNER = Math.cos(75 / 2 * (Math.PI / 180));
const SHARP_CORNER_OFFSET = 15;
const DEG_PER_TRIANGLE = 20;
const LINE_DISTANCE_BUFFER_BITS = 15;
const LINE_DISTANCE_SCALE = 1 / 2;
const MAX_LINE_DISTANCE = Math.pow(2, LINE_DISTANCE_BUFFER_BITS - 1) / LINE_DISTANCE_SCALE;
export class LineBucket {
    constructor(options) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.hasPattern = false;
        this.patternFeatures = [];
        this.lineClipsArray = [];
        this.gradients = {};
        this.layers.forEach(layer => {
            this.gradients[layer.id] = {};
        });
        this.layoutVertexArray = new LineLayoutArray();
        this.layoutVertexArray2 = new LineExtLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, options.zoom);
        this.segments = new SegmentVector();
        this.maxLineLength = 0;
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
    }
    populate(features, options, canonical) {
        this.hasPattern = hasPattern('line', this.layers, options);
        const lineSortKey = this.layers[0].layout.get('line-sort-key');
        const sortFeaturesByKey = !lineSortKey.isConstant();
        const bucketFeatures = [];
        for (const { feature, id, index, sourceLayerIndex } of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);
            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical))
                continue;
            const sortKey = sortFeaturesByKey ?
                lineSortKey.evaluate(evaluationFeature, {}, canonical) :
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
            bucketFeatures.sort((a, b) => {
                return (a.sortKey) - (b.sortKey);
            });
        }
        for (const bucketFeature of bucketFeatures) {
            const { geometry, index, sourceLayerIndex } = bucketFeature;
            if (this.hasPattern) {
                const patternBucketFeature = addPatternDependencies('line', this.layers, bucketFeature, { zoom: this.zoom }, options);
                this.patternFeatures.push(patternBucketFeature);
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
            if (this.layoutVertexArray2.length !== 0) {
                this.layoutVertexBuffer2 = context.createVertexBuffer(this.layoutVertexArray2, layoutAttributesExt);
            }
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
    lineFeatureClips(feature) {
        if (!!feature.properties && Object.prototype.hasOwnProperty.call(feature.properties, 'mapbox_clip_start') && Object.prototype.hasOwnProperty.call(feature.properties, 'mapbox_clip_end')) {
            const start = +feature.properties['mapbox_clip_start'];
            const end = +feature.properties['mapbox_clip_end'];
            return { start, end };
        }
    }
    addFeature(feature, geometry, index, canonical, imagePositions, subdivisionGranularity) {
        const layout = this.layers[0].layout;
        const join = layout.get('line-join').evaluate(feature, {});
        const cap = layout.get('line-cap');
        const miterLimit = layout.get('line-miter-limit');
        const roundLimit = layout.get('line-round-limit');
        this.lineClips = this.lineFeatureClips(feature);
        for (const line of geometry) {
            this.addLine(line, feature, join, cap, miterLimit, roundLimit, canonical, subdivisionGranularity);
        }
        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, { imagePositions, canonical });
    }
    addLine(vertices, feature, join, cap, miterLimit, roundLimit, canonical, subdivisionGranularity) {
        this.distance = 0;
        this.scaledDistance = 0;
        this.totalDistance = 0;
        const granularity = canonical ? subdivisionGranularity.line.getGranularityForZoomLevel(canonical.z) : 1;
        vertices = subdivideVertexLine(vertices, granularity);
        if (this.lineClips) {
            this.lineClipsArray.push(this.lineClips);
            for (let i = 0; i < vertices.length - 1; i++) {
                this.totalDistance += vertices[i].dist(vertices[i + 1]);
            }
            this.updateScaledDistance();
            this.maxLineLength = Math.max(this.maxLineLength, this.totalDistance);
        }
        const isPolygon = VectorTileFeature.types[feature.type] === 'Polygon';
        let len = vertices.length;
        while (len >= 2 && vertices[len - 1].equals(vertices[len - 2])) {
            len--;
        }
        let first = 0;
        while (first < len - 1 && vertices[first].equals(vertices[first + 1])) {
            first++;
        }
        if (len < (isPolygon ? 3 : 2))
            return;
        if (join === 'bevel')
            miterLimit = 1.05;
        const sharpCornerOffset = this.overscaling <= 16 ?
            SHARP_CORNER_OFFSET * EXTENT / (512 * this.overscaling) :
            0;
        const segment = this.segments.prepareSegment(len * 10, this.layoutVertexArray, this.indexArray);
        let currentVertex;
        let prevVertex;
        let nextVertex;
        let prevNormal;
        let nextNormal;
        this.e1 = this.e2 = -1;
        if (isPolygon) {
            currentVertex = vertices[len - 2];
            nextNormal = vertices[first].sub(currentVertex)._unit()._perp();
        }
        for (let i = first; i < len; i++) {
            nextVertex = i === len - 1 ?
                (isPolygon ? vertices[first + 1] : undefined) :
                vertices[i + 1];
            if (nextVertex && vertices[i].equals(nextVertex))
                continue;
            if (nextNormal)
                prevNormal = nextNormal;
            if (currentVertex)
                prevVertex = currentVertex;
            currentVertex = vertices[i];
            nextNormal = nextVertex ? nextVertex.sub(currentVertex)._unit()._perp() : prevNormal;
            prevNormal = prevNormal || nextNormal;
            let joinNormal = prevNormal.add(nextNormal);
            if (joinNormal.x !== 0 || joinNormal.y !== 0) {
                joinNormal._unit();
            }
            const cosAngle = prevNormal.x * nextNormal.x + prevNormal.y * nextNormal.y;
            const cosHalfAngle = joinNormal.x * nextNormal.x + joinNormal.y * nextNormal.y;
            const miterLength = cosHalfAngle !== 0 ? 1 / cosHalfAngle : Infinity;
            const approxAngle = 2 * Math.sqrt(2 - 2 * cosHalfAngle);
            const isSharpCorner = cosHalfAngle < COS_HALF_SHARP_CORNER && prevVertex && nextVertex;
            const lineTurnsLeft = prevNormal.x * nextNormal.y - prevNormal.y * nextNormal.x > 0;
            if (isSharpCorner && i > first) {
                const prevSegmentLength = currentVertex.dist(prevVertex);
                if (prevSegmentLength > 2 * sharpCornerOffset) {
                    const newPrevVertex = currentVertex.sub(currentVertex.sub(prevVertex)._mult(sharpCornerOffset / prevSegmentLength)._round());
                    this.updateDistance(prevVertex, newPrevVertex);
                    this.addCurrentVertex(newPrevVertex, prevNormal, 0, 0, segment);
                    prevVertex = newPrevVertex;
                }
            }
            const middleVertex = prevVertex && nextVertex;
            let currentJoin = middleVertex ? join : isPolygon ? 'butt' : cap;
            if (middleVertex && currentJoin === 'round') {
                if (miterLength < roundLimit) {
                    currentJoin = 'miter';
                }
                else if (miterLength <= 2) {
                    currentJoin = 'fakeround';
                }
            }
            if (currentJoin === 'miter' && miterLength > miterLimit) {
                currentJoin = 'bevel';
            }
            if (currentJoin === 'bevel') {
                if (miterLength > 2)
                    currentJoin = 'flipbevel';
                if (miterLength < miterLimit)
                    currentJoin = 'miter';
            }
            if (prevVertex)
                this.updateDistance(prevVertex, currentVertex);
            if (currentJoin === 'miter') {
                joinNormal._mult(miterLength);
                this.addCurrentVertex(currentVertex, joinNormal, 0, 0, segment);
            }
            else if (currentJoin === 'flipbevel') {
                if (miterLength > 100) {
                    joinNormal = nextNormal.mult(-1);
                }
                else {
                    const bevelLength = miterLength * prevNormal.add(nextNormal).mag() / prevNormal.sub(nextNormal).mag();
                    joinNormal._perp()._mult(bevelLength * (lineTurnsLeft ? -1 : 1));
                }
                this.addCurrentVertex(currentVertex, joinNormal, 0, 0, segment);
                this.addCurrentVertex(currentVertex, joinNormal.mult(-1), 0, 0, segment);
            }
            else if (currentJoin === 'bevel' || currentJoin === 'fakeround') {
                const offset = -Math.sqrt(miterLength * miterLength - 1);
                const offsetA = lineTurnsLeft ? offset : 0;
                const offsetB = lineTurnsLeft ? 0 : offset;
                if (prevVertex) {
                    this.addCurrentVertex(currentVertex, prevNormal, offsetA, offsetB, segment);
                }
                if (currentJoin === 'fakeround') {
                    const n = Math.round((approxAngle * 180 / Math.PI) / DEG_PER_TRIANGLE);
                    for (let m = 1; m < n; m++) {
                        let t = m / n;
                        if (t !== 0.5) {
                            const t2 = t - 0.5;
                            const A = 1.0904 + cosAngle * (-3.2452 + cosAngle * (3.55645 - cosAngle * 1.43519));
                            const B = 0.848013 + cosAngle * (-1.06021 + cosAngle * 0.215638);
                            t = t + t * t2 * (t - 1) * (A * t2 * t2 + B);
                        }
                        const extrude = nextNormal.sub(prevNormal)._mult(t)._add(prevNormal)._unit()._mult(lineTurnsLeft ? -1 : 1);
                        this.addHalfVertex(currentVertex, extrude.x, extrude.y, false, lineTurnsLeft, 0, segment);
                    }
                }
                if (nextVertex) {
                    this.addCurrentVertex(currentVertex, nextNormal, -offsetA, -offsetB, segment);
                }
            }
            else if (currentJoin === 'butt') {
                this.addCurrentVertex(currentVertex, joinNormal, 0, 0, segment);
            }
            else if (currentJoin === 'square') {
                const offset = prevVertex ? 1 : -1;
                this.addCurrentVertex(currentVertex, joinNormal, offset, offset, segment);
            }
            else if (currentJoin === 'round') {
                if (prevVertex) {
                    this.addCurrentVertex(currentVertex, prevNormal, 0, 0, segment);
                    this.addCurrentVertex(currentVertex, prevNormal, 1, 1, segment, true);
                }
                if (nextVertex) {
                    this.addCurrentVertex(currentVertex, nextNormal, -1, -1, segment, true);
                    this.addCurrentVertex(currentVertex, nextNormal, 0, 0, segment);
                }
            }
            if (isSharpCorner && i < len - 1) {
                const nextSegmentLength = currentVertex.dist(nextVertex);
                if (nextSegmentLength > 2 * sharpCornerOffset) {
                    const newCurrentVertex = currentVertex.add(nextVertex.sub(currentVertex)._mult(sharpCornerOffset / nextSegmentLength)._round());
                    this.updateDistance(currentVertex, newCurrentVertex);
                    this.addCurrentVertex(newCurrentVertex, nextNormal, 0, 0, segment);
                    currentVertex = newCurrentVertex;
                }
            }
        }
    }
    addCurrentVertex(p, normal, endLeft, endRight, segment, round = false) {
        const leftX = normal.x + normal.y * endLeft;
        const leftY = normal.y - normal.x * endLeft;
        const rightX = -normal.x + normal.y * endRight;
        const rightY = -normal.y - normal.x * endRight;
        this.addHalfVertex(p, leftX, leftY, round, false, endLeft, segment);
        this.addHalfVertex(p, rightX, rightY, round, true, -endRight, segment);
        if (this.distance > MAX_LINE_DISTANCE / 2 && this.totalDistance === 0) {
            this.distance = 0;
            this.updateScaledDistance();
            this.addCurrentVertex(p, normal, endLeft, endRight, segment, round);
        }
    }
    addHalfVertex({ x, y }, extrudeX, extrudeY, round, up, dir, segment) {
        const totalDistance = this.lineClips ? this.scaledDistance * (MAX_LINE_DISTANCE - 1) : this.scaledDistance;
        const linesofarScaled = totalDistance * LINE_DISTANCE_SCALE;
        this.layoutVertexArray.emplaceBack((x << 1) + (round ? 1 : 0), (y << 1) + (up ? 1 : 0), Math.round(EXTRUDE_SCALE * extrudeX) + 128, Math.round(EXTRUDE_SCALE * extrudeY) + 128, ((dir === 0 ? 0 : (dir < 0 ? -1 : 1)) + 1) | ((linesofarScaled & 0x3F) << 2), linesofarScaled >> 6);
        if (this.lineClips) {
            const progressRealigned = this.scaledDistance - this.lineClips.start;
            const endClipRealigned = this.lineClips.end - this.lineClips.start;
            const uvX = progressRealigned / endClipRealigned;
            this.layoutVertexArray2.emplaceBack(uvX, this.lineClipsArray.length);
        }
        const e = segment.vertexLength++;
        if (this.e1 >= 0 && this.e2 >= 0) {
            this.indexArray.emplaceBack(this.e1, e, this.e2);
            segment.primitiveLength++;
        }
        if (up) {
            this.e2 = e;
        }
        else {
            this.e1 = e;
        }
    }
    updateScaledDistance() {
        this.scaledDistance = this.lineClips ?
            this.lineClips.start + (this.lineClips.end - this.lineClips.start) * this.distance / this.totalDistance :
            this.distance;
    }
    updateDistance(prev, next) {
        this.distance += prev.dist(next);
        this.updateScaledDistance();
    }
}
//# sourceMappingURL=line_bucket.js.map