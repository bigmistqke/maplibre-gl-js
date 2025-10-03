import { Uniform1i, Uniform1f, Uniform2f, Uniform3f } from '../uniform_binding';
import type { Painter } from '../painter';
import type { UniformValues, UniformLocations } from '../uniform_binding';
import type { Context } from '../../gl/context';
import type { CrossfadeParameters } from '../../style/evaluation_parameters';
import type { Tile } from '../../source/tile';
export type FillUniformsType = {
    'u_fill_translate': Uniform2f;
};
export type FillOutlineUniformsType = {
    'u_world': Uniform2f;
    'u_fill_translate': Uniform2f;
};
export type FillPatternUniformsType = {
    'u_texsize': Uniform2f;
    'u_image': Uniform1i;
    'u_pixel_coord_upper': Uniform2f;
    'u_pixel_coord_lower': Uniform2f;
    'u_scale': Uniform3f;
    'u_fade': Uniform1f;
    'u_fill_translate': Uniform2f;
};
export type FillOutlinePatternUniformsType = {
    'u_world': Uniform2f;
    'u_texsize': Uniform2f;
    'u_image': Uniform1i;
    'u_pixel_coord_upper': Uniform2f;
    'u_pixel_coord_lower': Uniform2f;
    'u_scale': Uniform3f;
    'u_fade': Uniform1f;
    'u_fill_translate': Uniform2f;
};
declare const fillUniforms: (context: Context, locations: UniformLocations) => FillUniformsType;
declare const fillPatternUniforms: (context: Context, locations: UniformLocations) => FillPatternUniformsType;
declare const fillOutlineUniforms: (context: Context, locations: UniformLocations) => FillOutlineUniformsType;
declare const fillOutlinePatternUniforms: (context: Context, locations: UniformLocations) => FillOutlinePatternUniformsType;
declare const fillPatternUniformValues: (painter: Painter, crossfade: CrossfadeParameters, tile: Tile, translate: [number, number]) => UniformValues<FillPatternUniformsType>;
declare const fillUniformValues: (translate: [number, number]) => UniformValues<FillUniformsType>;
declare const fillOutlineUniformValues: (drawingBufferSize: [number, number], translate: [number, number]) => UniformValues<FillOutlineUniformsType>;
declare const fillOutlinePatternUniformValues: (painter: Painter, crossfade: CrossfadeParameters, tile: Tile, drawingBufferSize: [number, number], translate: [number, number]) => UniformValues<FillOutlinePatternUniformsType>;
export { fillUniforms, fillPatternUniforms, fillOutlineUniforms, fillOutlinePatternUniforms, fillUniformValues, fillPatternUniformValues, fillOutlineUniformValues, fillOutlinePatternUniformValues };
//# sourceMappingURL=fill_program.d.ts.map