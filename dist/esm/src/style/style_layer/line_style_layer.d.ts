import { type QueryIntersectsFeatureParams, StyleLayer } from '../style_layer';
import { LineBucket } from '../../data/bucket/line_bucket';
import { type LineLayoutPropsPossiblyEvaluated, type LinePaintPropsPossiblyEvaluated } from './line_style_layer_properties.g';
import { EvaluationParameters } from '../evaluation_parameters';
import { type Transitionable, type Transitioning, type Layout, type PossiblyEvaluated, DataDrivenProperty } from '../properties';
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Bucket, BucketParameters } from '../../data/bucket';
import type { LineLayoutProps, LinePaintProps } from './line_style_layer_properties.g';
export declare class LineFloorwidthProperty extends DataDrivenProperty<number> {
    useIntegerZoom: true;
    possiblyEvaluate(value: any, parameters: any): import("../properties").PossiblyEvaluatedPropertyValue<number>;
    evaluate(value: any, globals: any, feature: any, featureState: any): number;
}
export declare const isLineStyleLayer: (layer: StyleLayer) => layer is LineStyleLayer;
export declare class LineStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<LineLayoutProps>;
    layout: PossiblyEvaluated<LineLayoutProps, LineLayoutPropsPossiblyEvaluated>;
    gradientVersion: number;
    stepInterpolant: boolean;
    _transitionablePaint: Transitionable<LinePaintProps>;
    _transitioningPaint: Transitioning<LinePaintProps>;
    paint: PossiblyEvaluated<LinePaintProps, LinePaintPropsPossiblyEvaluated>;
    constructor(layer: LayerSpecification, globalState: Record<string, any>);
    _handleSpecialPaintPropertyUpdate(name: string): void;
    gradientExpression(): import("@maplibre/maplibre-gl-style-spec").StylePropertyExpression;
    recalculate(parameters: EvaluationParameters, availableImages: Array<string>): void;
    createBucket(parameters: BucketParameters<any>): LineBucket;
    queryRadius(bucket: Bucket): number;
    queryIntersectsFeature({ queryGeometry, feature, featureState, geometry, transform, pixelsToTileUnits }: QueryIntersectsFeatureParams): boolean;
    isTileClipped(): boolean;
}
//# sourceMappingURL=line_style_layer.d.ts.map