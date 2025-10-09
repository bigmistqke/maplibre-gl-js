import { CustomStyleLayer } from './style_layer/custom_style_layer';
import { registry } from '../registry';
import { warnOnce } from '../util/util';
export function createStyleLayer(layer, globalState) {
    if (layer.type === 'custom') {
        return new CustomStyleLayer(layer, globalState);
    }
    const LayerClass = registry.layer[layer.type];
    if (LayerClass) {
        return new LayerClass(layer, globalState);
    }
    warnOnce(`Layer type '${layer.type}' is not registered. Import the corresponding layer module to enable it.`);
    return null;
}
//# sourceMappingURL=create_style_layer.js.map