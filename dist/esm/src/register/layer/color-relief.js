import { registerLayerType } from '../../style/layer_type_registry';
import { ColorReliefStyleLayer } from '../../style/style_layer/color_relief_style_layer';
registerLayerType('color-relief', (layer, globalState) => new ColorReliefStyleLayer(layer, globalState));
//# sourceMappingURL=color-relief.js.map