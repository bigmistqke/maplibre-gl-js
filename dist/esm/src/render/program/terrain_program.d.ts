import { Uniform1i, Uniform1f, Uniform4f, UniformMatrix4f, UniformColor } from '../uniform_binding';
import type { Context } from '../../gl/context';
import type { UniformValues, UniformLocations } from '../../render/uniform_binding';
import { type Sky } from '../../style/sky';
import { type mat4 } from 'gl-matrix';
export type TerrainPreludeUniformsType = {
    'u_depth': Uniform1i;
    'u_terrain': Uniform1i;
    'u_terrain_dim': Uniform1f;
    'u_terrain_matrix': UniformMatrix4f;
    'u_terrain_unpack': Uniform4f;
    'u_terrain_exaggeration': Uniform1f;
};
export type TerrainUniformsType = {
    'u_texture': Uniform1i;
    'u_ele_delta': Uniform1f;
    'u_fog_matrix': UniformMatrix4f;
    'u_fog_color': UniformColor;
    'u_fog_ground_blend': Uniform1f;
    'u_fog_ground_blend_opacity': Uniform1f;
    'u_horizon_color': UniformColor;
    'u_horizon_fog_blend': Uniform1f;
    'u_is_globe_mode': Uniform1f;
};
export type TerrainDepthUniformsType = {
    'u_ele_delta': Uniform1f;
};
export type TerrainCoordsUniformsType = {
    'u_texture': Uniform1i;
    'u_terrain_coords_id': Uniform1f;
    'u_ele_delta': Uniform1f;
};
declare const terrainPreludeUniforms: (context: Context, locations: UniformLocations) => TerrainPreludeUniformsType;
declare const terrainUniforms: (context: Context, locations: UniformLocations) => TerrainUniformsType;
declare const terrainDepthUniforms: (context: Context, locations: UniformLocations) => TerrainDepthUniformsType;
declare const terrainCoordsUniforms: (context: Context, locations: UniformLocations) => TerrainCoordsUniformsType;
declare const terrainUniformValues: (eleDelta: number, fogMatrix: mat4, sky: Sky, pitch: number, isGlobeMode: boolean) => UniformValues<TerrainUniformsType>;
declare const terrainDepthUniformValues: (eleDelta: number) => UniformValues<TerrainDepthUniformsType>;
declare const terrainCoordsUniformValues: (coordsId: number, eleDelta: number) => UniformValues<TerrainCoordsUniformsType>;
export { terrainUniforms, terrainDepthUniforms, terrainCoordsUniforms, terrainPreludeUniforms, terrainUniformValues, terrainDepthUniformValues, terrainCoordsUniformValues };
//# sourceMappingURL=terrain_program.d.ts.map