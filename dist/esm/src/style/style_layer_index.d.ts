import type { StyleLayer } from './style_layer';
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
export type LayerConfigs = {
    [_: string]: LayerSpecification;
};
export declare class StyleLayerIndex {
    familiesBySource: {
        [source: string]: {
            [sourceLayer: string]: Array<Array<StyleLayer>>;
        };
    };
    keyCache: {
        [source: string]: string;
    };
    _layerConfigs: LayerConfigs;
    _layers: {
        [_: string]: StyleLayer;
    };
    constructor(layerConfigs?: Array<LayerSpecification> | null, globalState?: Record<string, any>);
    replace(layerConfigs: Array<LayerSpecification>, globalState?: Record<string, any>): void;
    update(layerConfigs: Array<LayerSpecification>, removedIds: Array<string>, globalState?: Record<string, any>): void;
}
//# sourceMappingURL=style_layer_index.d.ts.map