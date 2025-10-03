import { latest as styleSpec } from '@maplibre/maplibre-gl-style-spec';
import { Properties, DataConstantProperty, ColorRampProperty } from '../properties';
let paint;
const getPaint = () => paint = paint || new Properties({
    "color-relief-opacity": new DataConstantProperty(styleSpec["paint_color-relief"]["color-relief-opacity"]),
    "color-relief-color": new ColorRampProperty(styleSpec["paint_color-relief"]["color-relief-color"]),
});
export default ({ get paint() { return getPaint(); } });
//# sourceMappingURL=color_relief_style_layer_properties.g.js.map