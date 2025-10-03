import { StyleLayer } from '../style_layer';
import properties from './raster_style_layer_properties.g';
export const isRasterStyleLayer = (layer) => layer.type === 'raster';
export class RasterStyleLayer extends StyleLayer {
    constructor(layer, globalState) {
        super(layer, properties, globalState);
    }
}
//# sourceMappingURL=raster_style_layer.js.map