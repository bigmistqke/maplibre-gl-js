import {createStyleLayer} from './create_style_layer';
import {featureFilter, groupByLayout} from '@maplibre/maplibre-gl-style-spec';
import type {StyleLayer} from './style_layer';

import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import { assertedNotNullish } from "../util/util";

export type LayerConfigs = {[_: string]: LayerSpecification};

export class StyleLayerIndex {
    familiesBySource: {
        [source: string]: {
            [sourceLayer: string]: Array<Array<StyleLayer>>;
        };
    } | undefined;
    keyCache: {[source: string]: string};

    _layerConfigs: LayerConfigs | undefined;
    _layers: {[_: string]: StyleLayer} | undefined;

    constructor(layerConfigs?: Array<LayerSpecification> | null, globalState?: Record<string, any>) {
        this.keyCache = {};
        if (layerConfigs) {
            this.replace(layerConfigs, globalState);
        }
    }

    replace(layerConfigs: Array<LayerSpecification>, globalState?: Record<string, any>) {
        this._layerConfigs = {};
        this._layers = {};
        this.update(layerConfigs, [], globalState);
    }

    update(layerConfigs: Array<LayerSpecification>, removedIds: Array<string>, globalState?: Record<string, any>) {
        for (const layerConfig of layerConfigs) {
            assertedNotNullish(this._layerConfigs)[layerConfig.id] = layerConfig;

            const layer = assertedNotNullish(this._layers)[layerConfig.id] = createStyleLayer(layerConfig, assertedNotNullish(globalState));
            layer._featureFilter = featureFilter(layer.filter, globalState);
            if (this.keyCache[layerConfig.id])
                delete this.keyCache[layerConfig.id];
        }
        for (const id of removedIds) {
            delete this.keyCache[id];
            delete assertedNotNullish(this._layerConfigs)[id];
            delete assertedNotNullish(this._layers)[id];
        }

        this.familiesBySource = {};

        const groups = groupByLayout(Object.values(assertedNotNullish(this._layerConfigs)), this.keyCache);

        for (const layerConfigs of groups) {
            const layers = layerConfigs.map((layerConfig) => assertedNotNullish(this._layers)[layerConfig.id]);

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
