import { Uniform1f, Uniform4f, UniformMatrix4f } from '../uniform_binding';
export const projectionUniforms = (context, locations) => ({
    'u_projection_matrix': new UniformMatrix4f(context, locations.u_projection_matrix),
    'u_projection_tile_mercator_coords': new Uniform4f(context, locations.u_projection_tile_mercator_coords),
    'u_projection_clipping_plane': new Uniform4f(context, locations.u_projection_clipping_plane),
    'u_projection_transition': new Uniform1f(context, locations.u_projection_transition),
    'u_projection_fallback_matrix': new UniformMatrix4f(context, locations.u_projection_fallback_matrix),
});
export const projectionObjectToUniformMap = {
    mainMatrix: 'u_projection_matrix',
    tileMercatorCoords: 'u_projection_tile_mercator_coords',
    clippingPlane: 'u_projection_clipping_plane',
    projectionTransition: 'u_projection_transition',
    fallbackMatrix: 'u_projection_fallback_matrix',
};
//# sourceMappingURL=projection_program.js.map