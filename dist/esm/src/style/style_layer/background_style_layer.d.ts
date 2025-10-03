import { StyleLayer } from '../style_layer';
import { type BackgroundPaintPropsPossiblyEvaluated } from './background_style_layer_properties.g';
import { type Transitionable, type Transitioning, type PossiblyEvaluated } from '../properties';
import type { BackgroundPaintProps } from './background_style_layer_properties.g';
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
export declare const isBackgroundStyleLayer: (layer: StyleLayer) => layer is BackgroundStyleLayer;
export declare class BackgroundStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<BackgroundPaintProps>;
    _transitioningPaint: Transitioning<BackgroundPaintProps>;
    paint: PossiblyEvaluated<BackgroundPaintProps, BackgroundPaintPropsPossiblyEvaluated>;
    constructor(layer: LayerSpecification, globalState: Record<string, any>);
}
//# sourceMappingURL=background_style_layer.d.ts.map