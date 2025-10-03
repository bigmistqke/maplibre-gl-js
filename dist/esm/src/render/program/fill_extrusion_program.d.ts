import { Uniform1i, Uniform1f, Uniform2f, Uniform3f } from '../uniform_binding';
import type { Context } from '../../gl/context';
import type { Painter } from '../painter';
import type { OverscaledTileID } from '../../source/tile_id';
import type { UniformValues, UniformLocations } from '../uniform_binding';
import type { CrossfadeParameters } from '../../style/evaluation_parameters';
import type { Tile } from '../../source/tile';
export type FillExtrusionUniformsType = {
    'u_lightpos': Uniform3f;
    'u_lightpos_globe': Uniform3f;
    'u_lightintensity': Uniform1f;
    'u_lightcolor': Uniform3f;
    'u_vertical_gradient': Uniform1f;
    'u_opacity': Uniform1f;
    'u_fill_translate': Uniform2f;
};
export type FillExtrusionPatternUniformsType = {
    'u_lightpos': Uniform3f;
    'u_lightpos_globe': Uniform3f;
    'u_lightintensity': Uniform1f;
    'u_lightcolor': Uniform3f;
    'u_height_factor': Uniform1f;
    'u_vertical_gradient': Uniform1f;
    'u_opacity': Uniform1f;
    'u_fill_translate': Uniform2f;
    'u_texsize': Uniform2f;
    'u_image': Uniform1i;
    'u_pixel_coord_upper': Uniform2f;
    'u_pixel_coord_lower': Uniform2f;
    'u_scale': Uniform3f;
    'u_fade': Uniform1f;
};
declare const fillExtrusionUniforms: (context: Context, locations: UniformLocations) => FillExtrusionUniformsType;
declare const fillExtrusionPatternUniforms: (context: Context, locations: UniformLocations) => FillExtrusionPatternUniformsType;
declare const fillExtrusionUniformValues: (painter: Painter, shouldUseVerticalGradient: boolean, opacity: number, translate: [number, number]) => UniformValues<FillExtrusionUniformsType>;
declare const fillExtrusionPatternUniformValues: (painter: Painter, shouldUseVerticalGradient: boolean, opacity: number, translate: [number, number], coord: OverscaledTileID, crossfade: CrossfadeParameters, tile: Tile) => UniformValues<FillExtrusionPatternUniformsType>;
export { fillExtrusionUniforms, fillExtrusionPatternUniforms, fillExtrusionUniformValues, fillExtrusionPatternUniformValues };
//# sourceMappingURL=fill_extrusion_program.d.ts.map