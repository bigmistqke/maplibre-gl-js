import { createStyleLayer } from './create_style_layer';
import { featureFilter, groupByLayout } from '@maplibre/maplibre-gl-style-spec';
export class StyleLayerIndex {
    constructor(layerConfigs, globalState) {
        this.keyCache = {};
        if (layerConfigs) {
            this.replace(layerConfigs, globalState);
        }
    }
    replace(layerConfigs, globalState) {
        this._layerConfigs = {};
        this._layers = {};
        this.update(layerConfigs, [], globalState);
    }
    update(layerConfigs, removedIds, globalState) {
        for (const layerConfig of layerConfigs) {
            this._layerConfigs[layerConfig.id] = layerConfig;
            const layer = this._layers[layerConfig.id] = createStyleLayer(layerConfig, globalState);
            layer._featureFilter = featureFilter(layer.filter, globalState);
            if (this.keyCache[layerConfig.id])
                delete this.keyCache[layerConfig.id];
        }
        for (const id of removedIds) {
            delete this.keyCache[id];
            delete this._layerConfigs[id];
            delete this._layers[id];
        }
        this.familiesBySource = {};
        const groups = groupByLayout(Object.values(this._layerConfigs), this.keyCache);
        for (const layerConfigs of groups) {
            const layers = layerConfigs.map((layerConfig) => this._layers[layerConfig.id]);
            const layer = layers[0];
            if (layer.visibility === 'none') {
                continue;
            }
            const sourceId = layer.source || '';
            let sourceGroup = this.familiesBySource[sourceId];
            if (!sourceGroup) {
                sourceGroup = this.familiesBySource[sourceId] = {};
            }
            const sourceLayerId = layer.sourceLayer || '_geojsonTileLayer';
            let sourceLayerFamilies = sourceGroup[sourceLayerId];
            if (!sourceLayerFamilies) {
                sourceLayerFamilies = sourceGroup[sourceLayerId] = [];
            }
            sourceLayerFamilies.push(layers);
        }
    }
}
//# sourceMappingURL=style_layer_index.js.map