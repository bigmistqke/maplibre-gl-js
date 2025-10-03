import { Uniform1i, Uniform1f, Uniform2f, UniformColor } from '../uniform_binding';
import type { Painter } from '../painter';
import type { UniformValues, UniformLocations } from '../uniform_binding';
import type { Context } from '../../gl/context';
import type { Color, ResolvedImage } from '@maplibre/maplibre-gl-style-spec';
import type { CrossFaded } from '../../style/properties';
import type { CrossfadeParameters } from '../../style/evaluation_parameters';
import type { OverscaledTileID } from '../../source/tile_id';
export type BackgroundUniformsType = {
    'u_opacity': Uniform1f;
    'u_color': UniformColor;
};
export type BackgroundPatternUniformsType = {
    'u_opacity': Uniform1f;
    'u_image': Uniform1i;
    'u_pattern_tl_a': Uniform2f;
    'u_pattern_br_a': Uniform2f;
    'u_pattern_tl_b': Uniform2f;
    'u_pattern_br_b': Uniform2f;
    'u_texsize': Uniform2f;
    'u_mix': Uniform1f;
    'u_pattern_size_a': Uniform2f;
    'u_pattern_size_b': Uniform2f;
    'u_scale_a': Uniform1f;
    'u_scale_b': Uniform1f;
    'u_pixel_coord_upper': Uniform2f;
    'u_pixel_coord_lower': Uniform2f;
    'u_tile_units_to_pixels': Uniform1f;
};
declare const backgroundUniforms: (context: Context, locations: UniformLocations) => BackgroundUniformsType;
declare const backgroundPatternUniforms: (context: Context, locations: UniformLocations) => BackgroundPatternUniformsType;
declare const backgroundUniformValues: (opacity: number, color: Color) => UniformValues<BackgroundUniformsType>;
declare const backgroundPatternUniformValues: (opacity: number, painter: Painter, image: CrossFaded<ResolvedImage>, tile: {
    tileID: OverscaledTileID;
    tileSize: number;
}, crossfade: CrossfadeParameters) => UniformValues<BackgroundPatternUniformsType>;
export { backgroundUniforms, backgroundPatternUniforms, backgroundUniformValues, backgroundPatternUniformValues };
//# sourceMappingURL=background_program.d.ts.map