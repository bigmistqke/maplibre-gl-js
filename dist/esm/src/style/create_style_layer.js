import { CustomStyleLayer } from './style_layer/custom_style_layer';
import { getLayerFactory } from './layer_type_registry';
import { warnOnce } from '../util/util';
export function createStyleLayer(layer, globalState) {
    if (layer.type === 'custom') {
        return new CustomStyleLayer(layer, globalState);
    }
    const factory = getLayerFactory(layer.type);
    if (factory) {
        return factory(layer, globalState);
    }
    warnOnce(`Layer type '${layer.type}' is not registered. Import the corresponding layer module to enable it.`);
    return null;
}
//# sourceMappingURL=create_style_layer.js.map