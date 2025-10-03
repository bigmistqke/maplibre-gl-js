import { StyleLayer } from '../style_layer';
import { type HillshadePaintPropsPossiblyEvaluated } from './hillshade_style_layer_properties.g';
import { type Transitionable, type Transitioning, type PossiblyEvaluated } from '../properties';
import type { HillshadePaintProps } from './hillshade_style_layer_properties.g';
import type { Color, LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
export declare const isHillshadeStyleLayer: (layer: StyleLayer) => layer is HillshadeStyleLayer;
export declare class HillshadeStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<HillshadePaintProps>;
    _transitioningPaint: Transitioning<HillshadePaintProps>;
    paint: PossiblyEvaluated<HillshadePaintProps, HillshadePaintPropsPossiblyEvaluated>;
    constructor(layer: LayerSpecification, globalState: Record<string, any>);
    getIlluminationProperties(): {
        directionRadians: number[];
        altitudeRadians: number[];
        shadowColor: Color[];
        highlightColor: Color[];
    };
    hasOffscreenPass(): boolean;
}
//# sourceMappingURL=hillshade_style_layer.d.ts.map