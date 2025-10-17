import { CollisionIndex, viewportPadding } from './collision_index';
import { EXTENT } from '../data/extent';
import * as symbolSize from './symbol_size';
import * as projection from './projection';
import { getAnchorJustification } from './symbol_layout';
import { getAnchorAlignment, WritingMode } from './shaping';
import { pixelsToTileUnits } from '../source/pixels_to_tile_units';
import Point from '@mapbox/point-geometry';
import { getOverlapMode } from '../style/style_layer/overlap_mode';
import { TextAnchorEnum } from '../style/style_layer/variable_text_anchor';
import { translatePosition, warnOnce } from '../util/util';
class OpacityState {
    constructor(prevState, increment, placed, skipFade) {
        if (prevState) {
            this.opacity = Math.max(0, Math.min(1, prevState.opacity + (prevState.placed ? increment : -increment)));
        }
        else {
            this.opacity = (skipFade && placed) ? 1 : 0;
        }
        this.placed = placed;
    }
    isHidden() {
        return this.opacity === 0 && !this.placed;
    }
}
class JointOpacityState {
    constructor(prevState, increment, placedText, placedIcon, skipFade) {
        this.text = new OpacityState(prevState ? prevState.text : null, increment, placedText, skipFade);
        this.icon = new OpacityState(prevState ? prevState.icon : null, increment, placedIcon, skipFade);
    }
    isHidden() {
        return this.text.isHidden() && this.icon.isHidden();
    }
}
class JointPlacement {
    constructor(text, icon, skipFade) {
        this.text = text;
        this.icon = icon;
        this.skipFade = skipFade;
    }
}
export class RetainedQueryData {
    constructor(bucketInstanceId, featureIndex, sourceLayerIndex, bucketIndex, tileID) {
        this.bucketInstanceId = bucketInstanceId;
        this.featureIndex = featureIndex;
        this.sourceLayerIndex = sourceLayerIndex;
        this.bucketIndex = bucketIndex;
        this.tileID = tileID;
    }
}
class CollisionGroups {
    constructor(crossSourceCollisions) {
        this.crossSourceCollisions = crossSourceCollisions;
        this.maxGroupID = 0;
        this.collisionGroups = {};
    }
    get(sourceID) {
        if (!this.crossSourceCollisions) {
            if (!this.collisionGroups[sourceID]) {
                const nextGroupID = ++this.maxGroupID;
                this.collisionGroups[sourceID] = {
                    ID: nextGroupID,
                    predicate: (key) => {
                        return key.collisionGroupID === nextGroupID;
                    }
                };
            }
            return this.collisionGroups[sourceID];
        }
        else {
            return { ID: 0, predicate: null };
        }
    }
}
function calculateVariableLayoutShift(anchor, width, height, textOffset, textBoxScale) {
    const { horizontalAlign, verticalAlign } = getAnchorAlignment(anchor);
    const shiftX = -(horizontalAlign - 0.5) * width;
    const shiftY = -(verticalAlign - 0.5) * height;
    return new Point(shiftX + textOffset[0] * textBoxScale, shiftY + textOffset[1] * textBoxScale);
}
export class Placement {
    constructor(transform, terrain, fadeDuration, crossSourceCollisions, prevPlacement) {
        this.transform = transform.clone();
        this.terrain = terrain;
        this.collisionIndex = new CollisionIndex(this.transform);
        this.placements = {};
        this.opacities = {};
        this.variableOffsets = {};
        this.stale = false;
        this.commitTime = 0;
        this.fadeDuration = fadeDuration;
        this.retainedQueryData = {};
        this.collisionGroups = new CollisionGroups(crossSourceCollisions);
        this.collisionCircleArrays = {};
        this.collisionBoxArrays = new Map();
        this.prevPlacement = prevPlacement;
        if (prevPlacement) {
            prevPlacement.prevPlacement = undefined;
        }
        this.placedOrientations = {};
    }
    _getTerrainElevationFunc(tileID) {
        const terrain = this.terrain;
        return terrain ? (x, y) => terrain.getElevation(tileID, x, y) : null;
    }
    getBucketParts(results, styleLayer, tile, sortAcrossTiles) {
        const symbolBucket = tile.getBucket(styleLayer);
        const bucketFeatureIndex = tile.latestFeatureIndex;
        if (!symbolBucket || !bucketFeatureIndex || styleLayer.id !== symbolBucket.layerIds[0])
            return;
        const collisionBoxArray = tile.collisionBoxArray;
        const layout = symbolBucket.layers[0].layout;
        const paint = symbolBucket.layers[0].paint;
        const scale = Math.pow(2, this.transform.zoom - tile.tileID.overscaledZ);
        const textPixelRatio = tile.tileSize / EXTENT;
        const unwrappedTileID = tile.tileID.toUnwrapped();
        const rotateWithMap = layout.get('text-rotation-alignment') === 'map';
        const pixelsToTiles = pixelsToTileUnits(tile, 1, this.transform.zoom);
        const translationText = translatePosition(this.collisionIndex.transform, tile, paint.get('text-translate'), paint.get('text-translate-anchor'));
        const translationIcon = translatePosition(this.collisionIndex.transform, tile, paint.get('icon-translate'), paint.get('icon-translate-anchor'));
        const pitchedLabelPlaneMatrix = projection.getPitchedLabelPlaneMatrix(rotateWithMap, this.transform, pixelsToTiles);
        this.retainedQueryData[symbolBucket.bucketInstanceId] = new RetainedQueryData(symbolBucket.bucketInstanceId, bucketFeatureIndex, symbolBucket.sourceLayerIndex, symbolBucket.index, tile.tileID);
        const parameters = {
            bucket: symbolBucket,
            layout,
            translationText,
            translationIcon,
            unwrappedTileID,
            pitchedLabelPlaneMatrix,
            scale,
            textPixelRatio,
            holdingForFade: tile.holdingForFade(),
            collisionBoxArray,
            partiallyEvaluatedTextSize: symbolSize.evaluateSizeForZoom(symbolBucket.textSizeData, this.transform.zoom),
            collisionGroup: this.collisionGroups.get(symbolBucket.sourceID)
        };
        if (sortAcrossTiles) {
            for (const range of symbolBucket.sortKeyRanges) {
                const { sortKey, symbolInstanceStart, symbolInstanceEnd } = range;
                results.push({ sortKey, symbolInstanceStart, symbolInstanceEnd, parameters });
            }
        }
        else {
            results.push({
                symbolInstanceStart: 0,
                symbolInstanceEnd: symbolBucket.symbolInstances.length,
                parameters
            });
        }
    }
    attemptAnchorPlacement(textAnchorOffset, textBox, width, height, textBoxScale, rotateWithMap, pitchWithMap, textPixelRatio, tileID, unwrappedTileID, collisionGroup, textOverlapMode, symbolInstance, bucket, orientation, translationText, translationIcon, iconBox, getElevation, simpleProjectionMatrix) {
        const anchor = TextAnchorEnum[textAnchorOffset.textAnchor];
        const textOffset = [textAnchorOffset.textOffset0, textAnchorOffset.textOffset1];
        const shift = calculateVariableLayoutShift(anchor, width, height, textOffset, textBoxScale);
        const placedGlyphBoxes = this.collisionIndex.placeCollisionBox(textBox, textOverlapMode, textPixelRatio, tileID, unwrappedTileID, pitchWithMap, rotateWithMap, translationText, collisionGroup.predicate, getElevation, shift, simpleProjectionMatrix);
        if (iconBox) {
            const placedIconBoxes = this.collisionIndex.placeCollisionBox(iconBox, textOverlapMode, textPixelRatio, tileID, unwrappedTileID, pitchWithMap, rotateWithMap, translationIcon, collisionGroup.predicate, getElevation, shift, simpleProjectionMatrix);
            if (!placedIconBoxes.placeable)
                return;
        }
        if (placedGlyphBoxes.placeable) {
            let prevAnchor;
            if (this.prevPlacement &&
                this.prevPlacement.variableOffsets[symbolInstance.crossTileID] &&
                this.prevPlacement.placements[symbolInstance.crossTileID] &&
                this.prevPlacement.placements[symbolInstance.crossTileID].text) {
                prevAnchor = this.prevPlacement.variableOffsets[symbolInstance.crossTileID].anchor;
            }
            if (symbolInstance.crossTileID === 0)
                throw new Error('symbolInstance.crossTileID can\'t be 0');
            this.variableOffsets[symbolInstance.crossTileID] = {
                textOffset,
                width,
                height,
                anchor,
                textBoxScale,
                prevAnchor
            };
            this.markUsedJustification(bucket, anchor, symbolInstance, orientation);
            if (bucket.allowVerticalPlacement) {
                this.markUsedOrientation(bucket, orientation, symbolInstance);
                this.placedOrientations[symbolInstance.crossTileID] = orientation;
            }
            return { shift, placedGlyphBoxes };
        }
    }
    placeLayerBucketPart(bucketPart, seenCrossTileIDs, showCollisionBoxes) {
        const { bucket, layout, translationText, translationIcon, unwrappedTileID, pitchedLabelPlaneMatrix, textPixelRatio, holdingForFade, collisionBoxArray, partiallyEvaluatedTextSize, collisionGroup } = bucketPart.parameters;
        const textOptional = layout.get('text-optional');
        const iconOptional = layout.get('icon-optional');
        const textOverlapMode = getOverlapMode(layout, 'text-overlap', 'text-allow-overlap');
        const textAlwaysOverlap = textOverlapMode === 'always';
        const iconOverlapMode = getOverlapMode(layout, 'icon-overlap', 'icon-allow-overlap');
        const iconAlwaysOverlap = iconOverlapMode === 'always';
        const rotateWithMap = layout.get('text-rotation-alignment') === 'map';
        const pitchWithMap = layout.get('text-pitch-alignment') === 'map';
        const hasIconTextFit = layout.get('icon-text-fit') !== 'none';
        const zOrderByViewportY = layout.get('symbol-z-order') === 'viewport-y';
        const alwaysShowText = textAlwaysOverlap && (iconAlwaysOverlap || !bucket.hasIconData() || iconOptional);
        const alwaysShowIcon = iconAlwaysOverlap && (textAlwaysOverlap || !bucket.hasTextData() || textOptional);
        if (!bucket.collisionArrays && collisionBoxArray) {
            bucket.deserializeCollisionBoxes(collisionBoxArray);
        }
        const tileID = this.retainedQueryData[bucket.bucketInstanceId].tileID;
        const getElevation = this._getTerrainElevationFunc(tileID);
        const simpleProjectionMatrix = this.transform.getFastPathSimpleProjectionMatrix(tileID);
        const placeSymbol = (symbolInstance, collisionArrays, symbolIndex) => {
            var _a, _b;
            if (seenCrossTileIDs[symbolInstance.crossTileID])
                return;
            if (holdingForFade) {
                this.placements[symbolInstance.crossTileID] = new JointPlacement(false, false, false);
                return;
            }
            let placeText = false;
            let placeIcon = false;
            let offscreen = true;
            let shift = null;
            let placed = { box: null, placeable: false, offscreen: null, occluded: false };
            let placedVerticalText = { box: null, placeable: false, offscreen: null };
            let placedGlyphBoxes = null;
            let placedGlyphCircles = null;
            let placedIconBoxes = null;
            let textFeatureIndex = 0;
            let verticalTextFeatureIndex = 0;
            let iconFeatureIndex = 0;
            if (collisionArrays.textFeatureIndex) {
                textFeatureIndex = collisionArrays.textFeatureIndex;
            }
            else if (symbolInstance.useRuntimeCollisionCircles) {
                textFeatureIndex = symbolInstance.featureIndex;
            }
            if (collisionArrays.verticalTextFeatureIndex) {
                verticalTextFeatureIndex = collisionArrays.verticalTextFeatureIndex;
            }
            const textBox = collisionArrays.textBox;
            if (textBox) {
                const updatePreviousOrientationIfNotPlaced = (isPlaced) => {
                    let previousOrientation = WritingMode.horizontal;
                    if (bucket.allowVerticalPlacement && !isPlaced && this.prevPlacement) {
                        const prevPlacedOrientation = this.prevPlacement.placedOrientations[symbolInstance.crossTileID];
                        if (prevPlacedOrientation) {
                            this.placedOrientations[symbolInstance.crossTileID] = prevPlacedOrientation;
                            previousOrientation = prevPlacedOrientation;
                            this.markUsedOrientation(bucket, previousOrientation, symbolInstance);
                        }
                    }
                    return previousOrientation;
                };
                const placeTextForPlacementModes = (placeHorizontalFn, placeVerticalFn) => {
                    if (bucket.allowVerticalPlacement && symbolInstance.numVerticalGlyphVertices > 0 && collisionArrays.verticalTextBox) {
                        for (const placementMode of bucket.writingModes) {
                            if (placementMode === WritingMode.vertical) {
                                placed = placeVerticalFn();
                                placedVerticalText = placed;
                            }
                            else {
                                placed = placeHorizontalFn();
                            }
                            if (placed && placed.placeable)
                                break;
                        }
                    }
                    else {
                        placed = placeHorizontalFn();
                    }
                };
                const textAnchorOffsetStart = symbolInstance.textAnchorOffsetStartIndex;
                const textAnchorOffsetEnd = symbolInstance.textAnchorOffsetEndIndex;
                if (textAnchorOffsetEnd === textAnchorOffsetStart) {
                    const placeBox = (collisionTextBox, orientation) => {
                        const placedFeature = this.collisionIndex.placeCollisionBox(collisionTextBox, textOverlapMode, textPixelRatio, tileID, unwrappedTileID, pitchWithMap, rotateWithMap, translationText, collisionGroup.predicate, getElevation, undefined, simpleProjectionMatrix);
                        if (placedFeature && placedFeature.placeable) {
                            this.markUsedOrientation(bucket, orientation, symbolInstance);
                            this.placedOrientations[symbolInstance.crossTileID] = orientation;
                        }
                        return placedFeature;
                    };
                    const placeHorizontal = () => {
                        return placeBox(textBox, WritingMode.horizontal);
                    };
                    const placeVertical = () => {
                        const verticalTextBox = collisionArrays.verticalTextBox;
                        if (bucket.allowVerticalPlacement && symbolInstance.numVerticalGlyphVertices > 0 && verticalTextBox) {
                            return placeBox(verticalTextBox, WritingMode.vertical);
                        }
                        return { box: null, offscreen: null };
                    };
                    placeTextForPlacementModes(placeHorizontal, placeVertical);
                    updatePreviousOrientationIfNotPlaced(placed && placed.placeable);
                }
                else {
                    let prevAnchor = TextAnchorEnum[(_b = (_a = this.prevPlacement) === null || _a === void 0 ? void 0 : _a.variableOffsets[symbolInstance.crossTileID]) === null || _b === void 0 ? void 0 : _b.anchor];
                    const placeBoxForVariableAnchors = (collisionTextBox, collisionIconBox, orientation) => {
                        const width = collisionTextBox.x2 - collisionTextBox.x1;
                        const height = collisionTextBox.y2 - collisionTextBox.y1;
                        const textBoxScale = symbolInstance.textBoxScale;
                        const variableIconBox = hasIconTextFit && (iconOverlapMode === 'never') ? collisionIconBox : null;
                        let placedBox = null;
                        let placementPasses = (textOverlapMode === 'never') ? 1 : 2;
                        let overlapMode = 'never';
                        if (prevAnchor) {
                            placementPasses++;
                        }
                        for (let pass = 0; pass < placementPasses; pass++) {
                            for (let i = textAnchorOffsetStart; i < textAnchorOffsetEnd; i++) {
                                const textAnchorOffset = bucket.textAnchorOffsets.get(i);
                                if (prevAnchor && textAnchorOffset.textAnchor !== prevAnchor) {
                                    continue;
                                }
                                const result = this.attemptAnchorPlacement(textAnchorOffset, collisionTextBox, width, height, textBoxScale, rotateWithMap, pitchWithMap, textPixelRatio, tileID, unwrappedTileID, collisionGroup, overlapMode, symbolInstance, bucket, orientation, translationText, translationIcon, variableIconBox, getElevation);
                                if (result) {
                                    placedBox = result.placedGlyphBoxes;
                                    if (placedBox && placedBox.placeable) {
                                        placeText = true;
                                        shift = result.shift;
                                        return placedBox;
                                    }
                                }
                            }
                            if (prevAnchor) {
                                prevAnchor = null;
                            }
                            else {
                                overlapMode = textOverlapMode;
                            }
                        }
                        if (showCollisionBoxes && !placedBox) {
                            const placedFakeGlyphBox = this.collisionIndex.placeCollisionBox(textBox, 'always', textPixelRatio, tileID, unwrappedTileID, pitchWithMap, rotateWithMap, translationText, collisionGroup.predicate, getElevation, undefined, simpleProjectionMatrix);
                            placedBox = {
                                box: placedFakeGlyphBox.box,
                                offscreen: false,
                                placeable: false,
                                occluded: false,
                            };
                        }
                        return placedBox;
                    };
                    const placeHorizontal = () => {
                        return placeBoxForVariableAnchors(textBox, collisionArrays.iconBox, WritingMode.horizontal);
                    };
                    const placeVertical = () => {
                        const verticalTextBox = collisionArrays.verticalTextBox;
                        const wasPlaced = placed && placed.placeable;
                        if (bucket.allowVerticalPlacement && !wasPlaced && symbolInstance.numVerticalGlyphVertices > 0 && verticalTextBox) {
                            return placeBoxForVariableAnchors(verticalTextBox, collisionArrays.verticalIconBox, WritingMode.vertical);
                        }
                        return { box: null, occluded: true, offscreen: null };
                    };
                    placeTextForPlacementModes(placeHorizontal, placeVertical);
                    if (placed) {
                        placeText = placed.placeable;
                        offscreen = placed.offscreen;
                    }
                    const prevOrientation = updatePreviousOrientationIfNotPlaced(placed && placed.placeable);
                    if (!placeText && this.prevPlacement) {
                        const prevOffset = this.prevPlacement.variableOffsets[symbolInstance.crossTileID];
                        if (prevOffset) {
                            this.variableOffsets[symbolInstance.crossTileID] = prevOffset;
                            this.markUsedJustification(bucket, prevOffset.anchor, symbolInstance, prevOrientation);
                        }
                    }
                }
            }
            placedGlyphBoxes = placed;
            placeText = placedGlyphBoxes && placedGlyphBoxes.placeable;
            offscreen = placedGlyphBoxes && placedGlyphBoxes.offscreen;
            if (symbolInstance.useRuntimeCollisionCircles) {
                const placedSymbol = bucket.text.placedSymbolArray.get(symbolInstance.centerJustifiedTextSymbolIndex);
                const fontSize = symbolSize.evaluateSizeForFeature(bucket.textSizeData, partiallyEvaluatedTextSize, placedSymbol);
                const textPixelPadding = layout.get('text-padding');
                const circlePixelDiameter = symbolInstance.collisionCircleDiameter;
                placedGlyphCircles = this.collisionIndex.placeCollisionCircles(textOverlapMode, placedSymbol, bucket.lineVertexArray, bucket.glyphOffsetArray, fontSize, unwrappedTileID, pitchedLabelPlaneMatrix, showCollisionBoxes, pitchWithMap, collisionGroup.predicate, circlePixelDiameter, textPixelPadding, translationText, getElevation);
                if (placedGlyphCircles.circles.length && placedGlyphCircles.collisionDetected && !showCollisionBoxes) {
                    warnOnce('Collisions detected, but collision boxes are not shown');
                }
                placeText = textAlwaysOverlap || (placedGlyphCircles.circles.length > 0 && !placedGlyphCircles.collisionDetected);
                offscreen = offscreen && placedGlyphCircles.offscreen;
            }
            if (collisionArrays.iconFeatureIndex) {
                iconFeatureIndex = collisionArrays.iconFeatureIndex;
            }
            if (collisionArrays.iconBox) {
                const placeIconFeature = iconBox => {
                    return this.collisionIndex.placeCollisionBox(iconBox, iconOverlapMode, textPixelRatio, tileID, unwrappedTileID, pitchWithMap, rotateWithMap, translationIcon, collisionGroup.predicate, getElevation, (hasIconTextFit && shift) ? shift : undefined, simpleProjectionMatrix);
                };
                if (placedVerticalText && placedVerticalText.placeable && collisionArrays.verticalIconBox) {
                    placedIconBoxes = placeIconFeature(collisionArrays.verticalIconBox);
                    placeIcon = placedIconBoxes.placeable;
                }
                else {
                    placedIconBoxes = placeIconFeature(collisionArrays.iconBox);
                    placeIcon = placedIconBoxes.placeable;
                }
                offscreen = offscreen && placedIconBoxes.offscreen;
            }
            const iconWithoutText = textOptional ||
                (symbolInstance.numHorizontalGlyphVertices === 0 && symbolInstance.numVerticalGlyphVertices === 0);
            const textWithoutIcon = iconOptional || symbolInstance.numIconVertices === 0;
            if (!iconWithoutText && !textWithoutIcon) {
                placeIcon = placeText = placeIcon && placeText;
            }
            else if (!textWithoutIcon) {
                placeText = placeIcon && placeText;
            }
            else if (!iconWithoutText) {
                placeIcon = placeIcon && placeText;
            }
            const hasTextBox = placeText && placedGlyphBoxes.placeable;
            const hasIconBox = placeIcon && placedIconBoxes.placeable;
            if (hasTextBox) {
                if (placedVerticalText && placedVerticalText.placeable && verticalTextFeatureIndex) {
                    this.collisionIndex.insertCollisionBox(placedGlyphBoxes.box, textOverlapMode, layout.get('text-ignore-placement'), bucket.bucketInstanceId, verticalTextFeatureIndex, collisionGroup.ID);
                }
                else {
                    this.collisionIndex.insertCollisionBox(placedGlyphBoxes.box, textOverlapMode, layout.get('text-ignore-placement'), bucket.bucketInstanceId, textFeatureIndex, collisionGroup.ID);
                }
            }
            if (hasIconBox) {
                this.collisionIndex.insertCollisionBox(placedIconBoxes.box, iconOverlapMode, layout.get('icon-ignore-placement'), bucket.bucketInstanceId, iconFeatureIndex, collisionGroup.ID);
            }
            if (placedGlyphCircles) {
                if (placeText) {
                    this.collisionIndex.insertCollisionCircles(placedGlyphCircles.circles, textOverlapMode, layout.get('text-ignore-placement'), bucket.bucketInstanceId, textFeatureIndex, collisionGroup.ID);
                }
            }
            if (showCollisionBoxes) {
                this.storeCollisionData(bucket.bucketInstanceId, symbolIndex, collisionArrays, placedGlyphBoxes, placedIconBoxes, placedGlyphCircles);
            }
            if (symbolInstance.crossTileID === 0)
                throw new Error('symbolInstance.crossTileID can\'t be 0');
            if (bucket.bucketInstanceId === 0)
                throw new Error('bucket.bucketInstanceId can\'t be 0');
            const textVisible = (placeText || alwaysShowText) && !(placedGlyphBoxes === null || placedGlyphBoxes === void 0 ? void 0 : placedGlyphBoxes.occluded);
            const iconVisible = (placeIcon || alwaysShowIcon) && !(placedIconBoxes === null || placedIconBoxes === void 0 ? void 0 : placedIconBoxes.occluded);
            this.placements[symbolInstance.crossTileID] = new JointPlacement(textVisible, iconVisible, offscreen || bucket.justReloaded);
            seenCrossTileIDs[symbolInstance.crossTileID] = true;
        };
        if (zOrderByViewportY) {
            if (bucketPart.symbolInstanceStart !== 0)
                throw new Error('bucket.bucketInstanceId should be 0');
            const symbolIndexes = bucket.getSortedSymbolIndexes(-this.transform.bearingInRadians);
            for (let i = symbolIndexes.length - 1; i >= 0; --i) {
                const symbolIndex = symbolIndexes[i];
                placeSymbol(bucket.symbolInstances.get(symbolIndex), bucket.collisionArrays[symbolIndex], symbolIndex);
            }
        }
        else {
            for (let i = bucketPart.symbolInstanceStart; i < bucketPart.symbolInstanceEnd; i++) {
                placeSymbol(bucket.symbolInstances.get(i), bucket.collisionArrays[i], i);
            }
        }
        bucket.justReloaded = false;
    }
    storeCollisionData(bucketInstanceId, symbolIndex, collisionArrays, placedGlyphBoxes, placedIconBoxes, placedGlyphCircles) {
        if (collisionArrays.textBox || collisionArrays.iconBox) {
            let boxArray;
            if (this.collisionBoxArrays.has(bucketInstanceId)) {
                boxArray = this.collisionBoxArrays.get(bucketInstanceId);
            }
            else {
                boxArray = new Map();
                this.collisionBoxArrays.set(bucketInstanceId, boxArray);
            }
            let realCollisionBox;
            if (boxArray.has(symbolIndex)) {
                realCollisionBox = boxArray.get(symbolIndex);
            }
            else {
                realCollisionBox = {
                    text: null,
                    icon: null
                };
                boxArray.set(symbolIndex, realCollisionBox);
            }
            if (collisionArrays.textBox) {
                realCollisionBox.text = placedGlyphBoxes.box;
            }
            if (collisionArrays.iconBox) {
                realCollisionBox.icon = placedIconBoxes.box;
            }
        }
        if (placedGlyphCircles) {
            let circleArray = this.collisionCircleArrays[bucketInstanceId];
            if (circleArray === undefined)
                circleArray = this.collisionCircleArrays[bucketInstanceId] = [];
            for (let i = 0; i < placedGlyphCircles.circles.length; i += 4) {
                circleArray.push(placedGlyphCircles.circles[i + 0] - viewportPadding);
                circleArray.push(placedGlyphCircles.circles[i + 1] - viewportPadding);
                circleArray.push(placedGlyphCircles.circles[i + 2]);
                circleArray.push(placedGlyphCircles.collisionDetected ? 1 : 0);
            }
        }
    }
    markUsedJustification(bucket, placedAnchor, symbolInstance, orientation) {
        const justifications = {
            'left': symbolInstance.leftJustifiedTextSymbolIndex,
            'center': symbolInstance.centerJustifiedTextSymbolIndex,
            'right': symbolInstance.rightJustifiedTextSymbolIndex
        };
        let autoIndex;
        if (orientation === WritingMode.vertical) {
            autoIndex = symbolInstance.verticalPlacedTextSymbolIndex;
        }
        else {
            autoIndex = justifications[getAnchorJustification(placedAnchor)];
        }
        const indexes = [
            symbolInstance.leftJustifiedTextSymbolIndex,
            symbolInstance.centerJustifiedTextSymbolIndex,
            symbolInstance.rightJustifiedTextSymbolIndex,
            symbolInstance.verticalPlacedTextSymbolIndex
        ];
        for (const index of indexes) {
            if (index >= 0) {
                if (autoIndex >= 0 && index !== autoIndex) {
                    bucket.text.placedSymbolArray.get(index).crossTileID = 0;
                }
                else {
                    bucket.text.placedSymbolArray.get(index).crossTileID = symbolInstance.crossTileID;
                }
            }
        }
    }
    markUsedOrientation(bucket, orientation, symbolInstance) {
        const horizontal = (orientation === WritingMode.horizontal || orientation === WritingMode.horizontalOnly) ? orientation : 0;
        const vertical = orientation === WritingMode.vertical ? orientation : 0;
        const horizontalIndexes = [
            symbolInstance.leftJustifiedTextSymbolIndex,
            symbolInstance.centerJustifiedTextSymbolIndex,
            symbolInstance.rightJustifiedTextSymbolIndex
        ];
        for (const index of horizontalIndexes) {
            bucket.text.placedSymbolArray.get(index).placedOrientation = horizontal;
        }
        if (symbolInstance.verticalPlacedTextSymbolIndex) {
            bucket.text.placedSymbolArray.get(symbolInstance.verticalPlacedTextSymbolIndex).placedOrientation = vertical;
        }
    }
    commit(now) {
        this.commitTime = now;
        this.zoomAtLastRecencyCheck = this.transform.zoom;
        const prevPlacement = this.prevPlacement;
        let placementChanged = false;
        this.prevZoomAdjustment = prevPlacement ? prevPlacement.zoomAdjustment(this.transform.zoom) : 0;
        const increment = prevPlacement ? prevPlacement.symbolFadeChange(now) : 1;
        const prevOpacities = prevPlacement ? prevPlacement.opacities : {};
        const prevOffsets = prevPlacement ? prevPlacement.variableOffsets : {};
        const prevOrientations = prevPlacement ? prevPlacement.placedOrientations : {};
        for (const crossTileID in this.placements) {
            const jointPlacement = this.placements[crossTileID];
            const prevOpacity = prevOpacities[crossTileID];
            if (prevOpacity) {
                this.opacities[crossTileID] = new JointOpacityState(prevOpacity, increment, jointPlacement.text, jointPlacement.icon);
                placementChanged = placementChanged ||
                    jointPlacement.text !== prevOpacity.text.placed ||
                    jointPlacement.icon !== prevOpacity.icon.placed;
            }
            else {
                this.opacities[crossTileID] = new JointOpacityState(null, increment, jointPlacement.text, jointPlacement.icon, jointPlacement.skipFade);
                placementChanged = placementChanged || jointPlacement.text || jointPlacement.icon;
            }
        }
        for (const crossTileID in prevOpacities) {
            const prevOpacity = prevOpacities[crossTileID];
            if (!this.opacities[crossTileID]) {
                const jointOpacity = new JointOpacityState(prevOpacity, increment, false, false);
                if (!jointOpacity.isHidden()) {
                    this.opacities[crossTileID] = jointOpacity;
                    placementChanged = placementChanged || prevOpacity.text.placed || prevOpacity.icon.placed;
                }
            }
        }
        for (const crossTileID in prevOffsets) {
            if (!this.variableOffsets[crossTileID] && this.opacities[crossTileID] && !this.opacities[crossTileID].isHidden()) {
                this.variableOffsets[crossTileID] = prevOffsets[crossTileID];
            }
        }
        for (const crossTileID in prevOrientations) {
            if (!this.placedOrientations[crossTileID] && this.opacities[crossTileID] && !this.opacities[crossTileID].isHidden()) {
                this.placedOrientations[crossTileID] = prevOrientations[crossTileID];
            }
        }
        if (prevPlacement && prevPlacement.lastPlacementChangeTime === undefined) {
            throw new Error('Last placement time for previous placement is not defined');
        }
        if (placementChanged) {
            this.lastPlacementChangeTime = now;
        }
        else if (typeof this.lastPlacementChangeTime !== 'number') {
            this.lastPlacementChangeTime = prevPlacement ? prevPlacement.lastPlacementChangeTime : now;
        }
    }
    updateLayerOpacities(styleLayer, tiles) {
        const seenCrossTileIDs = {};
        for (const tile of tiles) {
            const symbolBucket = tile.getBucket(styleLayer);
            if (symbolBucket && tile.latestFeatureIndex && styleLayer.id === symbolBucket.layerIds[0]) {
                this.updateBucketOpacities(symbolBucket, tile.tileID, seenCrossTileIDs, tile.collisionBoxArray);
            }
        }
    }
    updateBucketOpacities(bucket, tileID, seenCrossTileIDs, collisionBoxArray) {
        if (bucket.hasTextData()) {
            bucket.text.opacityVertexArray.clear();
            bucket.text.hasVisibleVertices = false;
        }
        if (bucket.hasIconData()) {
            bucket.icon.opacityVertexArray.clear();
            bucket.icon.hasVisibleVertices = false;
        }
        if (bucket.hasIconCollisionBoxData())
            bucket.iconCollisionBox.collisionVertexArray.clear();
        if (bucket.hasTextCollisionBoxData())
            bucket.textCollisionBox.collisionVertexArray.clear();
        const layer = bucket.layers[0];
        const layout = layer.layout;
        const duplicateOpacityState = new JointOpacityState(null, 0, false, false, true);
        const textAllowOverlap = layout.get('text-allow-overlap');
        const iconAllowOverlap = layout.get('icon-allow-overlap');
        const hasVariablePlacement = layer._unevaluatedLayout.hasValue('text-variable-anchor') || layer._unevaluatedLayout.hasValue('text-variable-anchor-offset');
        const rotateWithMap = layout.get('text-rotation-alignment') === 'map';
        const pitchWithMap = layout.get('text-pitch-alignment') === 'map';
        const hasIconTextFit = layout.get('icon-text-fit') !== 'none';
        const defaultOpacityState = new JointOpacityState(null, 0, textAllowOverlap && (iconAllowOverlap || !bucket.hasIconData() || layout.get('icon-optional')), iconAllowOverlap && (textAllowOverlap || !bucket.hasTextData() || layout.get('text-optional')), true);
        if (!bucket.collisionArrays && collisionBoxArray && ((bucket.hasIconCollisionBoxData() || bucket.hasTextCollisionBoxData()))) {
            bucket.deserializeCollisionBoxes(collisionBoxArray);
        }
        const addOpacities = (iconOrText, numVertices, opacity) => {
            for (let i = 0; i < numVertices / 4; i++) {
                iconOrText.opacityVertexArray.emplaceBack(opacity);
            }
            iconOrText.hasVisibleVertices = iconOrText.hasVisibleVertices || (opacity !== PACKED_HIDDEN_OPACITY);
        };
        const boxArrays = this.collisionBoxArrays.get(bucket.bucketInstanceId);
        for (let s = 0; s < bucket.symbolInstances.length; s++) {
            const symbolInstance = bucket.symbolInstances.get(s);
            const { numHorizontalGlyphVertices, numVerticalGlyphVertices, crossTileID } = symbolInstance;
            const isDuplicate = seenCrossTileIDs[crossTileID];
            let opacityState = this.opacities[crossTileID];
            if (isDuplicate) {
                opacityState = duplicateOpacityState;
            }
            else if (!opacityState) {
                opacityState = defaultOpacityState;
                this.opacities[crossTileID] = opacityState;
            }
            seenCrossTileIDs[crossTileID] = true;
            const hasText = numHorizontalGlyphVertices > 0 || numVerticalGlyphVertices > 0;
            const hasIcon = symbolInstance.numIconVertices > 0;
            const placedOrientation = this.placedOrientations[symbolInstance.crossTileID];
            const horizontalHidden = placedOrientation === WritingMode.vertical;
            const verticalHidden = placedOrientation === WritingMode.horizontal || placedOrientation === WritingMode.horizontalOnly;
            if (hasText) {
                const packedOpacity = packOpacity(opacityState.text);
                const horizontalOpacity = horizontalHidden ? PACKED_HIDDEN_OPACITY : packedOpacity;
                addOpacities(bucket.text, numHorizontalGlyphVertices, horizontalOpacity);
                const verticalOpacity = verticalHidden ? PACKED_HIDDEN_OPACITY : packedOpacity;
                addOpacities(bucket.text, numVerticalGlyphVertices, verticalOpacity);
                const symbolHidden = opacityState.text.isHidden();
                [
                    symbolInstance.rightJustifiedTextSymbolIndex,
                    symbolInstance.centerJustifiedTextSymbolIndex,
                    symbolInstance.leftJustifiedTextSymbolIndex
                ].forEach(index => {
                    if (index >= 0) {
                        bucket.text.placedSymbolArray.get(index).hidden = symbolHidden || horizontalHidden ? 1 : 0;
                    }
                });
                if (symbolInstance.verticalPlacedTextSymbolIndex >= 0) {
                    bucket.text.placedSymbolArray.get(symbolInstance.verticalPlacedTextSymbolIndex).hidden = symbolHidden || verticalHidden ? 1 : 0;
                }
                const prevOffset = this.variableOffsets[symbolInstance.crossTileID];
                if (prevOffset) {
                    this.markUsedJustification(bucket, prevOffset.anchor, symbolInstance, placedOrientation);
                }
                const prevOrientation = this.placedOrientations[symbolInstance.crossTileID];
                if (prevOrientation) {
                    this.markUsedJustification(bucket, 'left', symbolInstance, prevOrientation);
                    this.markUsedOrientation(bucket, prevOrientation, symbolInstance);
                }
            }
            if (hasIcon) {
                const packedOpacity = packOpacity(opacityState.icon);
                const useHorizontal = !(hasIconTextFit && symbolInstance.verticalPlacedIconSymbolIndex && horizontalHidden);
                if (symbolInstance.placedIconSymbolIndex >= 0) {
                    const horizontalOpacity = useHorizontal ? packedOpacity : PACKED_HIDDEN_OPACITY;
                    addOpacities(bucket.icon, symbolInstance.numIconVertices, horizontalOpacity);
                    bucket.icon.placedSymbolArray.get(symbolInstance.placedIconSymbolIndex).hidden =
                        opacityState.icon.isHidden();
                }
                if (symbolInstance.verticalPlacedIconSymbolIndex >= 0) {
                    const verticalOpacity = !useHorizontal ? packedOpacity : PACKED_HIDDEN_OPACITY;
                    addOpacities(bucket.icon, symbolInstance.numVerticalIconVertices, verticalOpacity);
                    bucket.icon.placedSymbolArray.get(symbolInstance.verticalPlacedIconSymbolIndex).hidden =
                        opacityState.icon.isHidden();
                }
            }
            const realBoxes = (boxArrays && boxArrays.has(s)) ? boxArrays.get(s) : {
                text: null,
                icon: null
            };
            if (bucket.hasIconCollisionBoxData() || bucket.hasTextCollisionBoxData()) {
                const collisionArrays = bucket.collisionArrays[s];
                if (collisionArrays) {
                    let shift = new Point(0, 0);
                    if (collisionArrays.textBox || collisionArrays.verticalTextBox) {
                        let used = true;
                        if (hasVariablePlacement) {
                            const variableOffset = this.variableOffsets[crossTileID];
                            if (variableOffset) {
                                shift = calculateVariableLayoutShift(variableOffset.anchor, variableOffset.width, variableOffset.height, variableOffset.textOffset, variableOffset.textBoxScale);
                                if (rotateWithMap) {
                                    shift._rotate(pitchWithMap ? -this.transform.bearingInRadians : this.transform.bearingInRadians);
                                }
                            }
                            else {
                                used = false;
                            }
                        }
                        if (collisionArrays.textBox || collisionArrays.verticalTextBox) {
                            let hidden;
                            if (collisionArrays.textBox) {
                                hidden = horizontalHidden;
                            }
                            if (collisionArrays.verticalTextBox) {
                                hidden = verticalHidden;
                            }
                            updateCollisionVertices(bucket.textCollisionBox.collisionVertexArray, opacityState.text.placed, !used || hidden, realBoxes.text, shift.x, shift.y);
                        }
                    }
                    if (collisionArrays.iconBox || collisionArrays.verticalIconBox) {
                        const verticalIconUsed = Boolean(!verticalHidden && collisionArrays.verticalIconBox);
                        let hidden;
                        if (collisionArrays.iconBox) {
                            hidden = verticalIconUsed;
                        }
                        if (collisionArrays.verticalIconBox) {
                            hidden = !verticalIconUsed;
                        }
                        updateCollisionVertices(bucket.iconCollisionBox.collisionVertexArray, opacityState.icon.placed, hidden, realBoxes.icon, hasIconTextFit ? shift.x : 0, hasIconTextFit ? shift.y : 0);
                    }
                }
            }
        }
        bucket.sortFeatures(-this.transform.bearingInRadians);
        if (this.retainedQueryData[bucket.bucketInstanceId]) {
            this.retainedQueryData[bucket.bucketInstanceId].featureSortOrder = bucket.featureSortOrder;
        }
        if (bucket.hasTextData() && bucket.text.opacityVertexBuffer) {
            bucket.text.opacityVertexBuffer.updateData(bucket.text.opacityVertexArray);
        }
        if (bucket.hasIconData() && bucket.icon.opacityVertexBuffer) {
            bucket.icon.opacityVertexBuffer.updateData(bucket.icon.opacityVertexArray);
        }
        if (bucket.hasIconCollisionBoxData() && bucket.iconCollisionBox.collisionVertexBuffer) {
            bucket.iconCollisionBox.collisionVertexBuffer.updateData(bucket.iconCollisionBox.collisionVertexArray);
        }
        if (bucket.hasTextCollisionBoxData() && bucket.textCollisionBox.collisionVertexBuffer) {
            bucket.textCollisionBox.collisionVertexBuffer.updateData(bucket.textCollisionBox.collisionVertexArray);
        }
        if (bucket.text.opacityVertexArray.length !== bucket.text.layoutVertexArray.length / 4)
            throw new Error(`bucket.text.opacityVertexArray.length (= ${bucket.text.opacityVertexArray.length}) !== bucket.text.layoutVertexArray.length (= ${bucket.text.layoutVertexArray.length}) / 4`);
        if (bucket.icon.opacityVertexArray.length !== bucket.icon.layoutVertexArray.length / 4)
            throw new Error(`bucket.icon.opacityVertexArray.length (= ${bucket.icon.opacityVertexArray.length}) !== bucket.icon.layoutVertexArray.length (= ${bucket.icon.layoutVertexArray.length}) / 4`);
        if (bucket.bucketInstanceId in this.collisionCircleArrays) {
            bucket.collisionCircleArray = this.collisionCircleArrays[bucket.bucketInstanceId];
            delete this.collisionCircleArrays[bucket.bucketInstanceId];
        }
    }
    symbolFadeChange(now) {
        return this.fadeDuration === 0 ?
            1 :
            ((now - this.commitTime) / this.fadeDuration + this.prevZoomAdjustment);
    }
    zoomAdjustment(zoom) {
        return Math.max(0, (this.transform.zoom - zoom) / 1.5);
    }
    hasTransitions(now) {
        return this.stale ||
            now - this.lastPlacementChangeTime < this.fadeDuration;
    }
    stillRecent(now, zoom) {
        const durationAdjustment = this.zoomAtLastRecencyCheck === zoom ?
            (1 - this.zoomAdjustment(zoom)) :
            1;
        this.zoomAtLastRecencyCheck = zoom;
        return this.commitTime + this.fadeDuration * durationAdjustment > now;
    }
    setStale() {
        this.stale = true;
    }
}
function updateCollisionVertices(collisionVertexArray, placed, notUsed, realBox, shiftX, shiftY) {
    if (!realBox || realBox.length === 0) {
        realBox = [0, 0, 0, 0];
    }
    const tlX = realBox[0] - viewportPadding;
    const tlY = realBox[1] - viewportPadding;
    const brX = realBox[2] - viewportPadding;
    const brY = realBox[3] - viewportPadding;
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0, shiftX || 0, shiftY || 0, tlX, tlY);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0, shiftX || 0, shiftY || 0, brX, tlY);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0, shiftX || 0, shiftY || 0, brX, brY);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0, shiftX || 0, shiftY || 0, tlX, brY);
}
const shift25 = Math.pow(2, 25);
const shift24 = Math.pow(2, 24);
const shift17 = Math.pow(2, 17);
const shift16 = Math.pow(2, 16);
const shift9 = Math.pow(2, 9);
const shift8 = Math.pow(2, 8);
const shift1 = Math.pow(2, 1);
function packOpacity(opacityState) {
    if (opacityState.opacity === 0 && !opacityState.placed) {
        return 0;
    }
    else if (opacityState.opacity === 1 && opacityState.placed) {
        return 4294967295;
    }
    const targetBit = opacityState.placed ? 1 : 0;
    const opacityBits = Math.floor(opacityState.opacity * 127);
    return opacityBits * shift25 + targetBit * shift24 +
        opacityBits * shift17 + targetBit * shift16 +
        opacityBits * shift9 + targetBit * shift8 +
        opacityBits * shift1 + targetBit;
}
const PACKED_HIDDEN_OPACITY = 0;
//# sourceMappingURL=placement.js.map