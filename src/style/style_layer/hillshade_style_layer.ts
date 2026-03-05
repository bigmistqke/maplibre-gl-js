import {StyleLayer} from '../style_layer';

import properties, {type HillshadePaintPropsPossiblyEvaluated} from './hillshade_style_layer_properties.g';
import {type Transitionable, type Transitioning, type PossiblyEvaluated} from '../properties';

import type {HillshadePaintProps} from './hillshade_style_layer_properties.g';
import type {Color, LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {degreesToRadians, assertedNotNullish} from '../../util/util';
import type {EvaluationParameters} from '../evaluation_parameters';

export const isHillshadeStyleLayer = (layer: StyleLayer): layer is HillshadeStyleLayer => layer.type === 'hillshade';

export class HillshadeStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<HillshadePaintProps> | undefined;
    _transitioningPaint: Transitioning<HillshadePaintProps> | undefined;
    paint: PossiblyEvaluated<HillshadePaintProps, HillshadePaintPropsPossiblyEvaluated> | undefined;

    constructor(layer: LayerSpecification, globalState: Record<string, any>) {
        super(layer, properties, globalState);
        this.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, []);
    }

    getIlluminationProperties(): {directionRadians: number[]; altitudeRadians: number[]; shadowColor: Color[]; highlightColor: Color[]} {
        let direction = assertedNotNullish(this.paint).get('hillshade-illumination-direction').values;
        let altitude = assertedNotNullish(this.paint).get('hillshade-illumination-altitude').values;
        let highlightColor = assertedNotNullish(this.paint).get('hillshade-highlight-color').values;
        let shadowColor = assertedNotNullish(this.paint).get('hillshade-shadow-color').values;

        // ensure all illumination properties have the same length
        const numIlluminationSources = Math.max(direction.length, altitude.length, highlightColor.length, shadowColor.length);
        direction = direction.concat(Array(numIlluminationSources - direction.length).fill(direction.at(-1)));
        altitude = altitude.concat(Array(numIlluminationSources - altitude.length).fill(altitude.at(-1)));
        highlightColor = highlightColor.concat(Array(numIlluminationSources - highlightColor.length).fill(highlightColor.at(-1)));
        shadowColor = shadowColor.concat(Array(numIlluminationSources - shadowColor.length).fill(shadowColor.at(-1)));

        const altitudeRadians = altitude.map(degreesToRadians);
        const directionRadians = direction.map(degreesToRadians);

        return {directionRadians, altitudeRadians, shadowColor, highlightColor};
    }

    hasOffscreenPass() {
        return assertedNotNullish(this.paint).get('hillshade-exaggeration') !== 0 && !this.isHidden();
    }
}
