import { latest as styleSpec } from '@maplibre/maplibre-gl-style-spec';
import { Properties, DataConstantProperty, DataDrivenProperty, CrossFadedDataDrivenProperty } from '../properties';
let layout;
const getLayout = () => layout = layout || new Properties({
    "fill-sort-key": new DataDrivenProperty(styleSpec["layout_fill"]["fill-sort-key"]),
});
let paint;
const getPaint = () => paint = paint || new Properties({
    "fill-antialias": new DataConstantProperty(styleSpec["paint_fill"]["fill-antialias"]),
    "fill-opacity": new DataDrivenProperty(styleSpec["paint_fill"]["fill-opacity"]),
    "fill-color": new DataDrivenProperty(styleSpec["paint_fill"]["fill-color"]),
    "fill-outline-color": new DataDrivenProperty(styleSpec["paint_fill"]["fill-outline-color"]),
    "fill-translate": new DataConstantProperty(styleSpec["paint_fill"]["fill-translate"]),
    "fill-translate-anchor": new DataConstantProperty(styleSpec["paint_fill"]["fill-translate-anchor"]),
    "fill-pattern": new CrossFadedDataDrivenProperty(styleSpec["paint_fill"]["fill-pattern"]),
});
export default ({ get paint() { return getPaint(); }, get layout() { return getLayout(); } });
//# sourceMappingURL=fill_style_layer_properties.g.js.map