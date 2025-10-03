import { Color } from '@maplibre/maplibre-gl-style-spec';
const ZERO = 0x0000;
const ONE = 0x0001;
const ONE_MINUS_SRC_ALPHA = 0x0303;
export class ColorMode {
    constructor(blendFunction, blendColor, mask) {
        this.blendFunction = blendFunction;
        this.blendColor = blendColor;
        this.mask = mask;
    }
}
ColorMode.Replace = [ONE, ZERO];
ColorMode.disabled = new ColorMode(ColorMode.Replace, Color.transparent, [false, false, false, false]);
ColorMode.unblended = new ColorMode(ColorMode.Replace, Color.transparent, [true, true, true, true]);
ColorMode.alphaBlended = new ColorMode([ONE, ONE_MINUS_SRC_ALPHA], Color.transparent, [true, true, true, true]);
//# sourceMappingURL=color_mode.js.map