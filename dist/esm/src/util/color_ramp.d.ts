import { RGBAImage } from './image';
import type { StylePropertyExpression } from '@maplibre/maplibre-gl-style-spec';
export type ColorRampParams = {
    expression: StylePropertyExpression;
    evaluationKey: string;
    resolution?: number;
    image?: RGBAImage;
    clips?: Array<any>;
};
export declare function renderColorRamp(params: ColorRampParams): RGBAImage;
//# sourceMappingURL=color_ramp.d.ts.map