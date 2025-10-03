import { StyleLayer } from '../style_layer';
import properties from './hillshade_style_layer_properties.g';
import { degreesToRadians } from '../../util/util';
export const isHillshadeStyleLayer = (layer) => layer.type === 'hillshade';
export class HillshadeStyleLayer extends StyleLayer {
    constructor(layer, globalState) {
        super(layer, properties, globalState);
        this.recalculate({ zoom: 0, zoomHistory: {} }, undefined);
    }
    getIlluminationProperties() {
        let direction = this.paint.get('hillshade-illumination-direction').values;
        let altitude = this.paint.get('hillshade-illumination-altitude').values;
        let highlightColor = this.paint.get('hillshade-highlight-color').values;
        let shadowColor = this.paint.get('hillshade-shadow-color').values;
        const numIlluminationSources = Math.max(direction.length, altitude.length, highlightColor.length, shadowColor.length);
        direction = direction.concat(Array(numIlluminationSources - direction.length).fill(direction.at(-1)));
        altitude = altitude.concat(Array(numIlluminationSources - altitude.length).fill(altitude.at(-1)));
        highlightColor = highlightColor.concat(Array(numIlluminationSources - highlightColor.length).fill(highlightColor.at(-1)));
        shadowColor = shadowColor.concat(Array(numIlluminationSources - shadowColor.length).fill(shadowColor.at(-1)));
        const altitudeRadians = altitude.map(degreesToRadians);
        const directionRadians = direction.map(degreesToRadians);
        return { directionRadians, altitudeRadians, shadowColor, highlightColor };
    }
    hasOffscreenPass() {
        return this.paint.get('hillshade-exaggeration') !== 0 && this.visibility !== 'none';
    }
}
//# sourceMappingURL=hillshade_style_layer.js.map