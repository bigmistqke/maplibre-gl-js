/**
 * Registers all core layer types (excluding symbol)
 * Symbol layers are registered separately in layers/symbol.ts for tree-shaking
 */
import {registerLayerType} from './layer_type_registry';

import {BackgroundStyleLayer} from './style_layer/background_style_layer';
import {CircleStyleLayer} from './style_layer/circle_style_layer';
import {FillStyleLayer} from './style_layer/fill_style_layer';
import {FillExtrusionStyleLayer} from './style_layer/fill_extrusion_style_layer';
import {HeatmapStyleLayer} from './style_layer/heatmap_style_layer';
import {HillshadeStyleLayer} from './style_layer/hillshade_style_layer';
import {ColorReliefStyleLayer} from './style_layer/color_relief_style_layer';
import {LineStyleLayer} from './style_layer/line_style_layer';
import {RasterStyleLayer} from './style_layer/raster_style_layer';

registerLayerType('background', (layer, globalState) => new BackgroundStyleLayer(layer, globalState));
registerLayerType('circle', (layer, globalState) => new CircleStyleLayer(layer, globalState));
registerLayerType('fill', (layer, globalState) => new FillStyleLayer(layer, globalState));
registerLayerType('fill-extrusion', (layer, globalState) => new FillExtrusionStyleLayer(layer, globalState));
registerLayerType('heatmap', (layer, globalState) => new HeatmapStyleLayer(layer, globalState));
registerLayerType('hillshade', (layer, globalState) => new HillshadeStyleLayer(layer, globalState));
registerLayerType('color-relief', (layer, globalState) => new ColorReliefStyleLayer(layer, globalState));
registerLayerType('line', (layer, globalState) => new LineStyleLayer(layer, globalState));
registerLayerType('raster', (layer, globalState) => new RasterStyleLayer(layer, globalState));
