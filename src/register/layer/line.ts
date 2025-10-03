import {registerLayerType} from '../../style/layer_type_registry';
import {LineStyleLayer} from '../../style/style_layer/line_style_layer';

registerLayerType('line', (layer, globalState) => new LineStyleLayer(layer, globalState));
