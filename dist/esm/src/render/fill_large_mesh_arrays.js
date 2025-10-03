import { SegmentVector } from '../data/segment';
export function fillLargeMeshArrays(addVertex, segmentsTriangles, vertexArray, triangleIndexArray, flattened, triangleIndices, segmentsLines, lineIndexArray, lineList) {
    const numVertices = flattened.length / 2;
    const hasLines = segmentsLines && lineIndexArray && lineList;
    if (numVertices < SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
        const triangleSegment = segmentsTriangles.prepareSegment(numVertices, vertexArray, triangleIndexArray);
        const triangleIndex = triangleSegment.vertexLength;
        for (let i = 0; i < triangleIndices.length; i += 3) {
            triangleIndexArray.emplaceBack(triangleIndex + triangleIndices[i], triangleIndex + triangleIndices[i + 1], triangleIndex + triangleIndices[i + 2]);
        }
        triangleSegment.vertexLength += numVertices;
        triangleSegment.primitiveLength += triangleIndices.length / 3;
        let lineIndicesStart;
        let lineSegment;
        if (hasLines) {
            lineSegment = segmentsLines.prepareSegment(numVertices, vertexArray, lineIndexArray);
            lineIndicesStart = lineSegment.vertexLength;
            lineSegment.vertexLength += numVertices;
        }
        for (let i = 0; i < flattened.length; i += 2) {
            addVertex(flattened[i], flattened[i + 1]);
        }
        if (hasLines) {
            for (let listIndex = 0; listIndex < lineList.length; listIndex++) {
                const lineIndices = lineList[listIndex];
                for (let i = 1; i < lineIndices.length; i += 2) {
                    lineIndexArray.emplaceBack(lineIndicesStart + lineIndices[i - 1], lineIndicesStart + lineIndices[i]);
                }
                lineSegment.primitiveLength += lineIndices.length / 2;
            }
        }
    }
    else {
        fillSegmentsTriangles(segmentsTriangles, vertexArray, triangleIndexArray, flattened, triangleIndices, addVertex);
        if (hasLines) {
            fillSegmentsLines(segmentsLines, vertexArray, lineIndexArray, flattened, lineList, addVertex);
        }
        segmentsTriangles.forceNewSegmentOnNextPrepare();
        segmentsLines === null || segmentsLines === void 0 ? void 0 : segmentsLines.forceNewSegmentOnNextPrepare();
    }
}
function copyOrReuseVertex(actualVertexIndices, flattened, addVertex, totalVerticesCreated, oldIndex, needsCopy, segment) {
    if (needsCopy) {
        const newIndex = totalVerticesCreated.count;
        addVertex(flattened[oldIndex * 2], flattened[oldIndex * 2 + 1]);
        actualVertexIndices[oldIndex] = totalVerticesCreated.count;
        totalVerticesCreated.count++;
        segment.vertexLength++;
        return newIndex;
    }
    else {
        return actualVertexIndices[oldIndex];
    }
}
function fillSegmentsTriangles(segmentsTriangles, vertexArray, triangleIndexArray, flattened, triangleIndices, addVertex) {
    const actualVertexIndices = [];
    for (let i = 0; i < flattened.length / 2; i++) {
        actualVertexIndices.push(-1);
    }
    const totalVerticesCreated = { count: 0 };
    let currentSegmentCutoff = 0;
    let segment = segmentsTriangles.getOrCreateLatestSegment(vertexArray, triangleIndexArray);
    let baseVertex = segment.vertexLength;
    for (let primitiveEndIndex = 2; primitiveEndIndex < triangleIndices.length; primitiveEndIndex += 3) {
        const i0 = triangleIndices[primitiveEndIndex - 2];
        const i1 = triangleIndices[primitiveEndIndex - 1];
        const i2 = triangleIndices[primitiveEndIndex];
        let i0needsVertexCopy = actualVertexIndices[i0] < currentSegmentCutoff;
        let i1needsVertexCopy = actualVertexIndices[i1] < currentSegmentCutoff;
        let i2needsVertexCopy = actualVertexIndices[i2] < currentSegmentCutoff;
        const vertexCopyCount = (i0needsVertexCopy ? 1 : 0) + (i1needsVertexCopy ? 1 : 0) + (i2needsVertexCopy ? 1 : 0);
        if (segment.vertexLength + vertexCopyCount > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
            segment = segmentsTriangles.createNewSegment(vertexArray, triangleIndexArray);
            currentSegmentCutoff = totalVerticesCreated.count;
            i0needsVertexCopy = true;
            i1needsVertexCopy = true;
            i2needsVertexCopy = true;
            baseVertex = 0;
        }
        const actualIndex0 = copyOrReuseVertex(actualVertexIndices, flattened, addVertex, totalVerticesCreated, i0, i0needsVertexCopy, segment);
        const actualIndex1 = copyOrReuseVertex(actualVertexIndices, flattened, addVertex, totalVerticesCreated, i1, i1needsVertexCopy, segment);
        const actualIndex2 = copyOrReuseVertex(actualVertexIndices, flattened, addVertex, totalVerticesCreated, i2, i2needsVertexCopy, segment);
        triangleIndexArray.emplaceBack(baseVertex + actualIndex0 - currentSegmentCutoff, baseVertex + actualIndex1 - currentSegmentCutoff, baseVertex + actualIndex2 - currentSegmentCutoff);
        segment.primitiveLength++;
    }
}
function fillSegmentsLines(segmentsLines, vertexArray, lineIndexArray, flattened, lineList, addVertex) {
    const actualVertexIndices = [];
    for (let i = 0; i < flattened.length / 2; i++) {
        actualVertexIndices.push(-1);
    }
    const totalVerticesCreated = { count: 0 };
    let currentSegmentCutoff = 0;
    let segment = segmentsLines.getOrCreateLatestSegment(vertexArray, lineIndexArray);
    let baseVertex = segment.vertexLength;
    for (let lineListIndex = 0; lineListIndex < lineList.length; lineListIndex++) {
        const currentLine = lineList[lineListIndex];
        for (let lineVertex = 1; lineVertex < lineList[lineListIndex].length; lineVertex += 2) {
            const i0 = currentLine[lineVertex - 1];
            const i1 = currentLine[lineVertex];
            let i0needsVertexCopy = actualVertexIndices[i0] < currentSegmentCutoff;
            let i1needsVertexCopy = actualVertexIndices[i1] < currentSegmentCutoff;
            const vertexCopyCount = (i0needsVertexCopy ? 1 : 0) + (i1needsVertexCopy ? 1 : 0);
            if (segment.vertexLength + vertexCopyCount > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
                segment = segmentsLines.createNewSegment(vertexArray, lineIndexArray);
                currentSegmentCutoff = totalVerticesCreated.count;
                i0needsVertexCopy = true;
                i1needsVertexCopy = true;
                baseVertex = 0;
            }
            const actualIndex0 = copyOrReuseVertex(actualVertexIndices, flattened, addVertex, totalVerticesCreated, i0, i0needsVertexCopy, segment);
            const actualIndex1 = copyOrReuseVertex(actualVertexIndices, flattened, addVertex, totalVerticesCreated, i1, i1needsVertexCopy, segment);
            lineIndexArray.emplaceBack(baseVertex + actualIndex0 - currentSegmentCutoff, baseVertex + actualIndex1 - currentSegmentCutoff);
            segment.primitiveLength++;
        }
    }
}
//# sourceMappingURL=fill_large_mesh_arrays.js.map