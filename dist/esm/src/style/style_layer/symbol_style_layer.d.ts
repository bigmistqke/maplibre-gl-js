import { StyleLayer } from '../style_layer';
import { SymbolBucket, type SymbolFeature } from '../../data/bucket/symbol_bucket';
import { type SymbolLayoutPropsPossiblyEvaluated, type SymbolPaintPropsPossiblyEvaluated } from './symbol_style_layer_properties.g';
import { type Transitionable, type Transitioning, type Layout, type PossiblyEvaluated, type PropertyValue } from '../properties';
import type { BucketParameters } from '../../data/bucket';
import type { SymbolLayoutProps, SymbolPaintProps } from './symbol_style_layer_properties.g';
import type { EvaluationParameters } from '../evaluation_parameters';
import type { Feature, LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { CanonicalTileID } from '../../source/tile_id';
export declare const isSymbolStyleLayer: (layer: StyleLayer) => layer is SymbolStyleLayer;
export declare class SymbolStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<SymbolLayoutProps>;
    layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>;
    _transitionablePaint: Transitionable<SymbolPaintProps>;
    _transitioningPaint: Transitioning<SymbolPaintProps>;
    paint: PossiblyEvaluated<SymbolPaintProps, SymbolPaintPropsPossiblyEvaluated>;
    constructor(layer: LayerSpecification, globalState: Record<string, any>);
    recalculate(parameters: EvaluationParameters, availableImages: Array<string>): void;
    getValueAndResolveTokens(name: any, feature: Feature, canonical: CanonicalTileID, availableImages: Array<string>): any;
    createBucket(parameters: BucketParameters<any>): SymbolBucket;
    queryRadius(): number;
    queryIntersectsFeature(): boolean;
    _setPaintOverrides(): void;
    _handleOverridablePaintPropertyUpdate<T, R>(name: string, oldValue: PropertyValue<T, R>, newValue: PropertyValue<T, R>): boolean;
    static hasPaintOverride(layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>, propertyName: string): boolean;
}
export type SymbolPadding = [number, number, number, number];
export declare function getIconPadding(layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>, feature: SymbolFeature, canonical: CanonicalTileID, pixelRatio?: number): SymbolPadding;
//# sourceMappingURL=symbol_style_layer.d.ts.map