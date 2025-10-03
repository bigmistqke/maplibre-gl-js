import {registerLayerType} from '../../style/layer_type_registry';
import {CircleStyleLayer} from '../../style/style_layer/circle_style_layer';

registerLayerType('circle', (layer, globalState) => new CircleStyleLayer(layer, globalState));
