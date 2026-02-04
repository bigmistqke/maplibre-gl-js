import {type QueryIntersectsFeatureParams, StyleLayer} from '../style_layer';
import {LineBucket} from '../../data/bucket/line_bucket';
import {polygonIntersectsBufferedMultiLine} from '../../util/intersection_tests';
import {getMaximumPaintValue, translateDistance, translate, offsetLine} from '../query_utils';
import properties, {type LineLayoutPropsPossiblyEvaluated, type LinePaintPropsPossiblyEvaluated} from './line_style_layer_properties.g';
import {extend, assertedNotNullish } from '../../util/util';
import {EvaluationParameters} from '../evaluation_parameters';
import {type Transitionable, type Transitioning, type Layout, type PossiblyEvaluated, DataDrivenProperty, type PossiblyEvaluatedPropertyValue, type PropertyValue, type PossiblyEvaluatedValue} from '../properties';
import type {Feature, FeatureState} from '@maplibre/maplibre-gl-style-spec';

import {isZoomExpression, Step} from '@maplibre/maplibre-gl-style-spec';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Bucket, BucketParameters} from '../../data/bucket';
import type {LineLayoutProps, LinePaintProps} from './line_style_layer_properties.g';

export class LineFloorwidthProperty extends DataDrivenProperty<number> {
    useIntegerZoom: true | undefined;

    possiblyEvaluate(value: PropertyValue<number, PossiblyEvaluatedPropertyValue<number>>, parameters: EvaluationParameters): PossiblyEvaluatedPropertyValue<number> {
        parameters = new EvaluationParameters(Math.floor(parameters.zoom), {
            now: parameters.now,
            fadeDuration: parameters.fadeDuration,
            zoomHistory: parameters.zoomHistory,
            transition: parameters.transition
        });
        return super.possiblyEvaluate(value, parameters);
    }

    evaluate(value: PossiblyEvaluatedValue<number>, globals: EvaluationParameters, feature: Feature, featureState: FeatureState): number {
        globals = extend({}, globals, {zoom: Math.floor(globals.zoom)});
        return super.evaluate(value, globals, feature, featureState);
    }
}

let lineFloorwidthProperty: LineFloorwidthProperty;

export const isLineStyleLayer = (layer: StyleLayer): layer is LineStyleLayer => layer.type === 'line';

export class LineStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<LineLayoutProps> | undefined;
    layout: PossiblyEvaluated<LineLayoutProps, LineLayoutPropsPossiblyEvaluated> | undefined;

    gradientVersion: number;
    stepInterpolant: boolean | undefined;

    _transitionablePaint: Transitionable<LinePaintProps> | undefined;
    _transitioningPaint: Transitioning<LinePaintProps> | undefined;
    paint: PossiblyEvaluated<LinePaintProps, LinePaintPropsPossiblyEvaluated> | undefined;

    constructor(layer: LayerSpecification, globalState: Record<string, any>) {
        super(layer, properties, globalState);
        this.gradientVersion = 0;
        if (!lineFloorwidthProperty) {
            lineFloorwidthProperty =
                new LineFloorwidthProperty(properties.paint.properties['line-width'].specification);
            lineFloorwidthProperty.useIntegerZoom = true;
        }
    }

    _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'line-gradient') {
            const expression = this.gradientExpression();
            if (isZoomExpression(expression)) {
                this.stepInterpolant = expression._styleExpression.expression instanceof Step;
            } else {
                this.stepInterpolant = false;
            }
            this.gradientVersion = (this.gradientVersion + 1) % Number.MAX_SAFE_INTEGER;
        }
    }

    gradientExpression() {
        return assertedNotNullish(this._transitionablePaint)._values['line-gradient'].value.expression;
    }

    recalculate(parameters: EvaluationParameters, availableImages: Array<string>) {
        super.recalculate(parameters, availableImages);
        (assertedNotNullish(this.paint)._values as any)['line-floorwidth'] =
            lineFloorwidthProperty.possiblyEvaluate(assertedNotNullish(this._transitioningPaint)._values['line-width'].value as PropertyValue<number, PossiblyEvaluatedPropertyValue<number>>, parameters);
    }

    createBucket(parameters: BucketParameters<any>) {
        return new LineBucket(parameters);
    }

    queryRadius(bucket: Bucket): number {
        const lineBucket: LineBucket = (bucket as any);
        const width = getLineWidth(
            getMaximumPaintValue('line-width', this, lineBucket),
            getMaximumPaintValue('line-gap-width', this, lineBucket));
        const offset = getMaximumPaintValue('line-offset', this, lineBucket);
        return width / 2 + Math.abs(offset) + translateDistance(assertedNotNullish(this.paint).get('line-translate'));
    }

    queryIntersectsFeature({
        queryGeometry,
        feature,
        featureState,
        geometry,
        transform,
        pixelsToTileUnits}: QueryIntersectsFeatureParams
    ): boolean {
        const translatedPolygon = translate(queryGeometry,
            assertedNotNullish(this.paint).get('line-translate'),
            assertedNotNullish(this.paint).get('line-translate-anchor'),
            -transform.bearingInRadians, pixelsToTileUnits);
        const halfWidth = pixelsToTileUnits / 2 * getLineWidth(
            assertedNotNullish(this.paint).get('line-width').evaluate(feature, featureState),
            assertedNotNullish(this.paint).get('line-gap-width').evaluate(feature, featureState));
        const lineOffset = assertedNotNullish(this.paint).get('line-offset').evaluate(feature, featureState);
        if (lineOffset) {
            geometry = offsetLine(geometry, lineOffset * pixelsToTileUnits);
        }

        return polygonIntersectsBufferedMultiLine(translatedPolygon, geometry, halfWidth);
    }

    isTileClipped() {
        return true;
    }
}

function getLineWidth(lineWidth: number, lineGapWidth: number): number {
    if (lineGapWidth > 0) {
        return lineGapWidth + 2 * lineWidth;
    } else {
        return lineWidth;
    }
}
