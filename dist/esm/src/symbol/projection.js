import Point from '@mapbox/point-geometry';
import { mat2, mat4, vec2, vec4 } from 'gl-matrix';
import * as symbolSize from './symbol_size';
import { addDynamicAttributes } from '../data/bucket/symbol_bucket';
import { WritingMode } from '../symbol/shaping';
import { findLineIntersection } from '../util/util';
export function getPitchedLabelPlaneMatrix(rotateWithMap, transform, pixelsToTileUnits) {
    const m = mat4.create();
    if (!rotateWithMap) {
        const { vecSouth, vecEast } = getTileSkewVectors(transform);
        const skew = mat2.create();
        skew[0] = vecEast[0];
        skew[1] = vecEast[1];
        skew[2] = vecSouth[0];
        skew[3] = vecSouth[1];
        mat2.invert(skew, skew);
        m[0] = skew[0];
        m[1] = skew[1];
        m[4] = skew[2];
        m[5] = skew[3];
    }
    mat4.scale(m, m, [1 / pixelsToTileUnits, 1 / pixelsToTileUnits, 1]);
    return m;
}
export function getGlCoordMatrix(pitchWithMap, rotateWithMap, transform, pixelsToTileUnits) {
    if (pitchWithMap) {
        const m = mat4.create();
        if (!rotateWithMap) {
            const { vecSouth, vecEast } = getTileSkewVectors(transform);
            m[0] = vecEast[0];
            m[1] = vecEast[1];
            m[4] = vecSouth[0];
            m[5] = vecSouth[1];
        }
        mat4.scale(m, m, [pixelsToTileUnits, pixelsToTileUnits, 1]);
        return m;
    }
    else {
        return transform.pixelsToClipSpaceMatrix;
    }
}
export function getTileSkewVectors(transform) {
    const cosRoll = Math.cos(transform.rollInRadians);
    const sinRoll = Math.sin(transform.rollInRadians);
    const cosPitch = Math.cos(transform.pitchInRadians);
    const cosBearing = Math.cos(transform.bearingInRadians);
    const sinBearing = Math.sin(transform.bearingInRadians);
    const vecSouth = vec2.create();
    vecSouth[0] = -cosBearing * cosPitch * sinRoll - sinBearing * cosRoll;
    vecSouth[1] = -sinBearing * cosPitch * sinRoll + cosBearing * cosRoll;
    const vecSouthLen = vec2.length(vecSouth);
    if (vecSouthLen < 1.0e-9) {
        vec2.zero(vecSouth);
    }
    else {
        vec2.scale(vecSouth, vecSouth, 1 / vecSouthLen);
    }
    const vecEast = vec2.create();
    vecEast[0] = cosBearing * cosPitch * cosRoll - sinBearing * sinRoll;
    vecEast[1] = sinBearing * cosPitch * cosRoll + cosBearing * sinRoll;
    const vecEastLen = vec2.length(vecEast);
    if (vecEastLen < 1.0e-9) {
        vec2.zero(vecEast);
    }
    else {
        vec2.scale(vecEast, vecEast, 1 / vecEastLen);
    }
    return { vecEast, vecSouth };
}
export function projectWithMatrix(x, y, matrix, getElevation) {
    let pos;
    if (getElevation) {
        pos = [x, y, getElevation(x, y), 1];
        vec4.transformMat4(pos, pos, matrix);
    }
    else {
        pos = [x, y, 0, 1];
        xyTransformMat4(pos, pos, matrix);
    }
    const w = pos[3];
    return {
        point: new Point(pos[0] / w, pos[1] / w),
        signedDistanceFromCamera: w,
        isOccluded: false
    };
}
export function getPerspectiveRatio(cameraToCenterDistance, signedDistanceFromCamera) {
    return 0.5 + 0.5 * (cameraToCenterDistance / signedDistanceFromCamera);
}
function isVisible(p, clippingBuffer) {
    const inPaddedViewport = (p.x >= -clippingBuffer[0] &&
        p.x <= clippingBuffer[0] &&
        p.y >= -clippingBuffer[1] &&
        p.y <= clippingBuffer[1]);
    return inPaddedViewport;
}
export function updateLineLabels(bucket, painter, isText, pitchedLabelPlaneMatrix, pitchedLabelPlaneMatrixInverse, pitchWithMap, keepUpright, rotateToLine, unwrappedTileID, viewportWidth, viewportHeight, translation, getElevation) {
    const sizeData = isText ? bucket.textSizeData : bucket.iconSizeData;
    const partiallyEvaluatedSize = symbolSize.evaluateSizeForZoom(sizeData, painter.transform.zoom);
    const clippingBuffer = [256 / painter.width * 2 + 1, 256 / painter.height * 2 + 1];
    const dynamicLayoutVertexArray = isText ?
        bucket.text.dynamicLayoutVertexArray :
        bucket.icon.dynamicLayoutVertexArray;
    dynamicLayoutVertexArray.clear();
    const lineVertexArray = bucket.lineVertexArray;
    const placedSymbols = isText ? bucket.text.placedSymbolArray : bucket.icon.placedSymbolArray;
    const aspectRatio = painter.transform.width / painter.transform.height;
    let useVertical = false;
    for (let s = 0; s < placedSymbols.length; s++) {
        const symbol = placedSymbols.get(s);
        if (symbol.hidden || symbol.writingMode === WritingMode.vertical && !useVertical) {
            hideGlyphs(symbol.numGlyphs, dynamicLayoutVertexArray);
            continue;
        }
        useVertical = false;
        const tileAnchorPoint = new Point(symbol.anchorX, symbol.anchorY);
        const projectionCache = { projections: {}, offsets: {}, cachedAnchorPoint: undefined, anyProjectionOccluded: false };
        const projectionContext = {
            getElevation,
            pitchedLabelPlaneMatrix,
            lineVertexArray,
            pitchWithMap,
            projectionCache,
            transform: painter.transform,
            tileAnchorPoint,
            unwrappedTileID,
            width: viewportWidth,
            height: viewportHeight,
            translation
        };
        const anchorPos = projectTileCoordinatesToClipSpace(symbol.anchorX, symbol.anchorY, projectionContext);
        if (!isVisible(anchorPos.point, clippingBuffer)) {
            hideGlyphs(symbol.numGlyphs, dynamicLayoutVertexArray);
            continue;
        }
        const cameraToAnchorDistance = anchorPos.signedDistanceFromCamera;
        const perspectiveRatio = getPerspectiveRatio(painter.transform.cameraToCenterDistance, cameraToAnchorDistance);
        const fontSize = symbolSize.evaluateSizeForFeature(sizeData, partiallyEvaluatedSize, symbol);
        const pitchScaledFontSize = pitchWithMap ? (fontSize * painter.transform.getPitchedTextCorrection(symbol.anchorX, symbol.anchorY, unwrappedTileID) / perspectiveRatio) : fontSize * perspectiveRatio;
        const placeUnflipped = placeGlyphsAlongLine({
            projectionContext,
            pitchedLabelPlaneMatrixInverse,
            symbol,
            fontSize: pitchScaledFontSize,
            flip: false,
            keepUpright,
            glyphOffsetArray: bucket.glyphOffsetArray,
            dynamicLayoutVertexArray,
            aspectRatio,
            rotateToLine,
        });
        useVertical = placeUnflipped.useVertical;
        if (placeUnflipped.notEnoughRoom || useVertical ||
            (placeUnflipped.needsFlipping &&
                placeGlyphsAlongLine({
                    projectionContext,
                    pitchedLabelPlaneMatrixInverse,
                    symbol,
                    fontSize: pitchScaledFontSize,
                    flip: true,
                    keepUpright,
                    glyphOffsetArray: bucket.glyphOffsetArray,
                    dynamicLayoutVertexArray,
                    aspectRatio,
                    rotateToLine,
                }).notEnoughRoom)) {
            hideGlyphs(symbol.numGlyphs, dynamicLayoutVertexArray);
        }
    }
    if (isText) {
        bucket.text.dynamicLayoutVertexBuffer.updateData(dynamicLayoutVertexArray);
    }
    else {
        bucket.icon.dynamicLayoutVertexBuffer.updateData(dynamicLayoutVertexArray);
    }
}
export function placeFirstAndLastGlyph(fontScale, glyphOffsetArray, lineOffsetX, lineOffsetY, flip, symbol, rotateToLine, projectionContext) {
    const glyphEndIndex = symbol.glyphStartIndex + symbol.numGlyphs;
    const lineStartIndex = symbol.lineStartIndex;
    const lineEndIndex = symbol.lineStartIndex + symbol.lineLength;
    const firstGlyphOffset = glyphOffsetArray.getoffsetX(symbol.glyphStartIndex);
    const lastGlyphOffset = glyphOffsetArray.getoffsetX(glyphEndIndex - 1);
    const firstPlacedGlyph = placeGlyphAlongLine(fontScale * firstGlyphOffset, lineOffsetX, lineOffsetY, flip, symbol.segment, lineStartIndex, lineEndIndex, projectionContext, rotateToLine);
    if (!firstPlacedGlyph)
        return null;
    const lastPlacedGlyph = placeGlyphAlongLine(fontScale * lastGlyphOffset, lineOffsetX, lineOffsetY, flip, symbol.segment, lineStartIndex, lineEndIndex, projectionContext, rotateToLine);
    if (!lastPlacedGlyph)
        return null;
    if (projectionContext.projectionCache.anyProjectionOccluded) {
        return null;
    }
    return { first: firstPlacedGlyph, last: lastPlacedGlyph };
}
function requiresOrientationChange(writingMode, firstPoint, lastPoint, aspectRatio) {
    if (writingMode === WritingMode.horizontal) {
        const rise = Math.abs(lastPoint.y - firstPoint.y);
        const run = Math.abs(lastPoint.x - firstPoint.x) * aspectRatio;
        if (rise > run) {
            return { useVertical: true };
        }
    }
    if (writingMode === WritingMode.vertical ? firstPoint.y < lastPoint.y : firstPoint.x > lastPoint.x) {
        return { needsFlipping: true };
    }
    return null;
}
function placeGlyphsAlongLine(args) {
    const { projectionContext, pitchedLabelPlaneMatrixInverse, symbol, fontSize, flip, keepUpright, glyphOffsetArray, dynamicLayoutVertexArray, aspectRatio, rotateToLine } = args;
    const fontScale = fontSize / 24;
    const lineOffsetX = symbol.lineOffsetX * fontScale;
    const lineOffsetY = symbol.lineOffsetY * fontScale;
    let placedGlyphs;
    if (symbol.numGlyphs > 1) {
        const glyphEndIndex = symbol.glyphStartIndex + symbol.numGlyphs;
        const lineStartIndex = symbol.lineStartIndex;
        const lineEndIndex = symbol.lineStartIndex + symbol.lineLength;
        const firstAndLastGlyph = placeFirstAndLastGlyph(fontScale, glyphOffsetArray, lineOffsetX, lineOffsetY, flip, symbol, rotateToLine, projectionContext);
        if (!firstAndLastGlyph) {
            return { notEnoughRoom: true };
        }
        const firstPoint = projectFromLabelPlaneToClipSpace(firstAndLastGlyph.first.point.x, firstAndLastGlyph.first.point.y, projectionContext, pitchedLabelPlaneMatrixInverse);
        const lastPoint = projectFromLabelPlaneToClipSpace(firstAndLastGlyph.last.point.x, firstAndLastGlyph.last.point.y, projectionContext, pitchedLabelPlaneMatrixInverse);
        if (keepUpright && !flip) {
            const orientationChange = requiresOrientationChange(symbol.writingMode, firstPoint, lastPoint, aspectRatio);
            if (orientationChange) {
                return orientationChange;
            }
        }
        placedGlyphs = [firstAndLastGlyph.first];
        for (let glyphIndex = symbol.glyphStartIndex + 1; glyphIndex < glyphEndIndex - 1; glyphIndex++) {
            const placedGlyph = placeGlyphAlongLine(fontScale * glyphOffsetArray.getoffsetX(glyphIndex), lineOffsetX, lineOffsetY, flip, symbol.segment, lineStartIndex, lineEndIndex, projectionContext, rotateToLine);
            if (!placedGlyph) {
                return { notEnoughRoom: true };
            }
            placedGlyphs.push(placedGlyph);
        }
        placedGlyphs.push(firstAndLastGlyph.last);
    }
    else {
        if (keepUpright && !flip) {
            const a = projectTileCoordinatesToLabelPlane(projectionContext.tileAnchorPoint.x, projectionContext.tileAnchorPoint.y, projectionContext).point;
            const tileVertexIndex = (symbol.lineStartIndex + symbol.segment + 1);
            const tileSegmentEnd = new Point(projectionContext.lineVertexArray.getx(tileVertexIndex), projectionContext.lineVertexArray.gety(tileVertexIndex));
            const projectedVertex = projectTileCoordinatesToLabelPlane(tileSegmentEnd.x, tileSegmentEnd.y, projectionContext);
            const b = (projectedVertex.signedDistanceFromCamera > 0) ?
                projectedVertex.point :
                projectTruncatedLineSegmentToLabelPlane(projectionContext.tileAnchorPoint, tileSegmentEnd, a, 1, projectionContext);
            const clipSpaceA = projectFromLabelPlaneToClipSpace(a.x, a.y, projectionContext, pitchedLabelPlaneMatrixInverse);
            const clipSpaceB = projectFromLabelPlaneToClipSpace(b.x, b.y, projectionContext, pitchedLabelPlaneMatrixInverse);
            const orientationChange = requiresOrientationChange(symbol.writingMode, clipSpaceA, clipSpaceB, aspectRatio);
            if (orientationChange) {
                return orientationChange;
            }
        }
        const singleGlyph = placeGlyphAlongLine(fontScale * glyphOffsetArray.getoffsetX(symbol.glyphStartIndex), lineOffsetX, lineOffsetY, flip, symbol.segment, symbol.lineStartIndex, symbol.lineStartIndex + symbol.lineLength, projectionContext, rotateToLine);
        if (!singleGlyph || projectionContext.projectionCache.anyProjectionOccluded)
            return { notEnoughRoom: true };
        placedGlyphs = [singleGlyph];
    }
    for (const glyph of placedGlyphs) {
        addDynamicAttributes(dynamicLayoutVertexArray, glyph.point, glyph.angle);
    }
    return {};
}
function projectTruncatedLineSegmentToLabelPlane(previousTilePoint, currentTilePoint, previousProjectedPoint, minimumLength, projectionContext) {
    const unitVertexToBeProjected = previousTilePoint.add(previousTilePoint.sub(currentTilePoint)._unit());
    const projectedUnitVertex = projectTileCoordinatesToLabelPlane(unitVertexToBeProjected.x, unitVertexToBeProjected.y, projectionContext).point;
    const projectedUnitSegment = previousProjectedPoint.sub(projectedUnitVertex);
    return previousProjectedPoint.add(projectedUnitSegment._mult(minimumLength / projectedUnitSegment.mag()));
}
export function projectLineVertexToLabelPlane(index, projectionContext, syntheticVertexArgs) {
    const cache = projectionContext.projectionCache;
    if (cache.projections[index]) {
        return cache.projections[index];
    }
    const currentVertex = new Point(projectionContext.lineVertexArray.getx(index), projectionContext.lineVertexArray.gety(index));
    const projection = projectTileCoordinatesToLabelPlane(currentVertex.x, currentVertex.y, projectionContext);
    if (projection.signedDistanceFromCamera > 0) {
        cache.projections[index] = projection.point;
        cache.anyProjectionOccluded = cache.anyProjectionOccluded || projection.isOccluded;
        return projection.point;
    }
    const previousLineVertexIndex = index - syntheticVertexArgs.direction;
    const previousTilePoint = syntheticVertexArgs.distanceFromAnchor === 0 ?
        projectionContext.tileAnchorPoint :
        new Point(projectionContext.lineVertexArray.getx(previousLineVertexIndex), projectionContext.lineVertexArray.gety(previousLineVertexIndex));
    const minimumLength = syntheticVertexArgs.absOffsetX - syntheticVertexArgs.distanceFromAnchor + 1;
    return projectTruncatedLineSegmentToLabelPlane(previousTilePoint, currentVertex, syntheticVertexArgs.previousVertex, minimumLength, projectionContext);
}
export function projectTileCoordinatesToLabelPlane(x, y, projectionContext) {
    const translatedX = x + projectionContext.translation[0];
    const translatedY = y + projectionContext.translation[1];
    let projection;
    if (projectionContext.pitchWithMap) {
        projection = projectWithMatrix(translatedX, translatedY, projectionContext.pitchedLabelPlaneMatrix, projectionContext.getElevation);
        projection.isOccluded = false;
    }
    else {
        projection = projectionContext.transform.projectTileCoordinates(translatedX, translatedY, projectionContext.unwrappedTileID, projectionContext.getElevation);
        projection.point.x = (projection.point.x * 0.5 + 0.5) * projectionContext.width;
        projection.point.y = (-projection.point.y * 0.5 + 0.5) * projectionContext.height;
    }
    return projection;
}
function projectFromLabelPlaneToClipSpace(x, y, projectionContext, pitchedLabelPlaneMatrixInverse) {
    if (projectionContext.pitchWithMap) {
        const pos = [x, y, 0, 1];
        vec4.transformMat4(pos, pos, pitchedLabelPlaneMatrixInverse);
        return projectionContext.transform.projectTileCoordinates(pos[0] / pos[3], pos[1] / pos[3], projectionContext.unwrappedTileID, projectionContext.getElevation).point;
    }
    else {
        return {
            x: (x / projectionContext.width) * 2.0 - 1.0,
            y: 1.0 - (y / projectionContext.height) * 2.0
        };
    }
}
export function projectTileCoordinatesToClipSpace(x, y, projectionContext) {
    const projection = projectionContext.transform.projectTileCoordinates(x, y, projectionContext.unwrappedTileID, projectionContext.getElevation);
    return projection;
}
export function transformToOffsetNormal(segmentVector, offset, direction) {
    return segmentVector._unit()._perp()._mult(offset * direction);
}
export function findOffsetIntersectionPoint(index, prevToCurrentOffsetNormal, currentVertex, lineStartIndex, lineEndIndex, offsetPreviousVertex, lineOffsetY, projectionContext, syntheticVertexArgs) {
    if (projectionContext.projectionCache.offsets[index]) {
        return projectionContext.projectionCache.offsets[index];
    }
    const offsetCurrentVertex = currentVertex.add(prevToCurrentOffsetNormal);
    if (index + syntheticVertexArgs.direction < lineStartIndex || index + syntheticVertexArgs.direction >= lineEndIndex) {
        projectionContext.projectionCache.offsets[index] = offsetCurrentVertex;
        return offsetCurrentVertex;
    }
    const nextVertex = projectLineVertexToLabelPlane(index + syntheticVertexArgs.direction, projectionContext, syntheticVertexArgs);
    const currentToNextOffsetNormal = transformToOffsetNormal(nextVertex.sub(currentVertex), lineOffsetY, syntheticVertexArgs.direction);
    const offsetNextSegmentBegin = currentVertex.add(currentToNextOffsetNormal);
    const offsetNextSegmentEnd = nextVertex.add(currentToNextOffsetNormal);
    projectionContext.projectionCache.offsets[index] = findLineIntersection(offsetPreviousVertex, offsetCurrentVertex, offsetNextSegmentBegin, offsetNextSegmentEnd) || offsetCurrentVertex;
    return projectionContext.projectionCache.offsets[index];
}
export function placeGlyphAlongLine(offsetX, lineOffsetX, lineOffsetY, flip, anchorSegment, lineStartIndex, lineEndIndex, projectionContext, rotateToLine) {
    const combinedOffsetX = flip ?
        offsetX - lineOffsetX :
        offsetX + lineOffsetX;
    let direction = combinedOffsetX > 0 ? 1 : -1;
    let angle = 0;
    if (flip) {
        direction *= -1;
        angle = Math.PI;
    }
    if (direction < 0)
        angle += Math.PI;
    let currentIndex = direction > 0 ?
        lineStartIndex + anchorSegment :
        lineStartIndex + anchorSegment + 1;
    let anchorPoint;
    if (projectionContext.projectionCache.cachedAnchorPoint) {
        anchorPoint = projectionContext.projectionCache.cachedAnchorPoint;
    }
    else {
        anchorPoint = projectTileCoordinatesToLabelPlane(projectionContext.tileAnchorPoint.x, projectionContext.tileAnchorPoint.y, projectionContext).point;
        projectionContext.projectionCache.cachedAnchorPoint = anchorPoint;
    }
    let currentVertex = anchorPoint;
    let previousVertex = anchorPoint;
    let offsetIntersectionPoint;
    let offsetPreviousVertex;
    let distanceFromAnchor = 0;
    let currentSegmentDistance = 0;
    const absOffsetX = Math.abs(combinedOffsetX);
    const pathVertices = [];
    let currentLineSegment;
    while (distanceFromAnchor + currentSegmentDistance <= absOffsetX) {
        currentIndex += direction;
        if (currentIndex < lineStartIndex || currentIndex >= lineEndIndex)
            return null;
        distanceFromAnchor += currentSegmentDistance;
        previousVertex = currentVertex;
        offsetPreviousVertex = offsetIntersectionPoint;
        const syntheticVertexArgs = {
            absOffsetX,
            direction,
            distanceFromAnchor,
            previousVertex
        };
        currentVertex = projectLineVertexToLabelPlane(currentIndex, projectionContext, syntheticVertexArgs);
        if (lineOffsetY === 0) {
            pathVertices.push(previousVertex);
            currentLineSegment = currentVertex.sub(previousVertex);
        }
        else {
            let prevToCurrentOffsetNormal;
            const prevToCurrent = currentVertex.sub(previousVertex);
            if (prevToCurrent.mag() === 0) {
                const nextVertex = projectLineVertexToLabelPlane(currentIndex + direction, projectionContext, syntheticVertexArgs);
                prevToCurrentOffsetNormal = transformToOffsetNormal(nextVertex.sub(currentVertex), lineOffsetY, direction);
            }
            else {
                prevToCurrentOffsetNormal = transformToOffsetNormal(prevToCurrent, lineOffsetY, direction);
            }
            if (!offsetPreviousVertex)
                offsetPreviousVertex = previousVertex.add(prevToCurrentOffsetNormal);
            offsetIntersectionPoint = findOffsetIntersectionPoint(currentIndex, prevToCurrentOffsetNormal, currentVertex, lineStartIndex, lineEndIndex, offsetPreviousVertex, lineOffsetY, projectionContext, syntheticVertexArgs);
            pathVertices.push(offsetPreviousVertex);
            currentLineSegment = offsetIntersectionPoint.sub(offsetPreviousVertex);
        }
        currentSegmentDistance = currentLineSegment.mag();
    }
    const segmentInterpolationT = (absOffsetX - distanceFromAnchor) / currentSegmentDistance;
    const p = currentLineSegment._mult(segmentInterpolationT)._add(offsetPreviousVertex || previousVertex);
    const segmentAngle = angle + Math.atan2(currentVertex.y - previousVertex.y, currentVertex.x - previousVertex.x);
    pathVertices.push(p);
    return {
        point: p,
        angle: rotateToLine ? segmentAngle : 0.0,
        path: pathVertices
    };
}
const hiddenGlyphAttributes = new Float32Array([-Infinity, -Infinity, 0, -Infinity, -Infinity, 0, -Infinity, -Infinity, 0, -Infinity, -Infinity, 0]);
export function hideGlyphs(num, dynamicLayoutVertexArray) {
    for (let i = 0; i < num; i++) {
        const offset = dynamicLayoutVertexArray.length;
        dynamicLayoutVertexArray.resize(offset + 4);
        dynamicLayoutVertexArray.float32.set(hiddenGlyphAttributes, offset * 3);
    }
}
export function xyTransformMat4(out, a, m) {
    const x = a[0], y = a[1];
    out[0] = m[0] * x + m[4] * y + m[12];
    out[1] = m[1] * x + m[5] * y + m[13];
    out[3] = m[3] * x + m[7] * y + m[15];
    return out;
}
export function projectPathSpecialProjection(projectedPath, projectionContext) {
    const inverseLabelPlaneMatrix = mat4.create();
    mat4.invert(inverseLabelPlaneMatrix, projectionContext.pitchedLabelPlaneMatrix);
    return projectedPath.map(p => {
        const backProjected = projectWithMatrix(p.x, p.y, inverseLabelPlaneMatrix, projectionContext.getElevation);
        const projected = projectionContext.transform.projectTileCoordinates(backProjected.point.x, backProjected.point.y, projectionContext.unwrappedTileID, projectionContext.getElevation);
        projected.point.x = (projected.point.x * 0.5 + 0.5) * projectionContext.width;
        projected.point.y = (-projected.point.y * 0.5 + 0.5) * projectionContext.height;
        return projected;
    });
}
export function pathSlicedToLongestUnoccluded(path) {
    let longestUnoccludedStart = 0;
    let longestUnoccludedLength = 0;
    let currentUnoccludedStart = 0;
    let currentUnoccludedLength = 0;
    for (let i = 0; i < path.length; i++) {
        if (path[i].isOccluded) {
            currentUnoccludedStart = i + 1;
            currentUnoccludedLength = 0;
        }
        else {
            currentUnoccludedLength++;
            if (currentUnoccludedLength > longestUnoccludedLength) {
                longestUnoccludedLength = currentUnoccludedLength;
                longestUnoccludedStart = currentUnoccludedStart;
            }
        }
    }
    return path.slice(longestUnoccludedStart, longestUnoccludedStart + longestUnoccludedLength);
}
//# sourceMappingURL=projection.js.map