import { UniformColor, Uniform1i, Uniform1f } from '../uniform_binding';
import type { Context } from '../../gl/context';
import type { UniformValues, UniformLocations } from '../uniform_binding';
import type { Color } from '@maplibre/maplibre-gl-style-spec';
export type DebugUniformsType = {
    'u_color': UniformColor;
    'u_overlay': Uniform1i;
    'u_overlay_scale': Uniform1f;
};
declare const debugUniforms: (context: Context, locations: UniformLocations) => DebugUniformsType;
declare const debugUniformValues: (color: Color, scaleRatio?: number) => UniformValues<DebugUniformsType>;
export { debugUniforms, debugUniformValues };
//# sourceMappingURL=debug_program.d.ts.map