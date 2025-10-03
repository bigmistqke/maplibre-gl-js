import { registerLayerType } from '../../style/layer_type_registry';
import { FillExtrusionStyleLayer } from '../../style/style_layer/fill_extrusion_style_layer';
registerLayerType('fill-extrusion', (layer, globalState) => new FillExtrusionStyleLayer(layer, globalState));
//# sourceMappingURL=fill-extrusion.js.map