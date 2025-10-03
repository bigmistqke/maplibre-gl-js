import { StyleLayer } from '../style_layer';
import properties from './color_relief_style_layer_properties.g';
import { Color, Interpolate, ZoomConstantExpression } from '@maplibre/maplibre-gl-style-spec';
import { warnOnce } from '../../util/util';
import { Texture } from '../../render/texture';
import { RGBAImage } from '../../util/image';
import { packDEMData } from '../../data/dem_data';
export const isColorReliefStyleLayer = (layer) => layer.type === 'color-relief';
export class ColorReliefStyleLayer extends StyleLayer {
    constructor(layer, globalState) {
        super(layer, properties, globalState);
    }
    _createColorRamp(maxLength) {
        const colorRamp = { elevationStops: [], colorStops: [] };
        const expression = this._transitionablePaint._values['color-relief-color'].value.expression;
        if (expression instanceof ZoomConstantExpression && expression._styleExpression.expression instanceof Interpolate) {
            this.colorRampExpression = expression;
            const interpolater = expression._styleExpression.expression;
            colorRamp.elevationStops = interpolater.labels;
            colorRamp.colorStops = [];
            for (const label of colorRamp.elevationStops) {
                colorRamp.colorStops.push(interpolater.evaluate({ globals: { elevation: label } }));
            }
        }
        if (colorRamp.elevationStops.length < 1) {
            colorRamp.elevationStops = [0];
            colorRamp.colorStops = [Color.transparent];
        }
        if (colorRamp.elevationStops.length < 2) {
            colorRamp.elevationStops.push(colorRamp.elevationStops[0] + 1);
            colorRamp.colorStops.push(colorRamp.colorStops[0]);
        }
        if (colorRamp.elevationStops.length <= maxLength) {
            return colorRamp;
        }
        const remappedColorRamp = { elevationStops: [], colorStops: [] };
        const remapStepSize = (colorRamp.elevationStops.length - 1) / (maxLength - 1);
        for (let i = 0; i < colorRamp.elevationStops.length - 0.5; i += remapStepSize) {
            remappedColorRamp.elevationStops.push(colorRamp.elevationStops[Math.round(i)]);
            remappedColorRamp.colorStops.push(colorRamp.colorStops[Math.round(i)]);
        }
        warnOnce(`Too many colors in specification of ${this.id} color-relief layer, may not render properly.`);
        return remappedColorRamp;
    }
    _colorRampChanged() {
        return this.colorRampExpression != this._transitionablePaint._values['color-relief-color'].value.expression;
    }
    getColorRampTextures(context, maxLength, unpackVector) {
        if (this.colorRampTextures && !this._colorRampChanged()) {
            return this.colorRampTextures;
        }
        const colorRamp = this._createColorRamp(maxLength);
        const colorImage = new RGBAImage({ width: colorRamp.colorStops.length, height: 1 });
        const elevationImage = new RGBAImage({ width: colorRamp.colorStops.length, height: 1 });
        for (let i = 0; i < colorRamp.elevationStops.length; i++) {
            const elevationPacked = packDEMData(colorRamp.elevationStops[i], unpackVector);
            elevationImage.setPixel(0, i, new Color(elevationPacked.r / 255, elevationPacked.g / 255, elevationPacked.b / 255, 1));
            colorImage.setPixel(0, i, colorRamp.colorStops[i]);
        }
        this.colorRampTextures = {
            elevationTexture: new Texture(context, elevationImage, context.gl.RGBA),
            colorTexture: new Texture(context, colorImage, context.gl.RGBA)
        };
        return this.colorRampTextures;
    }
    hasOffscreenPass() {
        return this.visibility !== 'none' && !!this.colorRampTextures;
    }
}
//# sourceMappingURL=color_relief_style_layer.js.map