import Point from '@mapbox/point-geometry';
import { clipLine } from './clip_line';
import { PathInterpolator } from './path_interpolator';
import * as intersectionTests from '../util/intersection_tests';
import { GridIndex } from './grid_index';
import { mat4, vec4 } from 'gl-matrix';
import ONE_EM from '../symbol/one_em';
import { getTileSkewVectors, pathSlicedToLongestUnoccluded, placeFirstAndLastGlyph, projectPathSpecialProjection, xyTransformMat4 } from '../symbol/projection';
import { clamp, getAABB } from '../util/util';
import { Bounds } from '../geo/bounds';
export const viewportPadding = 100;
export class CollisionIndex {
    constructor(transform, grid = new GridIndex(transform.width + 2 * viewportPadding, transform.height + 2 * viewportPadding, 25), ignoredGrid = new GridIndex(transform.width + 2 * viewportPadding, transform.height + 2 * viewportPadding, 25)) {
        this.transform = transform;
        this.grid = grid;
        this.ignoredGrid = ignoredGrid;
        this.pitchFactor = Math.cos(transform.pitch * Math.PI / 180.0) * transform.cameraToCenterDistance;
        this.screenRightBoundary = transform.width + viewportPadding;
        this.screenBottomBoundary = transform.height + viewportPadding;
        this.gridRightBoundary = transform.width + 2 * viewportPadding;
        this.gridBottomBoundary = transform.height + 2 * viewportPadding;
        this.perspectiveRatioCutoff = 0.6;
    }
    placeCollisionBox(collisionBox, overlapMode, textPixelRatio, tileID, unwrappedTileID, pitchWithMap, rotateWithMap, translation, collisionGroupPredicate, getElevation, shift, simpleProjectionMatrix) {
        const x = collisionBox.anchorPointX + translation[0];
        const y = collisionBox.anchorPointY + translation[1];
        const projectedPoint = this.projectAndGetPerspectiveRatio(x, y, unwrappedTileID, getElevation, simpleProjectionMatrix);
        const tileToViewport = textPixelRatio * projectedPoint.perspectiveRatio;
        let projectedBox;
        if (!pitchWithMap && !rotateWithMap) {
            const pointX = projectedPoint.x + (shift ? shift.x * tileToViewport : 0);
            const pointY = projectedPoint.y + (shift ? shift.y * tileToViewport : 0);
            projectedBox = {
                allPointsOccluded: false,
                box: [
                    pointX + collisionBox.x1 * tileToViewport,
                    pointY + collisionBox.y1 * tileToViewport,
                    pointX + collisionBox.x2 * tileToViewport,
                    pointY + collisionBox.y2 * tileToViewport,
                ]
            };
        }
        else {
            projectedBox = this._projectCollisionBox(collisionBox, tileToViewport, tileID, unwrappedTileID, pitchWithMap, rotateWithMap, translation, projectedPoint, getElevation, shift, simpleProjectionMatrix);
        }
        const [tlX, tlY, brX, brY] = projectedBox.box;
        const occluded = pitchWithMap ? projectedBox.allPointsOccluded : projectedPoint.isOccluded;
        let unplaceable = occluded;
        unplaceable || (unplaceable = projectedPoint.perspectiveRatio < this.perspectiveRatioCutoff);
        unplaceable || (unplaceable = !this.isInsideGrid(tlX, tlY, brX, brY));
        if (unplaceable ||
            (overlapMode !== 'always' && this.grid.hitTest(tlX, tlY, brX, brY, overlapMode, collisionGroupPredicate))) {
            return {
                box: [tlX, tlY, brX, brY],
                placeable: false,
                offscreen: false,
                occluded
            };
        }
        return {
            box: [tlX, tlY, brX, brY],
            placeable: true,
            offscreen: this.isOffscreen(tlX, tlY, brX, brY),
            occluded
        };
    }
    placeCollisionCircles(overlapMode, symbol, lineVertexArray, glyphOffsetArray, fontSize, unwrappedTileID, pitchedLabelPlaneMatrix, showCollisionCircles, pitchWithMap, collisionGroupPredicate, circlePixelDiameter, textPixelPadding, translation, getElevation) {
        const placedCollisionCircles = [];
        const tileUnitAnchorPoint = new Point(symbol.anchorX, symbol.anchorY);
        const perspectiveRatio = this.getPerspectiveRatio(tileUnitAnchorPoint.x, tileUnitAnchorPoint.y, unwrappedTileID, getElevation);
        const labelPlaneFontSize = pitchWithMap ? (fontSize * this.transform.getPitchedTextCorrection(symbol.anchorX, symbol.anchorY, unwrappedTileID) / perspectiveRatio) : fontSize * perspectiveRatio;
        const labelPlaneFontScale = labelPlaneFontSize / ONE_EM;
        const projectionCache = { projections: {}, offsets: {}, cachedAnchorPoint: undefined, anyProjectionOccluded: false };
        const lineOffsetX = symbol.lineOffsetX * labelPlaneFontScale;
        const lineOffsetY = symbol.lineOffsetY * labelPlaneFontScale;
        const projectionContext = {
            getElevation,
            pitchedLabelPlaneMatrix,
            lineVertexArray,
            pitchWithMap,
            projectionCache,
            transform: this.transform,
            tileAnchorPoint: tileUnitAnchorPoint,
            unwrappedTileID,
            width: this.transform.width,
            height: this.transform.height,
            translation
        };
        const firstAndLastGlyph = placeFirstAndLastGlyph(labelPlaneFontScale, glyphOffsetArray, lineOffsetX, lineOffsetY, false, symbol, false, projectionContext);
        let collisionDetected = false;
        let inGrid = false;
        let entirelyOffscreen = true;
        if (firstAndLastGlyph) {
            const radius = circlePixelDiameter * 0.5 * perspectiveRatio + textPixelPadding;
            const screenPlaneMin = new Point(-viewportPadding, -viewportPadding);
            const screenPlaneMax = new Point(this.screenRightBoundary, this.screenBottomBoundary);
            const interpolator = new PathInterpolator();
            const first = firstAndLastGlyph.first;
            const last = firstAndLastGlyph.last;
            let projectedPath = [];
            for (let i = first.path.length - 1; i >= 1; i--) {
                projectedPath.push(first.path[i]);
            }
            for (let i = 1; i < last.path.length; i++) {
                projectedPath.push(last.path[i]);
            }
            const circleDist = radius * 2.5;
            if (pitchWithMap) {
                const screenSpacePath = this.projectPathToScreenSpace(projectedPath, projectionContext);
                if (screenSpacePath.some(point => point.signedDistanceFromCamera <= 0)) {
                    projectedPath = [];
                }
                else {
                    projectedPath = screenSpacePath.map(p => p.point);
                }
            }
            let segments = [];
            if (projectedPath.length > 0) {
                const minPoint = projectedPath[0].clone();
                const maxPoint = projectedPath[0].clone();
                for (let i = 1; i < projectedPath.length; i++) {
                    minPoint.x = Math.min(minPoint.x, projectedPath[i].x);
                    minPoint.y = Math.min(minPoint.y, projectedPath[i].y);
                    maxPoint.x = Math.max(maxPoint.x, projectedPath[i].x);
                    maxPoint.y = Math.max(maxPoint.y, projectedPath[i].y);
                }
                if (minPoint.x >= screenPlaneMin.x && maxPoint.x <= screenPlaneMax.x &&
                    minPoint.y >= screenPlaneMin.y && maxPoint.y <= screenPlaneMax.y) {
                    segments = [projectedPath];
                }
                else if (maxPoint.x < screenPlaneMin.x || minPoint.x > screenPlaneMax.x ||
                    maxPoint.y < screenPlaneMin.y || minPoint.y > screenPlaneMax.y) {
                    segments = [];
                }
                else {
                    segments = clipLine([projectedPath], screenPlaneMin.x, screenPlaneMin.y, screenPlaneMax.x, screenPlaneMax.y);
                }
            }
            for (const seg of segments) {
                interpolator.reset(seg, radius * 0.25);
                let numCircles = 0;
                if (interpolator.length <= 0.5 * radius) {
                    numCircles = 1;
                }
                else {
                    numCircles = Math.ceil(interpolator.paddedLength / circleDist) + 1;
                }
                for (let i = 0; i < numCircles; i++) {
                    const t = i / Math.max(numCircles - 1, 1);
                    const circlePosition = interpolator.lerp(t);
                    const centerX = circlePosition.x + viewportPadding;
                    const centerY = circlePosition.y + viewportPadding;
                    placedCollisionCircles.push(centerX, centerY, radius, 0);
                    const x1 = centerX - radius;
                    const y1 = centerY - radius;
                    const x2 = centerX + radius;
                    const y2 = centerY + radius;
                    entirelyOffscreen = entirelyOffscreen && this.isOffscreen(x1, y1, x2, y2);
                    inGrid = inGrid || this.isInsideGrid(x1, y1, x2, y2);
                    if (overlapMode !== 'always' && this.grid.hitTestCircle(centerX, centerY, radius, overlapMode, collisionGroupPredicate)) {
                        collisionDetected = true;
                        if (!showCollisionCircles) {
                            return {
                                circles: [],
                                offscreen: false,
                                collisionDetected
                            };
                        }
                    }
                }
            }
        }
        return {
            circles: ((!showCollisionCircles && collisionDetected) || !inGrid || perspectiveRatio < this.perspectiveRatioCutoff) ? [] : placedCollisionCircles,
            offscreen: entirelyOffscreen,
            collisionDetected
        };
    }
    projectPathToScreenSpace(projectedPath, projectionContext) {
        const screenSpacePath = projectPathSpecialProjection(projectedPath, projectionContext);
        return pathSlicedToLongestUnoccluded(screenSpacePath);
    }
    queryRenderedSymbols(viewportQueryGeometry) {
        if (viewportQueryGeometry.length === 0 || (this.grid.keysLength() === 0 && this.ignoredGrid.keysLength() === 0)) {
            return {};
        }
        const query = [];
        const bounds = new Bounds();
        for (const point of viewportQueryGeometry) {
            const gridPoint = new Point(point.x + viewportPadding, point.y + viewportPadding);
            bounds.extend(gridPoint);
            query.push(gridPoint);
        }
        const { minX, minY, maxX, maxY } = bounds;
        const features = this.grid.query(minX, minY, maxX, maxY)
            .concat(this.ignoredGrid.query(minX, minY, maxX, maxY));
        const seenFeatures = {};
        const result = {};
        for (const feature of features) {
            const featureKey = feature.key;
            if (seenFeatures[featureKey.bucketInstanceId] === undefined) {
                seenFeatures[featureKey.bucketInstanceId] = {};
            }
            if (seenFeatures[featureKey.bucketInstanceId][featureKey.featureIndex]) {
                continue;
            }
            const bbox = [
                new Point(feature.x1, feature.y1),
                new Point(feature.x2, feature.y1),
                new Point(feature.x2, feature.y2),
                new Point(feature.x1, feature.y2)
            ];
            if (!intersectionTests.polygonIntersectsPolygon(query, bbox)) {
                continue;
            }
            seenFeatures[featureKey.bucketInstanceId][featureKey.featureIndex] = true;
            if (result[featureKey.bucketInstanceId] === undefined) {
                result[featureKey.bucketInstanceId] = [];
            }
            result[featureKey.bucketInstanceId].push(featureKey.featureIndex);
        }
        return result;
    }
    insertCollisionBox(collisionBox, overlapMode, ignorePlacement, bucketInstanceId, featureIndex, collisionGroupID) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;
        const key = { bucketInstanceId, featureIndex, collisionGroupID, overlapMode };
        grid.insert(key, collisionBox[0], collisionBox[1], collisionBox[2], collisionBox[3]);
    }
    insertCollisionCircles(collisionCircles, overlapMode, ignorePlacement, bucketInstanceId, featureIndex, collisionGroupID) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;
        const key = { bucketInstanceId, featureIndex, collisionGroupID, overlapMode };
        for (let k = 0; k < collisionCircles.length; k += 4) {
            grid.insertCircle(key, collisionCircles[k], collisionCircles[k + 1], collisionCircles[k + 2]);
        }
    }
    projectAndGetPerspectiveRatio(x, y, unwrappedTileID, getElevation, simpleProjectionMatrix) {
        if (simpleProjectionMatrix) {
            let pos;
            if (getElevation) {
                pos = [x, y, getElevation(x, y), 1];
                vec4.transformMat4(pos, pos, simpleProjectionMatrix);
            }
            else {
                pos = [x, y, 0, 1];
                xyTransformMat4(pos, pos, simpleProjectionMatrix);
            }
            const w = pos[3];
            return {
                x: (((pos[0] / w + 1) / 2) * this.transform.width) + viewportPadding,
                y: (((-pos[1] / w + 1) / 2) * this.transform.height) + viewportPadding,
                perspectiveRatio: 0.5 + 0.5 * (this.transform.cameraToCenterDistance / w),
                isOccluded: false,
                signedDistanceFromCamera: w
            };
        }
        else {
            const projected = this.transform.projectTileCoordinates(x, y, unwrappedTileID, getElevation);
            return {
                x: (((projected.point.x + 1) / 2) * this.transform.width) + viewportPadding,
                y: (((-projected.point.y + 1) / 2) * this.transform.height) + viewportPadding,
                perspectiveRatio: 0.5 + 0.5 * (this.transform.cameraToCenterDistance / projected.signedDistanceFromCamera),
                isOccluded: projected.isOccluded,
                signedDistanceFromCamera: projected.signedDistanceFromCamera
            };
        }
    }
    getPerspectiveRatio(x, y, unwrappedTileID, getElevation) {
        const projected = this.transform.projectTileCoordinates(x, y, unwrappedTileID, getElevation);
        return 0.5 + 0.5 * (this.transform.cameraToCenterDistance / projected.signedDistanceFromCamera);
    }
    isOffscreen(x1, y1, x2, y2) {
        return x2 < viewportPadding || x1 >= this.screenRightBoundary || y2 < viewportPadding || y1 > this.screenBottomBoundary;
    }
    isInsideGrid(x1, y1, x2, y2) {
        return x2 >= 0 && x1 < this.gridRightBoundary && y2 >= 0 && y1 < this.gridBottomBoundary;
    }
    getViewportMatrix() {
        const m = mat4.identity([]);
        mat4.translate(m, m, [-viewportPadding, -viewportPadding, 0.0]);
        return m;
    }
    _projectCollisionBox(collisionBox, tileToViewport, tileID, unwrappedTileID, pitchWithMap, rotateWithMap, translation, projectedPoint, getElevation, shift, simpleProjectionMatrix) {
        let vecEastX = 1;
        let vecEastY = 0;
        let vecSouthX = 0;
        let vecSouthY = 1;
        const translatedAnchorX = collisionBox.anchorPointX + translation[0];
        const translatedAnchorY = collisionBox.anchorPointY + translation[1];
        if (rotateWithMap && !pitchWithMap) {
            const projectedEast = this.projectAndGetPerspectiveRatio(translatedAnchorX + 1, translatedAnchorY, unwrappedTileID, getElevation, simpleProjectionMatrix);
            const toEastX = projectedEast.x - projectedPoint.x;
            const toEastY = projectedEast.y - projectedPoint.y;
            const angle = Math.atan(toEastY / toEastX) + (toEastX < 0 ? Math.PI : 0);
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);
            vecEastX = cos;
            vecEastY = sin;
            vecSouthX = -sin;
            vecSouthY = cos;
        }
        else if (!rotateWithMap && pitchWithMap) {
            const skew = getTileSkewVectors(this.transform);
            vecEastX = skew.vecEast[0];
            vecEastY = skew.vecEast[1];
            vecSouthX = skew.vecSouth[0];
            vecSouthY = skew.vecSouth[1];
        }
        let basePointX = projectedPoint.x;
        let basePointY = projectedPoint.y;
        let distanceMultiplier = tileToViewport;
        if (pitchWithMap) {
            basePointX = translatedAnchorX;
            basePointY = translatedAnchorY;
            const zoomFraction = this.transform.zoom - tileID.overscaledZ;
            distanceMultiplier = Math.pow(2, -zoomFraction);
            distanceMultiplier *= this.transform.getPitchedTextCorrection(translatedAnchorX, translatedAnchorY, unwrappedTileID);
            if (!shift) {
                const distanceRatio = projectedPoint.signedDistanceFromCamera / this.transform.cameraToCenterDistance;
                const perspectiveRatio = clamp(0.5 + 0.5 * distanceRatio, 0.0, 4.0);
                distanceMultiplier *= perspectiveRatio;
            }
        }
        if (shift) {
            basePointX += vecEastX * shift.x * distanceMultiplier + vecSouthX * shift.y * distanceMultiplier;
            basePointY += vecEastY * shift.x * distanceMultiplier + vecSouthY * shift.y * distanceMultiplier;
        }
        const offsetXmin = collisionBox.x1 * distanceMultiplier;
        const offsetXmax = collisionBox.x2 * distanceMultiplier;
        const offsetXhalf = (offsetXmin + offsetXmax) / 2;
        const offsetYmin = collisionBox.y1 * distanceMultiplier;
        const offsetYmax = collisionBox.y2 * distanceMultiplier;
        const offsetYhalf = (offsetYmin + offsetYmax) / 2;
        const offsetsArray = [
            { offsetX: offsetXmin, offsetY: offsetYmin },
            { offsetX: offsetXhalf, offsetY: offsetYmin },
            { offsetX: offsetXmax, offsetY: offsetYmin },
            { offsetX: offsetXmax, offsetY: offsetYhalf },
            { offsetX: offsetXmax, offsetY: offsetYmax },
            { offsetX: offsetXhalf, offsetY: offsetYmax },
            { offsetX: offsetXmin, offsetY: offsetYmax },
            { offsetX: offsetXmin, offsetY: offsetYhalf }
        ];
        let points = [];
        for (const { offsetX, offsetY } of offsetsArray) {
            points.push(new Point(basePointX + vecEastX * offsetX + vecSouthX * offsetY, basePointY + vecEastY * offsetX + vecSouthY * offsetY));
        }
        let anyPointVisible = false;
        if (pitchWithMap) {
            const projected = points.map(p => this.projectAndGetPerspectiveRatio(p.x, p.y, unwrappedTileID, getElevation, simpleProjectionMatrix));
            anyPointVisible = projected.some(p => !p.isOccluded);
            points = projected.map(p => new Point(p.x, p.y));
        }
        else {
            anyPointVisible = true;
        }
        return {
            box: getAABB(points),
            allPointsOccluded: !anyPointVisible
        };
    }
}
//# sourceMappingURL=collision_index.js.map