import { registerLayerType } from '../../style/layer_type_registry';
import { HillshadeStyleLayer } from '../../style/style_layer/hillshade_style_layer';
registerLayerType('hillshade', (layer, globalState) => new HillshadeStyleLayer(layer, globalState));
//# sourceMappingURL=hillshade.js.map