import { Interpolate, interpolates } from '@maplibre/maplibre-gl-style-spec';
import { clamp } from '../util/util';
import { EvaluationParameters } from '../style/evaluation_parameters';
const MAX_GLYPH_ICON_SIZE = 255;
const SIZE_PACK_FACTOR = 128;
const MAX_PACKED_SIZE = MAX_GLYPH_ICON_SIZE * SIZE_PACK_FACTOR;
export { getSizeData, evaluateSizeForFeature, evaluateSizeForZoom, SIZE_PACK_FACTOR, MAX_GLYPH_ICON_SIZE, MAX_PACKED_SIZE };
function getSizeData(tileZoom, value) {
    const { expression } = value;
    if (expression.kind === 'constant') {
        const layoutSize = expression.evaluate(new EvaluationParameters(tileZoom + 1));
        return { kind: 'constant', layoutSize };
    }
    else if (expression.kind === 'source') {
        return { kind: 'source' };
    }
    else {
        const { zoomStops, interpolationType } = expression;
        let lower = 0;
        while (lower < zoomStops.length && zoomStops[lower] <= tileZoom)
            lower++;
        lower = Math.max(0, lower - 1);
        let upper = lower;
        while (upper < zoomStops.length && zoomStops[upper] < tileZoom + 1)
            upper++;
        upper = Math.min(zoomStops.length - 1, upper);
        const minZoom = zoomStops[lower];
        const maxZoom = zoomStops[upper];
        if (expression.kind === 'composite') {
            return { kind: 'composite', minZoom, maxZoom, interpolationType };
        }
        const minSize = expression.evaluate(new EvaluationParameters(minZoom));
        const maxSize = expression.evaluate(new EvaluationParameters(maxZoom));
        return { kind: 'camera', minZoom, maxZoom, minSize, maxSize, interpolationType };
    }
}
function evaluateSizeForFeature(sizeData, { uSize, uSizeT }, { lowerSize, upperSize }) {
    if (sizeData.kind === 'source') {
        return lowerSize / SIZE_PACK_FACTOR;
    }
    else if (sizeData.kind === 'composite') {
        return interpolates.number(lowerSize / SIZE_PACK_FACTOR, upperSize / SIZE_PACK_FACTOR, uSizeT);
    }
    return uSize;
}
function evaluateSizeForZoom(sizeData, zoom) {
    let uSizeT = 0;
    let uSize = 0;
    if (sizeData.kind === 'constant') {
        uSize = sizeData.layoutSize;
    }
    else if (sizeData.kind !== 'source') {
        const { interpolationType, minZoom, maxZoom } = sizeData;
        const t = !interpolationType ? 0 : clamp(Interpolate.interpolationFactor(interpolationType, zoom, minZoom, maxZoom), 0, 1);
        if (sizeData.kind === 'camera') {
            uSize = interpolates.number(sizeData.minSize, sizeData.maxSize, t);
        }
        else {
            uSizeT = t;
        }
    }
    return { uSizeT, uSize };
}
//# sourceMappingURL=symbol_size.js.map