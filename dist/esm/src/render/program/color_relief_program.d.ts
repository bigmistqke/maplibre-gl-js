import { Uniform1i, Uniform1f, Uniform2f, Uniform4f } from '../uniform_binding';
import type { Context } from '../../gl/context';
import type { UniformValues, UniformLocations } from '../uniform_binding';
import type { ColorReliefStyleLayer } from '../../style/style_layer/color_relief_style_layer';
import type { DEMData } from '../../data/dem_data';
export type ColorReliefUniformsType = {
    'u_image': Uniform1i;
    'u_unpack': Uniform4f;
    'u_dimension': Uniform2f;
    'u_elevation_stops': Uniform1i;
    'u_color_stops': Uniform1i;
    'u_color_ramp_size': Uniform1i;
    'u_opacity': Uniform1f;
};
declare const colorReliefUniforms: (context: Context, locations: UniformLocations) => ColorReliefUniformsType;
declare const colorReliefUniformValues: (layer: ColorReliefStyleLayer, dem: DEMData, colorRampSize?: number) => UniformValues<ColorReliefUniformsType>;
export { colorReliefUniforms, colorReliefUniformValues, };
//# sourceMappingURL=color_relief_program.d.ts.map