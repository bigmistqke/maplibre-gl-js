import {StyleLayer} from '../style_layer';

import {SymbolBucket, type SymbolFeature} from '../../data/bucket/symbol_bucket';
import {resolveTokens} from '../../util/resolve_tokens';
import properties, {type SymbolLayoutPropsPossiblyEvaluated, type SymbolPaintPropsPossiblyEvaluated} from './symbol_style_layer_properties.g';

import {
    type Transitionable,
    type Transitioning,
    type Layout,
    PossiblyEvaluated,
    PossiblyEvaluatedPropertyValue,
    type PropertyValue
} from '../properties';

import {
    isExpression,
    StyleExpression,
    ZoomConstantExpression,
    ZoomDependentExpression,
    FormattedType,
    typeOf,
    Formatted,
    FormatExpression,
    Literal} from '@maplibre/maplibre-gl-style-spec';

import type {BucketParameters} from '../../data/bucket';
import type {SymbolLayoutProps, SymbolPaintProps} from './symbol_style_layer_properties.g';
import type {EvaluationParameters} from '../evaluation_parameters';
import type {Expression, Feature, SourceExpression, LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {CanonicalTileID} from '../../tile/tile_id';
import {FormatSectionOverride} from '../format_section_override';
import {assertedNotNullish, isRecord} from '../../util/util';

export const isSymbolStyleLayer = (layer: StyleLayer): layer is SymbolStyleLayer => layer.type === 'symbol';

export class SymbolStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<SymbolLayoutProps> | undefined;
    layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>;

    _transitionablePaint: Transitionable<SymbolPaintProps> | undefined;
    _transitioningPaint: Transitioning<SymbolPaintProps> | undefined;
    paint: PossiblyEvaluated<SymbolPaintProps, SymbolPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification, globalState: Record<string, any>) {
        super(layer, properties, globalState);
        this.paint = new PossiblyEvaluated<SymbolPaintProps, SymbolPaintPropsPossiblyEvaluated>(properties.paint);
        this.layout = new PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>(properties.layout);
    }

    recalculate(parameters: EvaluationParameters, availableImages: Array<string> | undefined) {
        super.recalculate(parameters, availableImages);

        const layoutValues = this.layout._values as Record<string, any>;

        if (this.layout.get('icon-rotation-alignment') === 'auto') {
            if (this.layout.get('symbol-placement') !== 'point') {
                layoutValues['icon-rotation-alignment'] = 'map';
            } else {
                layoutValues['icon-rotation-alignment'] = 'viewport';
            }
        }

        if (this.layout.get('text-rotation-alignment') === 'auto') {
            if (this.layout.get('symbol-placement') !== 'point') {
                layoutValues['text-rotation-alignment'] = 'map';
            } else {
                layoutValues['text-rotation-alignment'] = 'viewport';
            }
        }

        // If unspecified, `*-pitch-alignment` inherits `*-rotation-alignment`
        if (this.layout.get('text-pitch-alignment') === 'auto') {
            layoutValues['text-pitch-alignment'] = this.layout.get('text-rotation-alignment') === 'map' ? 'map' : 'viewport';
        }
        if (this.layout.get('icon-pitch-alignment') === 'auto') {
            layoutValues['icon-pitch-alignment'] = this.layout.get('icon-rotation-alignment');
        }

        if (this.layout.get('symbol-placement') === 'point') {
            const writingModes = this.layout.get('text-writing-mode');
            if (writingModes) {
                // remove duplicates, preserving order
                const deduped: Array<'horizontal' | 'vertical'> = [];
                for (const m of writingModes) {
                    if (deduped.indexOf(m) < 0) deduped.push(m);
                }
                layoutValues['text-writing-mode'] = deduped;
            } else {
                layoutValues['text-writing-mode'] = ['horizontal'];
            }
        }

        this._setPaintOverrides();
    }

    getValueAndResolveTokens(name: keyof SymbolLayoutPropsPossiblyEvaluated, feature: Feature, canonical: CanonicalTileID, availableImages: Array<string>) {
        const layoutValue = this.layout.get(name);
        const value = isRecord(layoutValue) && 'evaluate' in layoutValue
            ? layoutValue.evaluate(feature, {}, canonical, availableImages)
            : layoutValue;
        const unevaluatedValues = assertedNotNullish(this._unevaluatedLayout)._values;
        const unevaluated = unevaluatedValues[name];
        if (!unevaluated.isDataDriven() && !isExpression(unevaluated.value) && value) {
            return resolveTokens(feature.properties,
                // @ts-expect-error UNEXPECTED BEHAVIOR: resolveTokens expects second argument to be 'string', but value can be typed as 'number'
                value
            );
        }

        return value;
    }

    createBucket(parameters: BucketParameters<any>) {
        return new SymbolBucket(parameters);
    }

    queryRadius(): number {
        return 0;
    }

    queryIntersectsFeature(): boolean {
        throw new Error('Should take a different path in FeatureIndex');
    }

    _setPaintOverrides() {
        const paintValues = this.paint._values as unknown as Record<string, PossiblyEvaluatedPropertyValue<any>>;
        for (const overridable of properties.paint.overridableProperties) {
            if (!SymbolStyleLayer.hasPaintOverride(this.layout, overridable)) {
                continue;
            }
            const overridden = this.paint.get(overridable as keyof SymbolPaintPropsPossiblyEvaluated) as PossiblyEvaluatedPropertyValue<number>;
            const override = new FormatSectionOverride(overridden);
            const styleExpression = new StyleExpression(override, overridden.property.specification);
            let expression = null;
            if (overridden.value.kind === 'constant' || overridden.value.kind === 'source') {
                expression = new ZoomConstantExpression('source', styleExpression) as SourceExpression;
            } else {
                expression = new ZoomDependentExpression('composite',
                    styleExpression,
                    overridden.value.zoomStops);
            }
            paintValues[overridable] = new PossiblyEvaluatedPropertyValue(overridden.property,
                expression,
                overridden.parameters);
        }
    }

    _handleOverridablePaintPropertyUpdate<T, R>(name: string, oldValue: PropertyValue<T, R>, newValue: PropertyValue<T, R>): boolean {
        if (oldValue.isDataDriven() || newValue.isDataDriven()) {
            return false;
        }
        return SymbolStyleLayer.hasPaintOverride(this.layout, name);
    }

    static hasPaintOverride(layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>, propertyName: string): boolean {
        const textField = layout.get('text-field');
        const property = (properties.paint.properties as Record<string, any>)[propertyName];
        let hasOverrides = false;

        const checkSections = (sections: Formatted['sections']) => {
            for (const section of sections) {
                if (property.overrides && property.overrides.hasOverride(section)) {
                    hasOverrides = true;
                    return;
                }
            }
        };

        if (textField.value.kind === 'constant' && textField.value.value instanceof Formatted) {
            checkSections(textField.value.value.sections);
        } else if (textField.value.kind === 'source' || textField.value.kind === 'composite') {

            const checkExpression = (expression: Expression) => {
                if (hasOverrides) return;

                if (expression instanceof Literal && typeOf(expression.value) === FormattedType) {
                    const formatted: Formatted = (expression.value as any);
                    checkSections(formatted.sections);
                } else if (expression instanceof FormatExpression) {
                    checkSections(expression.sections as unknown as Formatted['sections']);
                } else {
                    expression.eachChild(checkExpression);
                }
            };

            const expr: ZoomConstantExpression<'source'> = (textField.value as any);
            if (expr._styleExpression) {
                checkExpression(expr._styleExpression.expression);
            }
        }

        return hasOverrides;
    }
}

export type SymbolPadding = [number, number, number, number];

export function getIconPadding(layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>, feature: SymbolFeature, canonical: CanonicalTileID, pixelRatio = 1): SymbolPadding {
    // Support text-padding in addition to icon-padding? Unclear how to apply asymmetric text-padding to the radius for collision circles.
    const result = layout.get('icon-padding').evaluate(feature, {}, canonical);
    const values = result && result.values;

    return [
        values[0] * pixelRatio,
        values[1] * pixelRatio,
        values[2] * pixelRatio,
        values[3] * pixelRatio,
    ];
}
