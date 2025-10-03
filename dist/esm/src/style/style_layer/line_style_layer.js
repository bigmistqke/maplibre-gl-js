import { StyleLayer } from '../style_layer';
import { LineBucket } from '../../data/bucket/line_bucket';
import { polygonIntersectsBufferedMultiLine } from '../../util/intersection_tests';
import { getMaximumPaintValue, translateDistance, translate, offsetLine } from '../query_utils';
import properties from './line_style_layer_properties.g';
import { extend } from '../../util/util';
import { EvaluationParameters } from '../evaluation_parameters';
import { DataDrivenProperty } from '../properties';
import { isZoomExpression, Step } from '@maplibre/maplibre-gl-style-spec';
export class LineFloorwidthProperty extends DataDrivenProperty {
    possiblyEvaluate(value, parameters) {
        parameters = new EvaluationParameters(Math.floor(parameters.zoom), {
            now: parameters.now,
            fadeDuration: parameters.fadeDuration,
            zoomHistory: parameters.zoomHistory,
            transition: parameters.transition
        });
        return super.possiblyEvaluate(value, parameters);
    }
    evaluate(value, globals, feature, featureState) {
        globals = extend({}, globals, { zoom: Math.floor(globals.zoom) });
        return super.evaluate(value, globals, feature, featureState);
    }
}
let lineFloorwidthProperty;
export const isLineStyleLayer = (layer) => layer.type === 'line';
export class LineStyleLayer extends StyleLayer {
    constructor(layer, globalState) {
        super(layer, properties, globalState);
        this.gradientVersion = 0;
        if (!lineFloorwidthProperty) {
            lineFloorwidthProperty =
                new LineFloorwidthProperty(properties.paint.properties['line-width'].specification);
            lineFloorwidthProperty.useIntegerZoom = true;
        }
    }
    _handleSpecialPaintPropertyUpdate(name) {
        if (name === 'line-gradient') {
            const expression = this.gradientExpression();
            if (isZoomExpression(expression)) {
                this.stepInterpolant = expression._styleExpression.expression instanceof Step;
            }
            else {
                this.stepInterpolant = false;
            }
            this.gradientVersion = (this.gradientVersion + 1) % Number.MAX_SAFE_INTEGER;
        }
    }
    gradientExpression() {
        return this._transitionablePaint._values['line-gradient'].value.expression;
    }
    recalculate(parameters, availableImages) {
        super.recalculate(parameters, availableImages);
        this.paint._values['line-floorwidth'] =
            lineFloorwidthProperty.possiblyEvaluate(this._transitioningPaint._values['line-width'].value, parameters);
    }
    createBucket(parameters) {
        return new LineBucket(parameters);
    }
    queryRadius(bucket) {
        const lineBucket = bucket;
        const width = getLineWidth(getMaximumPaintValue('line-width', this, lineBucket), getMaximumPaintValue('line-gap-width', this, lineBucket));
        const offset = getMaximumPaintValue('line-offset', this, lineBucket);
        return width / 2 + Math.abs(offset) + translateDistance(this.paint.get('line-translate'));
    }
    queryIntersectsFeature({ queryGeometry, feature, featureState, geometry, transform, pixelsToTileUnits }) {
        const translatedPolygon = translate(queryGeometry, this.paint.get('line-translate'), this.paint.get('line-translate-anchor'), -transform.bearingInRadians, pixelsToTileUnits);
        const halfWidth = pixelsToTileUnits / 2 * getLineWidth(this.paint.get('line-width').evaluate(feature, featureState), this.paint.get('line-gap-width').evaluate(feature, featureState));
        const lineOffset = this.paint.get('line-offset').evaluate(feature, featureState);
        if (lineOffset) {
            geometry = offsetLine(geometry, lineOffset * pixelsToTileUnits);
        }
        return polygonIntersectsBufferedMultiLine(translatedPolygon, geometry, halfWidth);
    }
    isTileClipped() {
        return true;
    }
}
function getLineWidth(lineWidth, lineGapWidth) {
    if (lineGapWidth > 0) {
        return lineGapWidth + 2 * lineWidth;
    }
    else {
        return lineWidth;
    }
}
//# sourceMappingURL=line_style_layer.js.map