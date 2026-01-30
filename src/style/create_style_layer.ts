import { getFromHarvestRegistry } from "../registry";
import type {CircleStyleLayer} from './style_layer/circle_style_layer';
import type {HeatmapStyleLayer} from './style_layer/heatmap_style_layer';
import type {HillshadeStyleLayer} from './style_layer/hillshade_style_layer';
import type {ColorReliefStyleLayer} from './style_layer/color_relief_style_layer';
import type {FillStyleLayer} from './style_layer/fill_style_layer';
import type {FillExtrusionStyleLayer} from './style_layer/fill_extrusion_style_layer';
import type {LineStyleLayer} from './style_layer/line_style_layer';
import type {SymbolStyleLayer} from './style_layer/symbol_style_layer';
import type {BackgroundStyleLayer} from './style_layer/background_style_layer';
import type {RasterStyleLayer} from './style_layer/raster_style_layer';
import {CustomStyleLayer, type CustomLayerInterface} from './style_layer/custom_style_layer';

import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';

export function createStyleLayer(layer: LayerSpecification | CustomLayerInterface, globalState: Record<string, any>) {
    if (layer.type === 'custom') {
        return new CustomStyleLayer(layer, globalState);
    }
    switch (layer.type) {
        case 'background':
            return new (getFromHarvestRegistry('./style/style_layer/background_style_layer#BackgroundStyleLayer'))(layer, globalState);
        case 'circle':
            return new (getFromHarvestRegistry('./style/style_layer/circle_style_layer#CircleStyleLayer'))(layer, globalState);
        case 'color-relief':
            return new (getFromHarvestRegistry('./style/style_layer/color_relief_style_layer#ColorReliefStyleLayer'))(layer, globalState);
        case 'fill':
            return new (getFromHarvestRegistry('./style/style_layer/fill_style_layer#FillStyleLayer'))(layer, globalState);
        case 'fill-extrusion':
            return new (getFromHarvestRegistry('./style/style_layer/fill_extrusion_style_layer#FillExtrusionStyleLayer'))(layer, globalState);
        case 'heatmap':
            return new (getFromHarvestRegistry('./style/style_layer/heatmap_style_layer#HeatmapStyleLayer'))(layer, globalState);
        case 'hillshade':
            return new (getFromHarvestRegistry('./style/style_layer/hillshade_style_layer#HillshadeStyleLayer'))(layer, globalState);
        case 'line':
            return new (getFromHarvestRegistry('./style/style_layer/line_style_layer#LineStyleLayer'))(layer, globalState);
        case 'raster':
            return new (getFromHarvestRegistry('./style/style_layer/raster_style_layer#RasterStyleLayer'))(layer, globalState);
        case 'symbol':
            return new (getFromHarvestRegistry('./style/style_layer/symbol_style_layer#SymbolStyleLayer'))(layer, globalState);
    }
}

