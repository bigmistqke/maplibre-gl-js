import { latest as styleSpec } from '@maplibre/maplibre-gl-style-spec';
import { Properties, DataConstantProperty, DataDrivenProperty, CrossFadedDataDrivenProperty, ColorRampProperty } from '../properties';
let layout;
const getLayout = () => layout = layout || new Properties({
    "line-cap": new DataConstantProperty(styleSpec["layout_line"]["line-cap"]),
    "line-join": new DataDrivenProperty(styleSpec["layout_line"]["line-join"]),
    "line-miter-limit": new DataConstantProperty(styleSpec["layout_line"]["line-miter-limit"]),
    "line-round-limit": new DataConstantProperty(styleSpec["layout_line"]["line-round-limit"]),
    "line-sort-key": new DataDrivenProperty(styleSpec["layout_line"]["line-sort-key"]),
});
let paint;
const getPaint = () => paint = paint || new Properties({
    "line-opacity": new DataDrivenProperty(styleSpec["paint_line"]["line-opacity"]),
    "line-color": new DataDrivenProperty(styleSpec["paint_line"]["line-color"]),
    "line-translate": new DataConstantProperty(styleSpec["paint_line"]["line-translate"]),
    "line-translate-anchor": new DataConstantProperty(styleSpec["paint_line"]["line-translate-anchor"]),
    "line-width": new DataDrivenProperty(styleSpec["paint_line"]["line-width"]),
    "line-gap-width": new DataDrivenProperty(styleSpec["paint_line"]["line-gap-width"]),
    "line-offset": new DataDrivenProperty(styleSpec["paint_line"]["line-offset"]),
    "line-blur": new DataDrivenProperty(styleSpec["paint_line"]["line-blur"]),
    "line-dasharray": new CrossFadedDataDrivenProperty(styleSpec["paint_line"]["line-dasharray"]),
    "line-pattern": new CrossFadedDataDrivenProperty(styleSpec["paint_line"]["line-pattern"]),
    "line-gradient": new ColorRampProperty(styleSpec["paint_line"]["line-gradient"]),
});
export default ({ get paint() { return getPaint(); }, get layout() { return getLayout(); } });
//# sourceMappingURL=line_style_layer_properties.g.js.map