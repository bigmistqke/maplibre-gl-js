import { registerLayerType } from '../../style/layer_type_registry';
import { RasterStyleLayer } from '../../style/style_layer/raster_style_layer';
registerLayerType('raster', (layer, globalState) => new RasterStyleLayer(layer, globalState));
//# sourceMappingURL=raster.js.map