import { UniformColor, Uniform1f, Uniform2f } from '../uniform_binding';
import type { Context } from '../../gl/context';
import type { UniformValues, UniformLocations } from '../uniform_binding';
import { type IReadonlyTransform } from '../../geo/transform_interface';
import { type Sky } from '../../style/sky';
export type SkyUniformsType = {
    'u_sky_color': UniformColor;
    'u_horizon_color': UniformColor;
    'u_horizon': Uniform2f;
    'u_horizon_normal': Uniform2f;
    'u_sky_horizon_blend': Uniform1f;
    'u_sky_blend': Uniform1f;
};
declare const skyUniforms: (context: Context, locations: UniformLocations) => SkyUniformsType;
declare const skyUniformValues: (sky: Sky, transform: IReadonlyTransform, pixelRatio: number) => UniformValues<SkyUniformsType>;
export { skyUniforms, skyUniformValues };
//# sourceMappingURL=sky_program.d.ts.map