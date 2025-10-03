import {CustomStyleLayer, type CustomLayerInterface} from './style_layer/custom_style_layer';
import {getLayerFactory} from './layer_type_registry';
import {warnOnce} from '../util/util';

import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';

export function createStyleLayer(layer: LayerSpecification | CustomLayerInterface, globalState: Record<string, any>) {
    if (layer.type === 'custom') {
        return new CustomStyleLayer(layer, globalState);
    }

    // Try to get factory from registry
    const factory = getLayerFactory(layer.type);
    if (factory) {
        return factory(layer as LayerSpecification, globalState);
    }

    // Warn if layer type not registered
    warnOnce(`Layer type '${layer.type}' is not registered. Import the corresponding layer module to enable it.`);
    return null;
}

