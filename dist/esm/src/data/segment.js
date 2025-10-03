import { warnOnce } from '../util/util';
import { register } from '../util/web_worker_transfer';
export class SegmentVector {
    constructor(segments = []) {
        this._forceNewSegmentOnNextPrepare = false;
        this.segments = segments;
    }
    prepareSegment(numVertices, layoutVertexArray, indexArray, sortKey) {
        const lastSegment = this.segments[this.segments.length - 1];
        if (numVertices > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
            warnOnce(`Max vertices per segment is ${SegmentVector.MAX_VERTEX_ARRAY_LENGTH}: bucket requested ${numVertices}. Consider using the \`fillLargeMeshArrays\` function if you require meshes with more than ${SegmentVector.MAX_VERTEX_ARRAY_LENGTH} vertices.`);
        }
        if (this._forceNewSegmentOnNextPrepare || !lastSegment || lastSegment.vertexLength + numVertices > SegmentVector.MAX_VERTEX_ARRAY_LENGTH || lastSegment.sortKey !== sortKey) {
            return this.createNewSegment(layoutVertexArray, indexArray, sortKey);
        }
        else {
            return lastSegment;
        }
    }
    createNewSegment(layoutVertexArray, indexArray, sortKey) {
        const segment = {
            vertexOffset: layoutVertexArray.length,
            primitiveOffset: indexArray.length,
            vertexLength: 0,
            primitiveLength: 0,
            vaos: {}
        };
        if (sortKey !== undefined) {
            segment.sortKey = sortKey;
        }
        this._forceNewSegmentOnNextPrepare = false;
        this.segments.push(segment);
        return segment;
    }
    getOrCreateLatestSegment(layoutVertexArray, indexArray, sortKey) {
        return this.prepareSegment(0, layoutVertexArray, indexArray, sortKey);
    }
    forceNewSegmentOnNextPrepare() {
        this._forceNewSegmentOnNextPrepare = true;
    }
    get() {
        return this.segments;
    }
    destroy() {
        for (const segment of this.segments) {
            for (const k in segment.vaos) {
                segment.vaos[k].destroy();
            }
        }
    }
    static simpleSegment(vertexOffset, primitiveOffset, vertexLength, primitiveLength) {
        return new SegmentVector([{
                vertexOffset,
                primitiveOffset,
                vertexLength,
                primitiveLength,
                vaos: {},
                sortKey: 0
            }]);
    }
}
SegmentVector.MAX_VERTEX_ARRAY_LENGTH = Math.pow(2, 16) - 1;
register('SegmentVector', SegmentVector);
//# sourceMappingURL=segment.js.map