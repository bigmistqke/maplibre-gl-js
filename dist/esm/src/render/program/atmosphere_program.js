import { Uniform1f, Uniform3f, UniformMatrix4f } from '../uniform_binding';
const atmosphereUniforms = (context, locations) => ({
    'u_sun_pos': new Uniform3f(context, locations.u_sun_pos),
    'u_atmosphere_blend': new Uniform1f(context, locations.u_atmosphere_blend),
    'u_globe_position': new Uniform3f(context, locations.u_globe_position),
    'u_globe_radius': new Uniform1f(context, locations.u_globe_radius),
    'u_inv_proj_matrix': new UniformMatrix4f(context, locations.u_inv_proj_matrix),
});
const atmosphereUniformValues = (sunPos, atmosphereBlend, globePosition, globeRadius, invProjMatrix) => ({
    'u_sun_pos': sunPos,
    'u_atmosphere_blend': atmosphereBlend,
    'u_globe_position': globePosition,
    'u_globe_radius': globeRadius,
    'u_inv_proj_matrix': invProjMatrix,
});
export { atmosphereUniforms, atmosphereUniformValues };
//# sourceMappingURL=atmosphere_program.js.map