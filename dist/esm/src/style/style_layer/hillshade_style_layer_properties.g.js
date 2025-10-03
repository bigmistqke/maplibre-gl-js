import { latest as styleSpec } from '@maplibre/maplibre-gl-style-spec';
import { Properties, DataConstantProperty } from '../properties';
let paint;
const getPaint = () => paint = paint || new Properties({
    "hillshade-illumination-direction": new DataConstantProperty(styleSpec["paint_hillshade"]["hillshade-illumination-direction"]),
    "hillshade-illumination-altitude": new DataConstantProperty(styleSpec["paint_hillshade"]["hillshade-illumination-altitude"]),
    "hillshade-illumination-anchor": new DataConstantProperty(styleSpec["paint_hillshade"]["hillshade-illumination-anchor"]),
    "hillshade-exaggeration": new DataConstantProperty(styleSpec["paint_hillshade"]["hillshade-exaggeration"]),
    "hillshade-shadow-color": new DataConstantProperty(styleSpec["paint_hillshade"]["hillshade-shadow-color"]),
    "hillshade-highlight-color": new DataConstantProperty(styleSpec["paint_hillshade"]["hillshade-highlight-color"]),
    "hillshade-accent-color": new DataConstantProperty(styleSpec["paint_hillshade"]["hillshade-accent-color"]),
    "hillshade-method": new DataConstantProperty(styleSpec["paint_hillshade"]["hillshade-method"]),
});
export default ({ get paint() { return getPaint(); } });
//# sourceMappingURL=hillshade_style_layer_properties.g.js.map