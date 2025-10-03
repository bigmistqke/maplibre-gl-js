import { StyleLayer } from '../style_layer';
import { type ColorReliefPaintPropsPossiblyEvaluated } from './color_relief_style_layer_properties.g';
import { type Transitionable, type Transitioning, type PossiblyEvaluated } from '../properties';
import type { ColorReliefPaintProps } from './color_relief_style_layer_properties.g';
import { Color, type LayerSpecification, type StylePropertyExpression } from '@maplibre/maplibre-gl-style-spec';
import { Texture } from '../../render/texture';
import { type Context } from '../../gl/context';
export declare const isColorReliefStyleLayer: (layer: StyleLayer) => layer is ColorReliefStyleLayer;
export type ColorRamp = {
    elevationStops: Array<number>;
    colorStops: Array<Color>;
};
export type ColorRampTextures = {
    elevationTexture: Texture;
    colorTexture: Texture;
};
export declare class ColorReliefStyleLayer extends StyleLayer {
    colorRampExpression: StylePropertyExpression;
    colorRampTextures: ColorRampTextures;
    _transitionablePaint: Transitionable<ColorReliefPaintProps>;
    _transitioningPaint: Transitioning<ColorReliefPaintProps>;
    paint: PossiblyEvaluated<ColorReliefPaintProps, ColorReliefPaintPropsPossiblyEvaluated>;
    constructor(layer: LayerSpecification, globalState: Record<string, any>);
    _createColorRamp(maxLength: number): ColorRamp;
    _colorRampChanged(): boolean;
    getColorRampTextures(context: Context, maxLength: number, unpackVector: number[]): ColorRampTextures;
    hasOffscreenPass(): boolean;
}
//# sourceMappingURL=color_relief_style_layer.d.ts.map