import { Properties, DataConstantProperty, ColorRampProperty } from '../properties';
export type ColorReliefPaintProps = {
    "color-relief-opacity": DataConstantProperty<number>;
    "color-relief-color": ColorRampProperty;
};
export type ColorReliefPaintPropsPossiblyEvaluated = {
    "color-relief-opacity": number;
    "color-relief-color": ColorRampProperty;
};
declare const _default: {
    readonly paint: Properties<ColorReliefPaintProps>;
};
export default _default;
//# sourceMappingURL=color_relief_style_layer_properties.g.d.ts.map