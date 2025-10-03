import {registerLayerType} from '../../style/layer_type_registry';
import {BackgroundStyleLayer} from '../../style/style_layer/background_style_layer';

registerLayerType('background', (layer, globalState) => new BackgroundStyleLayer(layer, globalState));
