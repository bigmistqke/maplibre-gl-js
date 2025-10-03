import { StyleLayer } from '../style_layer';
import properties from './background_style_layer_properties.g';
export const isBackgroundStyleLayer = (layer) => layer.type === 'background';
export class BackgroundStyleLayer extends StyleLayer {
    constructor(layer, globalState) {
        super(layer, properties, globalState);
    }
}
//# sourceMappingURL=background_style_layer.js.map