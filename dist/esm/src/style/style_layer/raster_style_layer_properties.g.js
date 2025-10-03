import { latest as styleSpec } from '@maplibre/maplibre-gl-style-spec';
import { Properties, DataConstantProperty } from '../properties';
let paint;
const getPaint = () => paint = paint || new Properties({
    "raster-opacity": new DataConstantProperty(styleSpec["paint_raster"]["raster-opacity"]),
    "raster-hue-rotate": new DataConstantProperty(styleSpec["paint_raster"]["raster-hue-rotate"]),
    "raster-brightness-min": new DataConstantProperty(styleSpec["paint_raster"]["raster-brightness-min"]),
    "raster-brightness-max": new DataConstantProperty(styleSpec["paint_raster"]["raster-brightness-max"]),
    "raster-saturation": new DataConstantProperty(styleSpec["paint_raster"]["raster-saturation"]),
    "raster-contrast": new DataConstantProperty(styleSpec["paint_raster"]["raster-contrast"]),
    "raster-resampling": new DataConstantProperty(styleSpec["paint_raster"]["raster-resampling"]),
    "raster-fade-duration": new DataConstantProperty(styleSpec["paint_raster"]["raster-fade-duration"]),
});
export default ({ get paint() { return getPaint(); } });
//# sourceMappingURL=raster_style_layer_properties.g.js.map