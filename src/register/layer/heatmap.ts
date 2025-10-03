import {registerLayerType} from '../../style/layer_type_registry';
import {HeatmapStyleLayer} from '../../style/style_layer/heatmap_style_layer';

registerLayerType('heatmap', (layer, globalState) => new HeatmapStyleLayer(layer, globalState));
