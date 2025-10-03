import { interpolates } from '@maplibre/maplibre-gl-style-spec';
import { Anchor } from '../symbol/anchor';
import { checkMaxAngle } from './check_max_angle';
export { getAnchors, getCenterAnchor };
function getLineLength(line) {
    let lineLength = 0;
    for (let k = 0; k < line.length - 1; k++) {
        lineLength += line[k].dist(line[k + 1]);
    }
    return lineLength;
}
function getAngleWindowSize(shapedText, glyphSize, boxScale) {
    return shapedText ?
        3 / 5 * glyphSize * boxScale :
        0;
}
function getShapedLabelLength(shapedText, shapedIcon) {
    return Math.max(shapedText ? shapedText.right - shapedText.left : 0, shapedIcon ? shapedIcon.right - shapedIcon.left : 0);
}
function getCenterAnchor(line, maxAngle, shapedText, shapedIcon, glyphSize, boxScale) {
    const angleWindowSize = getAngleWindowSize(shapedText, glyphSize, boxScale);
    const labelLength = getShapedLabelLength(shapedText, shapedIcon) * boxScale;
    let prevDistance = 0;
    const centerDistance = getLineLength(line) / 2;
    for (let i = 0; i < line.length - 1; i++) {
        const a = line[i], b = line[i + 1];
        const segmentDistance = a.dist(b);
        if (prevDistance + segmentDistance > centerDistance) {
            const t = (centerDistance - prevDistance) / segmentDistance, x = interpolates.number(a.x, b.x, t), y = interpolates.number(a.y, b.y, t);
            const anchor = new Anchor(x, y, b.angleTo(a), i);
            anchor._round();
            if (!angleWindowSize || checkMaxAngle(line, anchor, labelLength, angleWindowSize, maxAngle)) {
                return anchor;
            }
            else {
                return;
            }
        }
        prevDistance += segmentDistance;
    }
}
function getAnchors(line, spacing, maxAngle, shapedText, shapedIcon, glyphSize, boxScale, overscaling, tileExtent) {
    const angleWindowSize = getAngleWindowSize(shapedText, glyphSize, boxScale);
    const shapedLabelLength = getShapedLabelLength(shapedText, shapedIcon);
    const labelLength = shapedLabelLength * boxScale;
    const isLineContinued = line[0].x === 0 || line[0].x === tileExtent || line[0].y === 0 || line[0].y === tileExtent;
    if (spacing - labelLength < spacing / 4) {
        spacing = labelLength + spacing / 4;
    }
    const fixedExtraOffset = glyphSize * 2;
    const offset = !isLineContinued ?
        ((shapedLabelLength / 2 + fixedExtraOffset) * boxScale * overscaling) % spacing :
        (spacing / 2 * overscaling) % spacing;
    return resample(line, offset, spacing, angleWindowSize, maxAngle, labelLength, isLineContinued, false, tileExtent);
}
function resample(line, offset, spacing, angleWindowSize, maxAngle, labelLength, isLineContinued, placeAtMiddle, tileExtent) {
    const halfLabelLength = labelLength / 2;
    const lineLength = getLineLength(line);
    let distance = 0, markedDistance = offset - spacing;
    let anchors = [];
    for (let i = 0; i < line.length - 1; i++) {
        const a = line[i], b = line[i + 1];
        const segmentDist = a.dist(b), angle = b.angleTo(a);
        while (markedDistance + spacing < distance + segmentDist) {
            markedDistance += spacing;
            const t = (markedDistance - distance) / segmentDist, x = interpolates.number(a.x, b.x, t), y = interpolates.number(a.y, b.y, t);
            if (x >= 0 && x < tileExtent && y >= 0 && y < tileExtent &&
                markedDistance - halfLabelLength >= 0 &&
                markedDistance + halfLabelLength <= lineLength) {
                const anchor = new Anchor(x, y, angle, i);
                anchor._round();
                if (!angleWindowSize || checkMaxAngle(line, anchor, labelLength, angleWindowSize, maxAngle)) {
                    anchors.push(anchor);
                }
            }
        }
        distance += segmentDist;
    }
    if (!placeAtMiddle && !anchors.length && !isLineContinued) {
        anchors = resample(line, distance / 2, spacing, angleWindowSize, maxAngle, labelLength, isLineContinued, true, tileExtent);
    }
    return anchors;
}
//# sourceMappingURL=get_anchors.js.map