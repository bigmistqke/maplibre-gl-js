import { type QueryIntersectsFeatureParams, StyleLayer } from '../style_layer';
import { FillBucket } from '../../data/bucket/fill_bucket';
import { type FillLayoutPropsPossiblyEvaluated, type FillPaintPropsPossiblyEvaluated } from './fill_style_layer_properties.g';
import type { Transitionable, Transitioning, Layout, PossiblyEvaluated } from '../properties';
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { BucketParameters } from '../../data/bucket';
import type { FillLayoutProps, FillPaintProps } from './fill_style_layer_properties.g';
import type { EvaluationParameters } from '../evaluation_parameters';
export declare const isFillStyleLayer: (layer: StyleLayer) => layer is FillStyleLayer;
export declare class FillStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<FillLayoutProps>;
    layout: PossiblyEvaluated<FillLayoutProps, FillLayoutPropsPossiblyEvaluated>;
    _transitionablePaint: Transitionable<FillPaintProps>;
    _transitioningPaint: Transitioning<FillPaintProps>;
    paint: PossiblyEvaluated<FillPaintProps, FillPaintPropsPossiblyEvaluated>;
    constructor(layer: LayerSpecification, globalState: Record<string, any>);
    recalculate(parameters: EvaluationParameters, availableImages: Array<string>): void;
    createBucket(parameters: BucketParameters<any>): FillBucket;
    queryRadius(): number;
    queryIntersectsFeature({ queryGeometry, geometry, transform, pixelsToTileUnits }: QueryIntersectsFeatureParams): boolean;
    isTileClipped(): boolean;
}
//# sourceMappingURL=fill_style_layer.d.ts.map