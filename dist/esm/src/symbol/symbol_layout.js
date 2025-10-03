import { Anchor } from './anchor';
import { getAnchors, getCenterAnchor } from './get_anchors';
import { clipLine } from './clip_line';
import { shapeText, shapeIcon, WritingMode, fitIconToText } from './shaping';
import { getGlyphQuads, getIconQuads } from './quads';
import { CollisionFeature } from './collision_feature';
import { warnOnce } from '../util/util';
import { allowsVerticalWritingMode, allowsLetterSpacing } from '../util/script_detection';
import { findPoleOfInaccessibility } from '../util/find_pole_of_inaccessibility';
import { EXTENT } from '../data/extent';
import { SymbolBucket } from '../data/bucket/symbol_bucket';
import { EvaluationParameters } from '../style/evaluation_parameters';
import { SIZE_PACK_FACTOR, MAX_PACKED_SIZE, MAX_GLYPH_ICON_SIZE } from './symbol_size';
import ONE_EM from './one_em';
import murmur3 from 'murmurhash-js';
import { getIconPadding } from '../style/style_layer/symbol_style_layer';
import { classifyRings } from '@maplibre/maplibre-gl-style-spec';
import { getTextVariableAnchorOffset, evaluateVariableOffset, INVALID_TEXT_OFFSET, TextAnchorEnum } from '../style/style_layer/variable_text_anchor';
import { subdivideVertexLine } from '../render/subdivision';
export function performSymbolLayout(args) {
    args.bucket.createArrays();
    const tileSize = 512 * args.bucket.overscaling;
    args.bucket.tilePixelRatio = EXTENT / tileSize;
    args.bucket.compareText = {};
    args.bucket.iconsNeedLinear = false;
    const layer = args.bucket.layers[0];
    const layout = layer.layout;
    const unevaluatedLayoutValues = layer._unevaluatedLayout._values;
    const sizes = {
        layoutIconSize: unevaluatedLayoutValues['icon-size'].possiblyEvaluate(new EvaluationParameters(args.bucket.zoom + 1), args.canonical),
        layoutTextSize: unevaluatedLayoutValues['text-size'].possiblyEvaluate(new EvaluationParameters(args.bucket.zoom + 1), args.canonical),
        textMaxSize: unevaluatedLayoutValues['text-size'].possiblyEvaluate(new EvaluationParameters(18))
    };
    if (args.bucket.textSizeData.kind === 'composite') {
        const { minZoom, maxZoom } = args.bucket.textSizeData;
        sizes.compositeTextSizes = [
            unevaluatedLayoutValues['text-size'].possiblyEvaluate(new EvaluationParameters(minZoom), args.canonical),
            unevaluatedLayoutValues['text-size'].possiblyEvaluate(new EvaluationParameters(maxZoom), args.canonical)
        ];
    }
    if (args.bucket.iconSizeData.kind === 'composite') {
        const { minZoom, maxZoom } = args.bucket.iconSizeData;
        sizes.compositeIconSizes = [
            unevaluatedLayoutValues['icon-size'].possiblyEvaluate(new EvaluationParameters(minZoom), args.canonical),
            unevaluatedLayoutValues['icon-size'].possiblyEvaluate(new EvaluationParameters(maxZoom), args.canonical)
        ];
    }
    const lineHeight = layout.get('text-line-height') * ONE_EM;
    const textAlongLine = layout.get('text-rotation-alignment') !== 'viewport' && layout.get('symbol-placement') !== 'point';
    const keepUpright = layout.get('text-keep-upright');
    const textSize = layout.get('text-size');
    for (const feature of args.bucket.features) {
        const fontstack = layout.get('text-font').evaluate(feature, {}, args.canonical).join(',');
        const layoutTextSizeThisZoom = textSize.evaluate(feature, {}, args.canonical);
        const layoutTextSize = sizes.layoutTextSize.evaluate(feature, {}, args.canonical);
        const layoutIconSize = sizes.layoutIconSize.evaluate(feature, {}, args.canonical);
        const shapedTextOrientations = {
            horizontal: {},
            vertical: undefined
        };
        const text = feature.text;
        let textOffset = [0, 0];
        if (text) {
            const unformattedText = text.toString();
            const spacing = layout.get('text-letter-spacing').evaluate(feature, {}, args.canonical) * ONE_EM;
            const spacingIfAllowed = allowsLetterSpacing(unformattedText) ? spacing : 0;
            const textAnchor = layout.get('text-anchor').evaluate(feature, {}, args.canonical);
            const variableAnchorOffset = getTextVariableAnchorOffset(layer, feature, args.canonical);
            if (!variableAnchorOffset) {
                const radialOffset = layout.get('text-radial-offset').evaluate(feature, {}, args.canonical);
                if (radialOffset) {
                    textOffset = evaluateVariableOffset(textAnchor, [radialOffset * ONE_EM, INVALID_TEXT_OFFSET]);
                }
                else {
                    textOffset = layout.get('text-offset').evaluate(feature, {}, args.canonical).map(t => t * ONE_EM);
                }
            }
            let textJustify = textAlongLine ?
                'center' :
                layout.get('text-justify').evaluate(feature, {}, args.canonical);
            const symbolPlacement = layout.get('symbol-placement');
            const maxWidth = symbolPlacement === 'point' ?
                layout.get('text-max-width').evaluate(feature, {}, args.canonical) * ONE_EM :
                Infinity;
            const addVerticalShapingForPointLabelIfNeeded = () => {
                if (args.bucket.allowVerticalPlacement && allowsVerticalWritingMode(unformattedText)) {
                    shapedTextOrientations.vertical = shapeText(text, args.glyphMap, args.glyphPositions, args.imagePositions, fontstack, maxWidth, lineHeight, textAnchor, 'left', spacingIfAllowed, textOffset, WritingMode.vertical, true, layoutTextSize, layoutTextSizeThisZoom);
                }
            };
            if (!textAlongLine && variableAnchorOffset) {
                const justifications = new Set();
                if (textJustify === 'auto') {
                    for (let i = 0; i < variableAnchorOffset.values.length; i += 2) {
                        justifications.add(getAnchorJustification(variableAnchorOffset.values[i]));
                    }
                }
                else {
                    justifications.add(textJustify);
                }
                let singleLine = false;
                for (const justification of justifications) {
                    if (shapedTextOrientations.horizontal[justification])
                        continue;
                    if (singleLine) {
                        shapedTextOrientations.horizontal[justification] = shapedTextOrientations.horizontal[0];
                    }
                    else {
                        const shaping = shapeText(text, args.glyphMap, args.glyphPositions, args.imagePositions, fontstack, maxWidth, lineHeight, 'center', justification, spacingIfAllowed, textOffset, WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
                        if (shaping) {
                            shapedTextOrientations.horizontal[justification] = shaping;
                            singleLine = shaping.positionedLines.length === 1;
                        }
                    }
                }
                addVerticalShapingForPointLabelIfNeeded();
            }
            else {
                if (textJustify === 'auto') {
                    textJustify = getAnchorJustification(textAnchor);
                }
                const shaping = shapeText(text, args.glyphMap, args.glyphPositions, args.imagePositions, fontstack, maxWidth, lineHeight, textAnchor, textJustify, spacingIfAllowed, textOffset, WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
                if (shaping)
                    shapedTextOrientations.horizontal[textJustify] = shaping;
                addVerticalShapingForPointLabelIfNeeded();
                if (allowsVerticalWritingMode(unformattedText) && textAlongLine && keepUpright) {
                    shapedTextOrientations.vertical = shapeText(text, args.glyphMap, args.glyphPositions, args.imagePositions, fontstack, maxWidth, lineHeight, textAnchor, textJustify, spacingIfAllowed, textOffset, WritingMode.vertical, false, layoutTextSize, layoutTextSizeThisZoom);
                }
            }
        }
        let shapedIcon;
        let isSDFIcon = false;
        if (feature.icon && feature.icon.name) {
            const image = args.imageMap[feature.icon.name];
            if (image) {
                shapedIcon = shapeIcon(args.imagePositions[feature.icon.name], layout.get('icon-offset').evaluate(feature, {}, args.canonical), layout.get('icon-anchor').evaluate(feature, {}, args.canonical));
                isSDFIcon = !!image.sdf;
                if (args.bucket.sdfIcons === undefined) {
                    args.bucket.sdfIcons = isSDFIcon;
                }
                else if (args.bucket.sdfIcons !== isSDFIcon) {
                    warnOnce('Style sheet warning: Cannot mix SDF and non-SDF icons in one buffer');
                }
                if (image.pixelRatio !== args.bucket.pixelRatio) {
                    args.bucket.iconsNeedLinear = true;
                }
                else if (layout.get('icon-rotate').constantOr(1) !== 0) {
                    args.bucket.iconsNeedLinear = true;
                }
            }
        }
        const shapedText = getDefaultHorizontalShaping(shapedTextOrientations.horizontal) || shapedTextOrientations.vertical;
        args.bucket.iconsInText = shapedText ? shapedText.iconsInText : false;
        if (shapedText || shapedIcon) {
            addFeature(args.bucket, feature, shapedTextOrientations, shapedIcon, args.imageMap, sizes, layoutTextSize, layoutIconSize, textOffset, isSDFIcon, args.canonical, args.subdivisionGranularity);
        }
    }
    if (args.showCollisionBoxes) {
        args.bucket.generateCollisionDebugBuffers();
    }
}
export function getAnchorJustification(anchor) {
    switch (anchor) {
        case 'right':
        case 'top-right':
        case 'bottom-right':
            return 'right';
        case 'left':
        case 'top-left':
        case 'bottom-left':
            return 'left';
    }
    return 'center';
}
function addFeature(bucket, feature, shapedTextOrientations, shapedIcon, imageMap, sizes, layoutTextSize, layoutIconSize, textOffset, isSDFIcon, canonical, subdivisionGranularity) {
    let textMaxSize = sizes.textMaxSize.evaluate(feature, {});
    if (textMaxSize === undefined) {
        textMaxSize = layoutTextSize;
    }
    const layout = bucket.layers[0].layout;
    const iconOffset = layout.get('icon-offset').evaluate(feature, {}, canonical);
    const defaultHorizontalShaping = getDefaultHorizontalShaping(shapedTextOrientations.horizontal);
    const glyphSize = 24, fontScale = layoutTextSize / glyphSize, textBoxScale = bucket.tilePixelRatio * fontScale, textMaxBoxScale = bucket.tilePixelRatio * textMaxSize / glyphSize, iconBoxScale = bucket.tilePixelRatio * layoutIconSize, symbolMinDistance = bucket.tilePixelRatio * layout.get('symbol-spacing'), textPadding = layout.get('text-padding') * bucket.tilePixelRatio, iconPadding = getIconPadding(layout, feature, canonical, bucket.tilePixelRatio), textMaxAngle = layout.get('text-max-angle') / 180 * Math.PI, textAlongLine = layout.get('text-rotation-alignment') !== 'viewport' && layout.get('symbol-placement') !== 'point', iconAlongLine = layout.get('icon-rotation-alignment') === 'map' && layout.get('symbol-placement') !== 'point', symbolPlacement = layout.get('symbol-placement'), textRepeatDistance = symbolMinDistance / 2;
    const iconTextFit = layout.get('icon-text-fit');
    let verticallyShapedIcon;
    if (shapedIcon && iconTextFit !== 'none') {
        if (bucket.allowVerticalPlacement && shapedTextOrientations.vertical) {
            verticallyShapedIcon = fitIconToText(shapedIcon, shapedTextOrientations.vertical, iconTextFit, layout.get('icon-text-fit-padding'), iconOffset, fontScale);
        }
        if (defaultHorizontalShaping) {
            shapedIcon = fitIconToText(shapedIcon, defaultHorizontalShaping, iconTextFit, layout.get('icon-text-fit-padding'), iconOffset, fontScale);
        }
    }
    const granularity = (canonical) ? subdivisionGranularity.line.getGranularityForZoomLevel(canonical.z) : 1;
    const addSymbolAtAnchor = (line, anchor) => {
        if (anchor.x < 0 || anchor.x >= EXTENT || anchor.y < 0 || anchor.y >= EXTENT) {
            return;
        }
        addSymbol(bucket, anchor, line, shapedTextOrientations, shapedIcon, imageMap, verticallyShapedIcon, bucket.layers[0], bucket.collisionBoxArray, feature.index, feature.sourceLayerIndex, bucket.index, textBoxScale, [textPadding, textPadding, textPadding, textPadding], textAlongLine, textOffset, iconBoxScale, iconPadding, iconAlongLine, iconOffset, feature, sizes, isSDFIcon, canonical, layoutTextSize);
    };
    if (symbolPlacement === 'line') {
        for (const line of clipLine(feature.geometry, 0, 0, EXTENT, EXTENT)) {
            const subdividedLine = subdivideVertexLine(line, granularity);
            const anchors = getAnchors(subdividedLine, symbolMinDistance, textMaxAngle, shapedTextOrientations.vertical || defaultHorizontalShaping, shapedIcon, glyphSize, textMaxBoxScale, bucket.overscaling, EXTENT);
            for (const anchor of anchors) {
                const shapedText = defaultHorizontalShaping;
                if (!shapedText || !anchorIsTooClose(bucket, shapedText.text, textRepeatDistance, anchor)) {
                    addSymbolAtAnchor(subdividedLine, anchor);
                }
            }
        }
    }
    else if (symbolPlacement === 'line-center') {
        for (const line of feature.geometry) {
            if (line.length > 1) {
                const subdividedLine = subdivideVertexLine(line, granularity);
                const anchor = getCenterAnchor(subdividedLine, textMaxAngle, shapedTextOrientations.vertical || defaultHorizontalShaping, shapedIcon, glyphSize, textMaxBoxScale);
                if (anchor) {
                    addSymbolAtAnchor(subdividedLine, anchor);
                }
            }
        }
    }
    else if (feature.type === 'Polygon') {
        for (const polygon of classifyRings(feature.geometry, 0)) {
            const poi = findPoleOfInaccessibility(polygon, 16);
            const subdividedLine = subdivideVertexLine(polygon[0], granularity, true);
            addSymbolAtAnchor(subdividedLine, new Anchor(poi.x, poi.y, 0));
        }
    }
    else if (feature.type === 'LineString') {
        for (const line of feature.geometry) {
            const subdividedLine = subdivideVertexLine(line, granularity);
            addSymbolAtAnchor(subdividedLine, new Anchor(subdividedLine[0].x, subdividedLine[0].y, 0));
        }
    }
    else if (feature.type === 'Point') {
        for (const points of feature.geometry) {
            for (const point of points) {
                addSymbolAtAnchor([point], new Anchor(point.x, point.y, 0));
            }
        }
    }
}
function addTextVariableAnchorOffsets(textAnchorOffsets, variableAnchorOffset) {
    const startIndex = textAnchorOffsets.length;
    const values = variableAnchorOffset === null || variableAnchorOffset === void 0 ? void 0 : variableAnchorOffset.values;
    if ((values === null || values === void 0 ? void 0 : values.length) > 0) {
        for (let i = 0; i < values.length; i += 2) {
            const anchor = TextAnchorEnum[values[i]];
            const offset = values[i + 1];
            textAnchorOffsets.emplaceBack(anchor, offset[0], offset[1]);
        }
    }
    return [startIndex, textAnchorOffsets.length];
}
function addTextVertices(bucket, anchor, shapedText, imageMap, layer, textAlongLine, feature, textOffset, lineArray, writingMode, placementTypes, placedTextSymbolIndices, placedIconIndex, sizes, canonical) {
    const glyphQuads = getGlyphQuads(anchor, shapedText, textOffset, layer, textAlongLine, feature, imageMap, bucket.allowVerticalPlacement);
    const sizeData = bucket.textSizeData;
    let textSizeData = null;
    if (sizeData.kind === 'source') {
        textSizeData = [
            SIZE_PACK_FACTOR * layer.layout.get('text-size').evaluate(feature, {})
        ];
        if (textSizeData[0] > MAX_PACKED_SIZE) {
            warnOnce(`${bucket.layerIds[0]}: Value for "text-size" is >= ${MAX_GLYPH_ICON_SIZE}. Reduce your "text-size".`);
        }
    }
    else if (sizeData.kind === 'composite') {
        textSizeData = [
            SIZE_PACK_FACTOR * sizes.compositeTextSizes[0].evaluate(feature, {}, canonical),
            SIZE_PACK_FACTOR * sizes.compositeTextSizes[1].evaluate(feature, {}, canonical)
        ];
        if (textSizeData[0] > MAX_PACKED_SIZE || textSizeData[1] > MAX_PACKED_SIZE) {
            warnOnce(`${bucket.layerIds[0]}: Value for "text-size" is >= ${MAX_GLYPH_ICON_SIZE}. Reduce your "text-size".`);
        }
    }
    bucket.addSymbols(bucket.text, glyphQuads, textSizeData, textOffset, textAlongLine, feature, writingMode, anchor, lineArray.lineStartIndex, lineArray.lineLength, placedIconIndex, canonical);
    for (const placementType of placementTypes) {
        placedTextSymbolIndices[placementType] = bucket.text.placedSymbolArray.length - 1;
    }
    return glyphQuads.length * 4;
}
function getDefaultHorizontalShaping(horizontalShaping) {
    for (const justification in horizontalShaping) {
        return horizontalShaping[justification];
    }
    return null;
}
function addSymbol(bucket, anchor, line, shapedTextOrientations, shapedIcon, imageMap, verticallyShapedIcon, layer, collisionBoxArray, featureIndex, sourceLayerIndex, bucketIndex, textBoxScale, textPadding, textAlongLine, textOffset, iconBoxScale, iconPadding, iconAlongLine, iconOffset, feature, sizes, isSDFIcon, canonical, layoutTextSize) {
    const lineArray = bucket.addToLineVertexArray(anchor, line);
    let textCollisionFeature, iconCollisionFeature, verticalTextCollisionFeature, verticalIconCollisionFeature;
    let numIconVertices = 0;
    let numVerticalIconVertices = 0;
    let numHorizontalGlyphVertices = 0;
    let numVerticalGlyphVertices = 0;
    let placedIconSymbolIndex = -1;
    let verticalPlacedIconSymbolIndex = -1;
    const placedTextSymbolIndices = {};
    let key = murmur3('');
    if (bucket.allowVerticalPlacement && shapedTextOrientations.vertical) {
        const textRotation = layer.layout.get('text-rotate').evaluate(feature, {}, canonical);
        const verticalTextRotation = textRotation + 90.0;
        const verticalShaping = shapedTextOrientations.vertical;
        verticalTextCollisionFeature = new CollisionFeature(collisionBoxArray, anchor, featureIndex, sourceLayerIndex, bucketIndex, verticalShaping, textBoxScale, textPadding, textAlongLine, verticalTextRotation);
        if (verticallyShapedIcon) {
            verticalIconCollisionFeature = new CollisionFeature(collisionBoxArray, anchor, featureIndex, sourceLayerIndex, bucketIndex, verticallyShapedIcon, iconBoxScale, iconPadding, textAlongLine, verticalTextRotation);
        }
    }
    if (shapedIcon) {
        const iconRotate = layer.layout.get('icon-rotate').evaluate(feature, {});
        const hasIconTextFit = layer.layout.get('icon-text-fit') !== 'none';
        const iconQuads = getIconQuads(shapedIcon, iconRotate, isSDFIcon, hasIconTextFit);
        const verticalIconQuads = verticallyShapedIcon ? getIconQuads(verticallyShapedIcon, iconRotate, isSDFIcon, hasIconTextFit) : undefined;
        iconCollisionFeature = new CollisionFeature(collisionBoxArray, anchor, featureIndex, sourceLayerIndex, bucketIndex, shapedIcon, iconBoxScale, iconPadding, false, iconRotate);
        numIconVertices = iconQuads.length * 4;
        const sizeData = bucket.iconSizeData;
        let iconSizeData = null;
        if (sizeData.kind === 'source') {
            iconSizeData = [
                SIZE_PACK_FACTOR * layer.layout.get('icon-size').evaluate(feature, {})
            ];
            if (iconSizeData[0] > MAX_PACKED_SIZE) {
                warnOnce(`${bucket.layerIds[0]}: Value for "icon-size" is >= ${MAX_GLYPH_ICON_SIZE}. Reduce your "icon-size".`);
            }
        }
        else if (sizeData.kind === 'composite') {
            iconSizeData = [
                SIZE_PACK_FACTOR * sizes.compositeIconSizes[0].evaluate(feature, {}, canonical),
                SIZE_PACK_FACTOR * sizes.compositeIconSizes[1].evaluate(feature, {}, canonical)
            ];
            if (iconSizeData[0] > MAX_PACKED_SIZE || iconSizeData[1] > MAX_PACKED_SIZE) {
                warnOnce(`${bucket.layerIds[0]}: Value for "icon-size" is >= ${MAX_GLYPH_ICON_SIZE}. Reduce your "icon-size".`);
            }
        }
        bucket.addSymbols(bucket.icon, iconQuads, iconSizeData, iconOffset, iconAlongLine, feature, WritingMode.none, anchor, lineArray.lineStartIndex, lineArray.lineLength, -1, canonical);
        placedIconSymbolIndex = bucket.icon.placedSymbolArray.length - 1;
        if (verticalIconQuads) {
            numVerticalIconVertices = verticalIconQuads.length * 4;
            bucket.addSymbols(bucket.icon, verticalIconQuads, iconSizeData, iconOffset, iconAlongLine, feature, WritingMode.vertical, anchor, lineArray.lineStartIndex, lineArray.lineLength, -1, canonical);
            verticalPlacedIconSymbolIndex = bucket.icon.placedSymbolArray.length - 1;
        }
    }
    const justifications = Object.keys(shapedTextOrientations.horizontal);
    for (const justification of justifications) {
        const shaping = shapedTextOrientations.horizontal[justification];
        if (!textCollisionFeature) {
            key = murmur3(shaping.text);
            const textRotate = layer.layout.get('text-rotate').evaluate(feature, {}, canonical);
            textCollisionFeature = new CollisionFeature(collisionBoxArray, anchor, featureIndex, sourceLayerIndex, bucketIndex, shaping, textBoxScale, textPadding, textAlongLine, textRotate);
        }
        const singleLine = shaping.positionedLines.length === 1;
        numHorizontalGlyphVertices += addTextVertices(bucket, anchor, shaping, imageMap, layer, textAlongLine, feature, textOffset, lineArray, shapedTextOrientations.vertical ? WritingMode.horizontal : WritingMode.horizontalOnly, singleLine ? justifications : [justification], placedTextSymbolIndices, placedIconSymbolIndex, sizes, canonical);
        if (singleLine) {
            break;
        }
    }
    if (shapedTextOrientations.vertical) {
        numVerticalGlyphVertices += addTextVertices(bucket, anchor, shapedTextOrientations.vertical, imageMap, layer, textAlongLine, feature, textOffset, lineArray, WritingMode.vertical, ['vertical'], placedTextSymbolIndices, verticalPlacedIconSymbolIndex, sizes, canonical);
    }
    const textBoxStartIndex = textCollisionFeature ? textCollisionFeature.boxStartIndex : bucket.collisionBoxArray.length;
    const textBoxEndIndex = textCollisionFeature ? textCollisionFeature.boxEndIndex : bucket.collisionBoxArray.length;
    const verticalTextBoxStartIndex = verticalTextCollisionFeature ? verticalTextCollisionFeature.boxStartIndex : bucket.collisionBoxArray.length;
    const verticalTextBoxEndIndex = verticalTextCollisionFeature ? verticalTextCollisionFeature.boxEndIndex : bucket.collisionBoxArray.length;
    const iconBoxStartIndex = iconCollisionFeature ? iconCollisionFeature.boxStartIndex : bucket.collisionBoxArray.length;
    const iconBoxEndIndex = iconCollisionFeature ? iconCollisionFeature.boxEndIndex : bucket.collisionBoxArray.length;
    const verticalIconBoxStartIndex = verticalIconCollisionFeature ? verticalIconCollisionFeature.boxStartIndex : bucket.collisionBoxArray.length;
    const verticalIconBoxEndIndex = verticalIconCollisionFeature ? verticalIconCollisionFeature.boxEndIndex : bucket.collisionBoxArray.length;
    let collisionCircleDiameter = -1;
    const getCollisionCircleHeight = (feature, prevHeight) => {
        if (feature && feature.circleDiameter)
            return Math.max(feature.circleDiameter, prevHeight);
        return prevHeight;
    };
    collisionCircleDiameter = getCollisionCircleHeight(textCollisionFeature, collisionCircleDiameter);
    collisionCircleDiameter = getCollisionCircleHeight(verticalTextCollisionFeature, collisionCircleDiameter);
    collisionCircleDiameter = getCollisionCircleHeight(iconCollisionFeature, collisionCircleDiameter);
    collisionCircleDiameter = getCollisionCircleHeight(verticalIconCollisionFeature, collisionCircleDiameter);
    const useRuntimeCollisionCircles = (collisionCircleDiameter > -1) ? 1 : 0;
    if (useRuntimeCollisionCircles)
        collisionCircleDiameter *= layoutTextSize / ONE_EM;
    if (bucket.glyphOffsetArray.length >= SymbolBucket.MAX_GLYPHS)
        warnOnce('Too many glyphs being rendered in a tile. See https://github.com/mapbox/mapbox-gl-js/issues/2907');
    if (feature.sortKey !== undefined) {
        bucket.addToSortKeyRanges(bucket.symbolInstances.length, feature.sortKey);
    }
    const variableAnchorOffset = getTextVariableAnchorOffset(layer, feature, canonical);
    const [textAnchorOffsetStartIndex, textAnchorOffsetEndIndex] = addTextVariableAnchorOffsets(bucket.textAnchorOffsets, variableAnchorOffset);
    bucket.symbolInstances.emplaceBack(anchor.x, anchor.y, placedTextSymbolIndices.right >= 0 ? placedTextSymbolIndices.right : -1, placedTextSymbolIndices.center >= 0 ? placedTextSymbolIndices.center : -1, placedTextSymbolIndices.left >= 0 ? placedTextSymbolIndices.left : -1, placedTextSymbolIndices.vertical || -1, placedIconSymbolIndex, verticalPlacedIconSymbolIndex, key, textBoxStartIndex, textBoxEndIndex, verticalTextBoxStartIndex, verticalTextBoxEndIndex, iconBoxStartIndex, iconBoxEndIndex, verticalIconBoxStartIndex, verticalIconBoxEndIndex, featureIndex, numHorizontalGlyphVertices, numVerticalGlyphVertices, numIconVertices, numVerticalIconVertices, useRuntimeCollisionCircles, 0, textBoxScale, collisionCircleDiameter, textAnchorOffsetStartIndex, textAnchorOffsetEndIndex);
}
function anchorIsTooClose(bucket, text, repeatDistance, anchor) {
    const compareText = bucket.compareText;
    if (!(text in compareText)) {
        compareText[text] = [];
    }
    else {
        const otherAnchors = compareText[text];
        for (let k = otherAnchors.length - 1; k >= 0; k--) {
            if (anchor.dist(otherAnchors[k]) < repeatDistance) {
                return true;
            }
        }
    }
    compareText[text].push(anchor);
    return false;
}
//# sourceMappingURL=symbol_layout.js.map