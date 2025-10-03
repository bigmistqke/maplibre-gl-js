import { Uniform1f, Uniform4f, type UniformLocations, UniformMatrix4f } from '../uniform_binding';
import { type Context } from '../../gl/context';
import type { ProjectionData } from '../../geo/projection/projection_data';
export type ProjectionPreludeUniformsType = {
    'u_projection_matrix': UniformMatrix4f;
    'u_projection_tile_mercator_coords': Uniform4f;
    'u_projection_clipping_plane': Uniform4f;
    'u_projection_transition': Uniform1f;
    'u_projection_fallback_matrix': UniformMatrix4f;
};
export declare const projectionUniforms: (context: Context, locations: UniformLocations) => ProjectionPreludeUniformsType;
export declare const projectionObjectToUniformMap: {
    [field in keyof ProjectionData]: keyof ProjectionPreludeUniformsType;
};
//# sourceMappingURL=projection_program.d.ts.map