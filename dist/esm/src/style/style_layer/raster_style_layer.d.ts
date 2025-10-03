import { StyleLayer } from '../style_layer';
import { type RasterPaintPropsPossiblyEvaluated } from './raster_style_layer_properties.g';
import { type Transitionable, type Transitioning, type PossiblyEvaluated } from '../properties';
import type { RasterPaintProps } from './raster_style_layer_properties.g';
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
export declare const isRasterStyleLayer: (layer: StyleLayer) => layer is RasterStyleLayer;
export declare class RasterStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<RasterPaintProps>;
    _transitioningPaint: Transitioning<RasterPaintProps>;
    paint: PossiblyEvaluated<RasterPaintProps, RasterPaintPropsPossiblyEvaluated>;
    constructor(layer: LayerSpecification, globalState: Record<string, any>);
}
//# sourceMappingURL=raster_style_layer.d.ts.map