import { latest as styleSpec } from '@maplibre/maplibre-gl-style-spec';
import { Properties, DataConstantProperty, CrossFadedProperty } from '../properties';
let paint;
const getPaint = () => paint = paint || new Properties({
    "background-color": new DataConstantProperty(styleSpec["paint_background"]["background-color"]),
    "background-pattern": new CrossFadedProperty(styleSpec["paint_background"]["background-pattern"]),
    "background-opacity": new DataConstantProperty(styleSpec["paint_background"]["background-opacity"]),
});
export default ({ get paint() { return getPaint(); } });
//# sourceMappingURL=background_style_layer_properties.g.js.map