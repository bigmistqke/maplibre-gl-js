import { Properties, DataConstantProperty } from '../properties';
import type { Color, NumberArray, ColorArray } from '@maplibre/maplibre-gl-style-spec';
export type HillshadePaintProps = {
    "hillshade-illumination-direction": DataConstantProperty<NumberArray>;
    "hillshade-illumination-altitude": DataConstantProperty<NumberArray>;
    "hillshade-illumination-anchor": DataConstantProperty<"map" | "viewport">;
    "hillshade-exaggeration": DataConstantProperty<number>;
    "hillshade-shadow-color": DataConstantProperty<ColorArray>;
    "hillshade-highlight-color": DataConstantProperty<ColorArray>;
    "hillshade-accent-color": DataConstantProperty<Color>;
    "hillshade-method": DataConstantProperty<"standard" | "basic" | "combined" | "igor" | "multidirectional">;
};
export type HillshadePaintPropsPossiblyEvaluated = {
    "hillshade-illumination-direction": NumberArray;
    "hillshade-illumination-altitude": NumberArray;
    "hillshade-illumination-anchor": "map" | "viewport";
    "hillshade-exaggeration": number;
    "hillshade-shadow-color": ColorArray;
    "hillshade-highlight-color": ColorArray;
    "hillshade-accent-color": Color;
    "hillshade-method": "standard" | "basic" | "combined" | "igor" | "multidirectional";
};
declare const _default: {
    readonly paint: Properties<HillshadePaintProps>;
};
export default _default;
//# sourceMappingURL=hillshade_style_layer_properties.g.d.ts.map