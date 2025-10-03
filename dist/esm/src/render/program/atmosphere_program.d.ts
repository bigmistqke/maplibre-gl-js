import type { Context } from '../../gl/context';
import { type UniformValues, type UniformLocations, Uniform1f, Uniform3f, UniformMatrix4f } from '../uniform_binding';
import { type mat4, type vec3 } from 'gl-matrix';
export type atmosphereUniformsType = {
    'u_sun_pos': Uniform3f;
    'u_atmosphere_blend': Uniform1f;
    'u_globe_position': Uniform3f;
    'u_globe_radius': Uniform1f;
    'u_inv_proj_matrix': UniformMatrix4f;
};
declare const atmosphereUniforms: (context: Context, locations: UniformLocations) => atmosphereUniformsType;
declare const atmosphereUniformValues: (sunPos: vec3, atmosphereBlend: number, globePosition: vec3, globeRadius: number, invProjMatrix: mat4) => UniformValues<atmosphereUniformsType>;
export { atmosphereUniforms, atmosphereUniformValues };
//# sourceMappingURL=atmosphere_program.d.ts.map