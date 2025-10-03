import { VariableAnchorOffsetCollection } from '@maplibre/maplibre-gl-style-spec';
import ONE_EM from '../../symbol/one_em';
export var TextAnchorEnum;
(function (TextAnchorEnum) {
    TextAnchorEnum[TextAnchorEnum["center"] = 1] = "center";
    TextAnchorEnum[TextAnchorEnum["left"] = 2] = "left";
    TextAnchorEnum[TextAnchorEnum["right"] = 3] = "right";
    TextAnchorEnum[TextAnchorEnum["top"] = 4] = "top";
    TextAnchorEnum[TextAnchorEnum["bottom"] = 5] = "bottom";
    TextAnchorEnum[TextAnchorEnum["top-left"] = 6] = "top-left";
    TextAnchorEnum[TextAnchorEnum["top-right"] = 7] = "top-right";
    TextAnchorEnum[TextAnchorEnum["bottom-left"] = 8] = "bottom-left";
    TextAnchorEnum[TextAnchorEnum["bottom-right"] = 9] = "bottom-right";
})(TextAnchorEnum || (TextAnchorEnum = {}));
const baselineOffset = 7;
export const INVALID_TEXT_OFFSET = Number.POSITIVE_INFINITY;
export function evaluateVariableOffset(anchor, offset) {
    function fromRadialOffset(anchor, radialOffset) {
        let x = 0, y = 0;
        if (radialOffset < 0)
            radialOffset = 0;
        const hypotenuse = radialOffset / Math.SQRT2;
        switch (anchor) {
            case 'top-right':
            case 'top-left':
                y = hypotenuse - baselineOffset;
                break;
            case 'bottom-right':
            case 'bottom-left':
                y = -hypotenuse + baselineOffset;
                break;
            case 'bottom':
                y = -radialOffset + baselineOffset;
                break;
            case 'top':
                y = radialOffset - baselineOffset;
                break;
        }
        switch (anchor) {
            case 'top-right':
            case 'bottom-right':
                x = -hypotenuse;
                break;
            case 'top-left':
            case 'bottom-left':
                x = hypotenuse;
                break;
            case 'left':
                x = radialOffset;
                break;
            case 'right':
                x = -radialOffset;
                break;
        }
        return [x, y];
    }
    function fromTextOffset(anchor, offsetX, offsetY) {
        let x = 0, y = 0;
        offsetX = Math.abs(offsetX);
        offsetY = Math.abs(offsetY);
        switch (anchor) {
            case 'top-right':
            case 'top-left':
            case 'top':
                y = offsetY - baselineOffset;
                break;
            case 'bottom-right':
            case 'bottom-left':
            case 'bottom':
                y = -offsetY + baselineOffset;
                break;
        }
        switch (anchor) {
            case 'top-right':
            case 'bottom-right':
            case 'right':
                x = -offsetX;
                break;
            case 'top-left':
            case 'bottom-left':
            case 'left':
                x = offsetX;
                break;
        }
        return [x, y];
    }
    return (offset[1] !== INVALID_TEXT_OFFSET) ? fromTextOffset(anchor, offset[0], offset[1]) : fromRadialOffset(anchor, offset[0]);
}
export function getTextVariableAnchorOffset(layer, feature, canonical) {
    var _a;
    const layout = layer.layout;
    const variableAnchorOffset = (_a = layout.get('text-variable-anchor-offset')) === null || _a === void 0 ? void 0 : _a.evaluate(feature, {}, canonical);
    if (variableAnchorOffset) {
        const sourceValues = variableAnchorOffset.values;
        const destValues = [];
        for (let i = 0; i < sourceValues.length; i += 2) {
            const anchor = destValues[i] = sourceValues[i];
            const offset = sourceValues[i + 1].map(t => t * ONE_EM);
            if (anchor.startsWith('top')) {
                offset[1] -= baselineOffset;
            }
            else if (anchor.startsWith('bottom')) {
                offset[1] += baselineOffset;
            }
            destValues[i + 1] = offset;
        }
        return new VariableAnchorOffsetCollection(destValues);
    }
    const variableAnchor = layout.get('text-variable-anchor');
    if (variableAnchor) {
        let textOffset;
        const unevaluatedLayout = layer._unevaluatedLayout;
        if (unevaluatedLayout.getValue('text-radial-offset') !== undefined) {
            textOffset = [layout.get('text-radial-offset').evaluate(feature, {}, canonical) * ONE_EM, INVALID_TEXT_OFFSET];
        }
        else {
            textOffset = layout.get('text-offset').evaluate(feature, {}, canonical).map(t => t * ONE_EM);
        }
        const anchorOffsets = [];
        for (const anchor of variableAnchor) {
            anchorOffsets.push(anchor, evaluateVariableOffset(anchor, textOffset));
        }
        return new VariableAnchorOffsetCollection(anchorOffsets);
    }
    return null;
}
//# sourceMappingURL=variable_text_anchor.js.map