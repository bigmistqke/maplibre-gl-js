import { symbolLayoutAttributes, collisionVertexAttributes, collisionBoxLayout, dynamicLayoutAttributes, } from './symbol_attributes';
import { SymbolLayoutArray, SymbolDynamicLayoutArray, SymbolOpacityArray, CollisionBoxLayoutArray, CollisionVertexArray, PlacedSymbolArray, SymbolInstanceArray, GlyphOffsetArray, SymbolLineVertexArray, TextAnchorOffsetArray } from '../array_types.g';
import Point from '@mapbox/point-geometry';
import { SegmentVector } from '../segment';
import { ProgramConfigurationSet } from '../program_configuration';
import { TriangleIndexArray, LineIndexArray } from '../index_array_type';
import { transformText } from '../../symbol/transform_text';
import { mergeLines } from '../../symbol/merge_lines';
import { allowsVerticalWritingMode, stringContainsRTLText } from '../../util/script_detection';
import { WritingMode } from '../../symbol/shaping';
import { loadGeometry } from '../load_geometry';
import { toEvaluationFeature } from '../evaluation_feature';
import { VectorTileFeature } from '@mapbox/vector-tile';
import { verticalizedCharacterMap } from '../../util/verticalize_punctuation';
import { getSizeData, MAX_PACKED_SIZE } from '../../symbol/symbol_size';
import { register } from '../../util/web_worker_transfer';
import { EvaluationParameters } from '../../style/evaluation_parameters';
import { Formatted, ResolvedImage } from '@maplibre/maplibre-gl-style-spec';
import { rtlWorkerPlugin } from '../../source/rtl_text_plugin_worker';
import { getOverlapMode } from '../../style/style_layer/overlap_mode';
const shaderOpacityAttributes = [
    { name: 'a_fade_opacity', components: 1, type: 'Uint8', offset: 0 }
];
function addVertex(array, anchorX, anchorY, ox, oy, tx, ty, sizeVertex, isSDF, pixelOffsetX, pixelOffsetY, minFontScaleX, minFontScaleY) {
    const aSizeX = sizeVertex ? Math.min(MAX_PACKED_SIZE, Math.round(sizeVertex[0])) : 0;
    const aSizeY = sizeVertex ? Math.min(MAX_PACKED_SIZE, Math.round(sizeVertex[1])) : 0;
    array.emplaceBack(anchorX, anchorY, Math.round(ox * 32), Math.round(oy * 32), tx, ty, (aSizeX << 1) + (isSDF ? 1 : 0), aSizeY, pixelOffsetX * 16, pixelOffsetY * 16, minFontScaleX * 256, minFontScaleY * 256);
}
function addDynamicAttributes(dynamicLayoutVertexArray, p, angle) {
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
}
function containsRTLText(formattedText) {
    for (const section of formattedText.sections) {
        if (stringContainsRTLText(section.text)) {
            return true;
        }
    }
    return false;
}
export class SymbolBuffers {
    constructor(programConfigurations) {
        this.layoutVertexArray = new SymbolLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.programConfigurations = programConfigurations;
        this.segments = new SegmentVector();
        this.dynamicLayoutVertexArray = new SymbolDynamicLayoutArray();
        this.opacityVertexArray = new SymbolOpacityArray();
        this.hasVisibleVertices = false;
        this.placedSymbolArray = new PlacedSymbolArray();
    }
    isEmpty() {
        return this.layoutVertexArray.length === 0 &&
            this.indexArray.length === 0 &&
            this.dynamicLayoutVertexArray.length === 0 &&
            this.opacityVertexArray.length === 0;
    }
    upload(context, dynamicIndexBuffer, upload, update) {
        if (this.isEmpty()) {
            return;
        }
        if (upload) {
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, symbolLayoutAttributes.members);
            this.indexBuffer = context.createIndexBuffer(this.indexArray, dynamicIndexBuffer);
            this.dynamicLayoutVertexBuffer = context.createVertexBuffer(this.dynamicLayoutVertexArray, dynamicLayoutAttributes.members, true);
            this.opacityVertexBuffer = context.createVertexBuffer(this.opacityVertexArray, shaderOpacityAttributes, true);
            this.opacityVertexBuffer.itemSize = 1;
        }
        if (upload || update) {
            this.programConfigurations.upload(context);
        }
    }
    destroy() {
        if (!this.layoutVertexBuffer)
            return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
        this.dynamicLayoutVertexBuffer.destroy();
        this.opacityVertexBuffer.destroy();
    }
}
register('SymbolBuffers', SymbolBuffers);
class CollisionBuffers {
    constructor(LayoutArray, layoutAttributes, IndexArray) {
        this.layoutVertexArray = new LayoutArray();
        this.layoutAttributes = layoutAttributes;
        this.indexArray = new IndexArray();
        this.segments = new SegmentVector();
        this.collisionVertexArray = new CollisionVertexArray();
    }
    upload(context) {
        this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, this.layoutAttributes);
        this.indexBuffer = context.createIndexBuffer(this.indexArray);
        this.collisionVertexBuffer = context.createVertexBuffer(this.collisionVertexArray, collisionVertexAttributes.members, true);
    }
    destroy() {
        if (!this.layoutVertexBuffer)
            return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.segments.destroy();
        this.collisionVertexBuffer.destroy();
    }
}
register('CollisionBuffers', CollisionBuffers);
export class SymbolBucket {
    constructor(options) {
        this.collisionBoxArray = options.collisionBoxArray;
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.pixelRatio = options.pixelRatio;
        this.sourceLayerIndex = options.sourceLayerIndex;
        this.hasPattern = false;
        this.hasRTLText = false;
        this.sortKeyRanges = [];
        this.collisionCircleArray = [];
        const layer = this.layers[0];
        const unevaluatedLayoutValues = layer._unevaluatedLayout._values;
        this.textSizeData = getSizeData(this.zoom, unevaluatedLayoutValues['text-size']);
        this.iconSizeData = getSizeData(this.zoom, unevaluatedLayoutValues['icon-size']);
        const layout = this.layers[0].layout;
        const sortKey = layout.get('symbol-sort-key');
        const zOrder = layout.get('symbol-z-order');
        this.canOverlap =
            getOverlapMode(layout, 'text-overlap', 'text-allow-overlap') !== 'never' ||
                getOverlapMode(layout, 'icon-overlap', 'icon-allow-overlap') !== 'never' ||
                layout.get('text-ignore-placement') ||
                layout.get('icon-ignore-placement');
        this.sortFeaturesByKey = zOrder !== 'viewport-y' && !sortKey.isConstant();
        const zOrderByViewportY = zOrder === 'viewport-y' || (zOrder === 'auto' && !this.sortFeaturesByKey);
        this.sortFeaturesByY = zOrderByViewportY && this.canOverlap;
        if (layout.get('symbol-placement') === 'point') {
            this.writingModes = layout.get('text-writing-mode').map(wm => WritingMode[wm]);
        }
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
        this.sourceID = options.sourceID;
    }
    createArrays() {
        this.text = new SymbolBuffers(new ProgramConfigurationSet(this.layers, this.zoom, property => /^text/.test(property)));
        this.icon = new SymbolBuffers(new ProgramConfigurationSet(this.layers, this.zoom, property => /^icon/.test(property)));
        this.glyphOffsetArray = new GlyphOffsetArray();
        this.lineVertexArray = new SymbolLineVertexArray();
        this.symbolInstances = new SymbolInstanceArray();
        this.textAnchorOffsets = new TextAnchorOffsetArray();
    }
    calculateGlyphDependencies(text, stack, textAlongLine, allowVerticalPlacement, doesAllowVerticalWritingMode) {
        for (let i = 0; i < text.length; i++) {
            stack[text.charCodeAt(i)] = true;
            if ((textAlongLine || allowVerticalPlacement) && doesAllowVerticalWritingMode) {
                const verticalChar = verticalizedCharacterMap[text.charAt(i)];
                if (verticalChar) {
                    stack[verticalChar.charCodeAt(0)] = true;
                }
            }
        }
    }
    populate(features, options, canonical) {
        const layer = this.layers[0];
        const layout = layer.layout;
        const textFont = layout.get('text-font');
        const textField = layout.get('text-field');
        const iconImage = layout.get('icon-image');
        const hasText = (textField.value.kind !== 'constant' ||
            (textField.value.value instanceof Formatted && !textField.value.value.isEmpty()) ||
            textField.value.value.toString().length > 0) &&
            (textFont.value.kind !== 'constant' || textFont.value.value.length > 0);
        const hasIcon = iconImage.value.kind !== 'constant' || !!iconImage.value.value || Object.keys(iconImage.parameters).length > 0;
        const symbolSortKey = layout.get('symbol-sort-key');
        this.features = [];
        if (!hasText && !hasIcon) {
            return;
        }
        const icons = options.iconDependencies;
        const stacks = options.glyphDependencies;
        const availableImages = options.availableImages;
        const globalProperties = new EvaluationParameters(this.zoom);
        for (const { feature, id, index, sourceLayerIndex } of features) {
            const needGeometry = layer._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);
            if (!layer._featureFilter.filter(globalProperties, evaluationFeature, canonical)) {
                continue;
            }
            if (!needGeometry)
                evaluationFeature.geometry = loadGeometry(feature);
            let text;
            if (hasText) {
                const resolvedTokens = layer.getValueAndResolveTokens('text-field', evaluationFeature, canonical, availableImages);
                const formattedText = Formatted.factory(resolvedTokens);
                const bucketHasRTLText = this.hasRTLText = (this.hasRTLText || containsRTLText(formattedText));
                if (!bucketHasRTLText ||
                    rtlWorkerPlugin.getRTLTextPluginStatus() === 'unavailable' ||
                    bucketHasRTLText && rtlWorkerPlugin.isParsed()) {
                    text = transformText(formattedText, layer, evaluationFeature);
                }
            }
            let icon;
            if (hasIcon) {
                const resolvedTokens = layer.getValueAndResolveTokens('icon-image', evaluationFeature, canonical, availableImages);
                if (resolvedTokens instanceof ResolvedImage) {
                    icon = resolvedTokens;
                }
                else {
                    icon = ResolvedImage.fromString(resolvedTokens);
                }
            }
            if (!text && !icon) {
                continue;
            }
            const sortKey = this.sortFeaturesByKey ?
                symbolSortKey.evaluate(evaluationFeature, {}, canonical) :
                undefined;
            const symbolFeature = {
                id,
                text,
                icon,
                index,
                sourceLayerIndex,
                geometry: evaluationFeature.geometry,
                properties: feature.properties,
                type: VectorTileFeature.types[feature.type],
                sortKey
            };
            this.features.push(symbolFeature);
            if (icon) {
                icons[icon.name] = true;
            }
            if (text) {
                const fontStack = textFont.evaluate(evaluationFeature, {}, canonical).join(',');
                const textAlongLine = layout.get('text-rotation-alignment') !== 'viewport' && layout.get('symbol-placement') !== 'point';
                this.allowVerticalPlacement = this.writingModes && this.writingModes.indexOf(WritingMode.vertical) >= 0;
                for (const section of text.sections) {
                    if (!section.image) {
                        const doesAllowVerticalWritingMode = allowsVerticalWritingMode(text.toString());
                        const sectionFont = section.fontStack || fontStack;
                        const sectionStack = stacks[sectionFont] = stacks[sectionFont] || {};
                        this.calculateGlyphDependencies(section.text, sectionStack, textAlongLine, this.allowVerticalPlacement, doesAllowVerticalWritingMode);
                    }
                    else {
                        icons[section.image.name] = true;
                    }
                }
            }
        }
        if (layout.get('symbol-placement') === 'line') {
            this.features = mergeLines(this.features);
        }
        if (this.sortFeaturesByKey) {
            this.features.sort((a, b) => {
                return a.sortKey - b.sortKey;
            });
        }
    }
    update(states, vtLayer, imagePositions) {
        if (!this.stateDependentLayers.length)
            return;
        this.text.programConfigurations.updatePaintArrays(states, vtLayer, this.layers, {
            imagePositions
        });
        this.icon.programConfigurations.updatePaintArrays(states, vtLayer, this.layers, {
            imagePositions
        });
    }
    isEmpty() {
        return this.symbolInstances.length === 0 && !this.hasRTLText;
    }
    uploadPending() {
        return !this.uploaded || this.text.programConfigurations.needsUpload || this.icon.programConfigurations.needsUpload;
    }
    upload(context) {
        if (!this.uploaded && this.hasDebugData()) {
            this.textCollisionBox.upload(context);
            this.iconCollisionBox.upload(context);
        }
        this.text.upload(context, this.sortFeaturesByY, !this.uploaded, this.text.programConfigurations.needsUpload);
        this.icon.upload(context, this.sortFeaturesByY, !this.uploaded, this.icon.programConfigurations.needsUpload);
        this.uploaded = true;
    }
    destroyDebugData() {
        this.textCollisionBox.destroy();
        this.iconCollisionBox.destroy();
    }
    destroy() {
        this.text.destroy();
        this.icon.destroy();
        if (this.hasDebugData()) {
            this.destroyDebugData();
        }
    }
    addToLineVertexArray(anchor, line) {
        const lineStartIndex = this.lineVertexArray.length;
        if (anchor.segment !== undefined) {
            let sumForwardLength = anchor.dist(line[anchor.segment + 1]);
            let sumBackwardLength = anchor.dist(line[anchor.segment]);
            const vertices = {};
            for (let i = anchor.segment + 1; i < line.length; i++) {
                vertices[i] = { x: line[i].x, y: line[i].y, tileUnitDistanceFromAnchor: sumForwardLength };
                if (i < line.length - 1) {
                    sumForwardLength += line[i + 1].dist(line[i]);
                }
            }
            for (let i = anchor.segment || 0; i >= 0; i--) {
                vertices[i] = { x: line[i].x, y: line[i].y, tileUnitDistanceFromAnchor: sumBackwardLength };
                if (i > 0) {
                    sumBackwardLength += line[i - 1].dist(line[i]);
                }
            }
            for (let i = 0; i < line.length; i++) {
                const vertex = vertices[i];
                this.lineVertexArray.emplaceBack(vertex.x, vertex.y, vertex.tileUnitDistanceFromAnchor);
            }
        }
        return {
            lineStartIndex,
            lineLength: this.lineVertexArray.length - lineStartIndex
        };
    }
    addSymbols(arrays, quads, sizeVertex, lineOffset, alongLine, feature, writingMode, labelAnchor, lineStartIndex, lineLength, associatedIconIndex, canonical) {
        const indexArray = arrays.indexArray;
        const layoutVertexArray = arrays.layoutVertexArray;
        const segment = arrays.segments.prepareSegment(4 * quads.length, layoutVertexArray, indexArray, this.canOverlap ? feature.sortKey : undefined);
        const glyphOffsetArrayStart = this.glyphOffsetArray.length;
        const vertexStartIndex = segment.vertexLength;
        const angle = (this.allowVerticalPlacement && writingMode === WritingMode.vertical) ? Math.PI / 2 : 0;
        const sections = feature.text && feature.text.sections;
        for (let i = 0; i < quads.length; i++) {
            const { tl, tr, bl, br, tex, pixelOffsetTL, pixelOffsetBR, minFontScaleX, minFontScaleY, glyphOffset, isSDF, sectionIndex } = quads[i];
            const index = segment.vertexLength;
            const y = glyphOffset[1];
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, tl.x, y + tl.y, tex.x, tex.y, sizeVertex, isSDF, pixelOffsetTL.x, pixelOffsetTL.y, minFontScaleX, minFontScaleY);
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, tr.x, y + tr.y, tex.x + tex.w, tex.y, sizeVertex, isSDF, pixelOffsetBR.x, pixelOffsetTL.y, minFontScaleX, minFontScaleY);
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, bl.x, y + bl.y, tex.x, tex.y + tex.h, sizeVertex, isSDF, pixelOffsetTL.x, pixelOffsetBR.y, minFontScaleX, minFontScaleY);
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, br.x, y + br.y, tex.x + tex.w, tex.y + tex.h, sizeVertex, isSDF, pixelOffsetBR.x, pixelOffsetBR.y, minFontScaleX, minFontScaleY);
            addDynamicAttributes(arrays.dynamicLayoutVertexArray, labelAnchor, angle);
            indexArray.emplaceBack(index, index + 2, index + 1);
            indexArray.emplaceBack(index + 1, index + 2, index + 3);
            segment.vertexLength += 4;
            segment.primitiveLength += 2;
            this.glyphOffsetArray.emplaceBack(glyphOffset[0]);
            if (i === quads.length - 1 || sectionIndex !== quads[i + 1].sectionIndex) {
                arrays.programConfigurations.populatePaintArrays(layoutVertexArray.length, feature, feature.index, { imagePositions: {}, canonical, formattedSection: sections && sections[sectionIndex] });
            }
        }
        arrays.placedSymbolArray.emplaceBack(labelAnchor.x, labelAnchor.y, glyphOffsetArrayStart, this.glyphOffsetArray.length - glyphOffsetArrayStart, vertexStartIndex, lineStartIndex, lineLength, labelAnchor.segment, sizeVertex ? sizeVertex[0] : 0, sizeVertex ? sizeVertex[1] : 0, lineOffset[0], lineOffset[1], writingMode, 0, false, 0, associatedIconIndex);
    }
    _addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, point, anchorX, anchorY, extrude) {
        collisionVertexArray.emplaceBack(0, 0);
        return layoutVertexArray.emplaceBack(point.x, point.y, anchorX, anchorY, Math.round(extrude.x), Math.round(extrude.y));
    }
    addCollisionDebugVertices(x1, y1, x2, y2, arrays, boxAnchorPoint, symbolInstance) {
        const segment = arrays.segments.prepareSegment(4, arrays.layoutVertexArray, arrays.indexArray);
        const index = segment.vertexLength;
        const layoutVertexArray = arrays.layoutVertexArray;
        const collisionVertexArray = arrays.collisionVertexArray;
        const anchorX = symbolInstance.anchorX;
        const anchorY = symbolInstance.anchorY;
        this._addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, anchorX, anchorY, new Point(x1, y1));
        this._addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, anchorX, anchorY, new Point(x2, y1));
        this._addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, anchorX, anchorY, new Point(x2, y2));
        this._addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, anchorX, anchorY, new Point(x1, y2));
        segment.vertexLength += 4;
        const indexArray = arrays.indexArray;
        indexArray.emplaceBack(index, index + 1);
        indexArray.emplaceBack(index + 1, index + 2);
        indexArray.emplaceBack(index + 2, index + 3);
        indexArray.emplaceBack(index + 3, index);
        segment.primitiveLength += 4;
    }
    addDebugCollisionBoxes(startIndex, endIndex, symbolInstance, isText) {
        for (let b = startIndex; b < endIndex; b++) {
            const box = this.collisionBoxArray.get(b);
            const x1 = box.x1;
            const y1 = box.y1;
            const x2 = box.x2;
            const y2 = box.y2;
            this.addCollisionDebugVertices(x1, y1, x2, y2, isText ? this.textCollisionBox : this.iconCollisionBox, box.anchorPoint, symbolInstance);
        }
    }
    generateCollisionDebugBuffers() {
        if (this.hasDebugData()) {
            this.destroyDebugData();
        }
        this.textCollisionBox = new CollisionBuffers(CollisionBoxLayoutArray, collisionBoxLayout.members, LineIndexArray);
        this.iconCollisionBox = new CollisionBuffers(CollisionBoxLayoutArray, collisionBoxLayout.members, LineIndexArray);
        for (let i = 0; i < this.symbolInstances.length; i++) {
            const symbolInstance = this.symbolInstances.get(i);
            this.addDebugCollisionBoxes(symbolInstance.textBoxStartIndex, symbolInstance.textBoxEndIndex, symbolInstance, true);
            this.addDebugCollisionBoxes(symbolInstance.verticalTextBoxStartIndex, symbolInstance.verticalTextBoxEndIndex, symbolInstance, true);
            this.addDebugCollisionBoxes(symbolInstance.iconBoxStartIndex, symbolInstance.iconBoxEndIndex, symbolInstance, false);
            this.addDebugCollisionBoxes(symbolInstance.verticalIconBoxStartIndex, symbolInstance.verticalIconBoxEndIndex, symbolInstance, false);
        }
    }
    _deserializeCollisionBoxesForSymbol(collisionBoxArray, textStartIndex, textEndIndex, verticalTextStartIndex, verticalTextEndIndex, iconStartIndex, iconEndIndex, verticalIconStartIndex, verticalIconEndIndex) {
        const collisionArrays = {};
        for (let k = textStartIndex; k < textEndIndex; k++) {
            const box = collisionBoxArray.get(k);
            collisionArrays.textBox = { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2, anchorPointX: box.anchorPointX, anchorPointY: box.anchorPointY };
            collisionArrays.textFeatureIndex = box.featureIndex;
            break;
        }
        for (let k = verticalTextStartIndex; k < verticalTextEndIndex; k++) {
            const box = collisionBoxArray.get(k);
            collisionArrays.verticalTextBox = { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2, anchorPointX: box.anchorPointX, anchorPointY: box.anchorPointY };
            collisionArrays.verticalTextFeatureIndex = box.featureIndex;
            break;
        }
        for (let k = iconStartIndex; k < iconEndIndex; k++) {
            const box = collisionBoxArray.get(k);
            collisionArrays.iconBox = { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2, anchorPointX: box.anchorPointX, anchorPointY: box.anchorPointY };
            collisionArrays.iconFeatureIndex = box.featureIndex;
            break;
        }
        for (let k = verticalIconStartIndex; k < verticalIconEndIndex; k++) {
            const box = collisionBoxArray.get(k);
            collisionArrays.verticalIconBox = { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2, anchorPointX: box.anchorPointX, anchorPointY: box.anchorPointY };
            collisionArrays.verticalIconFeatureIndex = box.featureIndex;
            break;
        }
        return collisionArrays;
    }
    deserializeCollisionBoxes(collisionBoxArray) {
        this.collisionArrays = [];
        for (let i = 0; i < this.symbolInstances.length; i++) {
            const symbolInstance = this.symbolInstances.get(i);
            this.collisionArrays.push(this._deserializeCollisionBoxesForSymbol(collisionBoxArray, symbolInstance.textBoxStartIndex, symbolInstance.textBoxEndIndex, symbolInstance.verticalTextBoxStartIndex, symbolInstance.verticalTextBoxEndIndex, symbolInstance.iconBoxStartIndex, symbolInstance.iconBoxEndIndex, symbolInstance.verticalIconBoxStartIndex, symbolInstance.verticalIconBoxEndIndex));
        }
    }
    hasTextData() {
        return this.text.segments.get().length > 0;
    }
    hasIconData() {
        return this.icon.segments.get().length > 0;
    }
    hasDebugData() {
        return this.textCollisionBox && this.iconCollisionBox;
    }
    hasTextCollisionBoxData() {
        return this.hasDebugData() && this.textCollisionBox.segments.get().length > 0;
    }
    hasIconCollisionBoxData() {
        return this.hasDebugData() && this.iconCollisionBox.segments.get().length > 0;
    }
    addIndicesForPlacedSymbol(iconOrText, placedSymbolIndex) {
        const placedSymbol = iconOrText.placedSymbolArray.get(placedSymbolIndex);
        const endIndex = placedSymbol.vertexStartIndex + placedSymbol.numGlyphs * 4;
        for (let vertexIndex = placedSymbol.vertexStartIndex; vertexIndex < endIndex; vertexIndex += 4) {
            iconOrText.indexArray.emplaceBack(vertexIndex, vertexIndex + 2, vertexIndex + 1);
            iconOrText.indexArray.emplaceBack(vertexIndex + 1, vertexIndex + 2, vertexIndex + 3);
        }
    }
    getSortedSymbolIndexes(angle) {
        if (this.sortedAngle === angle && this.symbolInstanceIndexes !== undefined) {
            return this.symbolInstanceIndexes;
        }
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        const rotatedYs = [];
        const featureIndexes = [];
        const result = [];
        for (let i = 0; i < this.symbolInstances.length; ++i) {
            result.push(i);
            const symbolInstance = this.symbolInstances.get(i);
            rotatedYs.push(Math.round(sin * symbolInstance.anchorX + cos * symbolInstance.anchorY) | 0);
            featureIndexes.push(symbolInstance.featureIndex);
        }
        result.sort((aIndex, bIndex) => {
            return (rotatedYs[aIndex] - rotatedYs[bIndex]) ||
                (featureIndexes[bIndex] - featureIndexes[aIndex]);
        });
        return result;
    }
    addToSortKeyRanges(symbolInstanceIndex, sortKey) {
        const last = this.sortKeyRanges[this.sortKeyRanges.length - 1];
        if (last && last.sortKey === sortKey) {
            last.symbolInstanceEnd = symbolInstanceIndex + 1;
        }
        else {
            this.sortKeyRanges.push({
                sortKey,
                symbolInstanceStart: symbolInstanceIndex,
                symbolInstanceEnd: symbolInstanceIndex + 1
            });
        }
    }
    sortFeatures(angle) {
        if (!this.sortFeaturesByY)
            return;
        if (this.sortedAngle === angle)
            return;
        if (this.text.segments.get().length > 1 || this.icon.segments.get().length > 1)
            return;
        this.symbolInstanceIndexes = this.getSortedSymbolIndexes(angle);
        this.sortedAngle = angle;
        this.text.indexArray.clear();
        this.icon.indexArray.clear();
        this.featureSortOrder = [];
        for (const i of this.symbolInstanceIndexes) {
            const symbolInstance = this.symbolInstances.get(i);
            this.featureSortOrder.push(symbolInstance.featureIndex);
            [
                symbolInstance.rightJustifiedTextSymbolIndex,
                symbolInstance.centerJustifiedTextSymbolIndex,
                symbolInstance.leftJustifiedTextSymbolIndex
            ].forEach((index, i, array) => {
                if (index >= 0 && array.indexOf(index) === i) {
                    this.addIndicesForPlacedSymbol(this.text, index);
                }
            });
            if (symbolInstance.verticalPlacedTextSymbolIndex >= 0) {
                this.addIndicesForPlacedSymbol(this.text, symbolInstance.verticalPlacedTextSymbolIndex);
            }
            if (symbolInstance.placedIconSymbolIndex >= 0) {
                this.addIndicesForPlacedSymbol(this.icon, symbolInstance.placedIconSymbolIndex);
            }
            if (symbolInstance.verticalPlacedIconSymbolIndex >= 0) {
                this.addIndicesForPlacedSymbol(this.icon, symbolInstance.verticalPlacedIconSymbolIndex);
            }
        }
        if (this.text.indexBuffer)
            this.text.indexBuffer.updateData(this.text.indexArray);
        if (this.icon.indexBuffer)
            this.icon.indexBuffer.updateData(this.icon.indexArray);
    }
}
register('SymbolBucket', SymbolBucket, {
    omit: ['layers', 'collisionBoxArray', 'features', 'compareText']
});
SymbolBucket.MAX_GLYPHS = 65535;
SymbolBucket.addDynamicAttributes = addDynamicAttributes;
export { addDynamicAttributes };
//# sourceMappingURL=symbol_bucket.js.map