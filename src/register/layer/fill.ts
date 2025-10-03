import {registerLayerType} from '../../style/layer_type_registry';
import {FillStyleLayer} from '../../style/style_layer/fill_style_layer';

registerLayerType('fill', (layer, globalState) => new FillStyleLayer(layer, globalState));
