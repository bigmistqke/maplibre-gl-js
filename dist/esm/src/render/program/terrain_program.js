import { Uniform1i, Uniform1f, Uniform4f, UniformMatrix4f, UniformColor } from '../uniform_binding';
import { Color } from '@maplibre/maplibre-gl-style-spec';
const terrainPreludeUniforms = (context, locations) => ({
    'u_depth': new Uniform1i(context, locations.u_depth),
    'u_terrain': new Uniform1i(context, locations.u_terrain),
    'u_terrain_dim': new Uniform1f(context, locations.u_terrain_dim),
    'u_terrain_matrix': new UniformMatrix4f(context, locations.u_terrain_matrix),
    'u_terrain_unpack': new Uniform4f(context, locations.u_terrain_unpack),
    'u_terrain_exaggeration': new Uniform1f(context, locations.u_terrain_exaggeration)
});
const terrainUniforms = (context, locations) => ({
    'u_texture': new Uniform1i(context, locations.u_texture),
    'u_ele_delta': new Uniform1f(context, locations.u_ele_delta),
    'u_fog_matrix': new UniformMatrix4f(context, locations.u_fog_matrix),
    'u_fog_color': new UniformColor(context, locations.u_fog_color),
    'u_fog_ground_blend': new Uniform1f(context, locations.u_fog_ground_blend),
    'u_fog_ground_blend_opacity': new Uniform1f(context, locations.u_fog_ground_blend_opacity),
    'u_horizon_color': new UniformColor(context, locations.u_horizon_color),
    'u_horizon_fog_blend': new Uniform1f(context, locations.u_horizon_fog_blend),
    'u_is_globe_mode': new Uniform1f(context, locations.u_is_globe_mode)
});
const terrainDepthUniforms = (context, locations) => ({
    'u_ele_delta': new Uniform1f(context, locations.u_ele_delta)
});
const terrainCoordsUniforms = (context, locations) => ({
    'u_texture': new Uniform1i(context, locations.u_texture),
    'u_terrain_coords_id': new Uniform1f(context, locations.u_terrain_coords_id),
    'u_ele_delta': new Uniform1f(context, locations.u_ele_delta)
});
const terrainUniformValues = (eleDelta, fogMatrix, sky, pitch, isGlobeMode) => ({
    'u_texture': 0,
    'u_ele_delta': eleDelta,
    'u_fog_matrix': fogMatrix,
    'u_fog_color': sky ? sky.properties.get('fog-color') : Color.white,
    'u_fog_ground_blend': sky ? sky.properties.get('fog-ground-blend') : 1,
    'u_fog_ground_blend_opacity': isGlobeMode ? 0 : (sky ? sky.calculateFogBlendOpacity(pitch) : 0),
    'u_horizon_color': sky ? sky.properties.get('horizon-color') : Color.white,
    'u_horizon_fog_blend': sky ? sky.properties.get('horizon-fog-blend') : 1,
    'u_is_globe_mode': isGlobeMode ? 1 : 0
});
const terrainDepthUniformValues = (eleDelta) => ({
    'u_ele_delta': eleDelta
});
const terrainCoordsUniformValues = (coordsId, eleDelta) => ({
    'u_terrain_coords_id': coordsId / 255,
    'u_texture': 0,
    'u_ele_delta': eleDelta
});
export { terrainUniforms, terrainDepthUniforms, terrainCoordsUniforms, terrainPreludeUniforms, terrainUniformValues, terrainDepthUniformValues, terrainCoordsUniformValues };
//# sourceMappingURL=terrain_program.js.map