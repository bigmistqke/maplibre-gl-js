import {StyleLayer} from '../style_layer';
import {warnOnce} from '../../util/util';

import properties, {type RasterPaintPropsPossiblyEvaluated} from './raster_style_layer_properties.g';
import {type Transitionable, type Transitioning, type PossiblyEvaluated} from '../properties';

import type {RasterPaintProps} from './raster_style_layer_properties.g';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';

export const isRasterStyleLayer = (layer: StyleLayer): layer is RasterStyleLayer => layer.type === 'raster';

export class RasterStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<RasterPaintProps> | undefined;
    _transitioningPaint: Transitioning<RasterPaintProps> | undefined;
    paint: PossiblyEvaluated<RasterPaintProps, RasterPaintPropsPossiblyEvaluated> | undefined;

    constructor(layer: LayerSpecification, globalState: Record<string, any>) {
        const resampling = (layer.paint as Record<string, unknown>)?.['resampling'];
        if (resampling && (layer.paint as Record<string, unknown>)?.['raster-resampling']) {
            warnOnce(`Raster layer "${layer.id}" paint properties "resampling" and "raster-resampling" are both specified, but only "resampling" needs to be specified. Defaulting to "resampling" (${resampling}).`);
        }
        super(layer, properties, globalState);
    }
}
