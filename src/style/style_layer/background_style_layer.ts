import {StyleLayer} from '../style_layer';

import properties, {type BackgroundPaintPropsPossiblyEvaluated} from './background_style_layer_properties.g';
import {type Transitionable, type Transitioning, PossiblyEvaluated} from '../properties';

import type {BackgroundPaintProps} from './background_style_layer_properties.g';
import type {BackgroundLayerSpecification} from '@maplibre/maplibre-gl-style-spec';

export const isBackgroundStyleLayer = (layer: StyleLayer): layer is BackgroundStyleLayer => layer.type === 'background';
export class BackgroundStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<BackgroundPaintProps> | undefined;
    _transitioningPaint: Transitioning<BackgroundPaintProps> | undefined;
    paint: PossiblyEvaluated<BackgroundPaintProps, BackgroundPaintPropsPossiblyEvaluated>;

    constructor(layer: BackgroundLayerSpecification, globalState: Record<string, any>) {
        super(layer, properties, globalState);
        this.paint = new PossiblyEvaluated<BackgroundPaintProps, BackgroundPaintPropsPossiblyEvaluated>(properties.paint);
    }
}
