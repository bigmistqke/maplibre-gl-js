import { Color } from '@maplibre/maplibre-gl-style-spec';
import type { BlendFuncType, ColorMaskType } from './types';
export declare class ColorMode {
    blendFunction: BlendFuncType;
    blendColor: Color;
    mask: ColorMaskType;
    constructor(blendFunction: BlendFuncType, blendColor: Color, mask: ColorMaskType);
    static Replace: BlendFuncType;
    static disabled: Readonly<ColorMode>;
    static unblended: Readonly<ColorMode>;
    static alphaBlended: Readonly<ColorMode>;
}
//# sourceMappingURL=color_mode.d.ts.map