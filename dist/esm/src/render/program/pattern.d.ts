import { type Uniform1i, type Uniform1f, type Uniform2f, type Uniform3f } from '../uniform_binding';
import type { Painter } from '../painter';
import type { OverscaledTileID } from '../../source/tile_id';
import type { CrossFaded } from '../../style/properties';
import type { CrossfadeParameters } from '../../style/evaluation_parameters';
import type { UniformValues } from '../uniform_binding';
import type { Tile } from '../../source/tile';
import type { ResolvedImage } from '@maplibre/maplibre-gl-style-spec';
type BackgroundPatternUniformsType = {
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
export type PatternUniformsType = {
    'u_image': Uniform1i;
    'u_texsize': Uniform2f;
    'u_scale': Uniform3f;
    'u_fade': Uniform1f;
    'u_pixel_coord_upper': Uniform2f;
    'u_pixel_coord_lower': Uniform2f;
};
declare function patternUniformValues(crossfade: CrossfadeParameters, painter: Painter, tile: Tile): UniformValues<PatternUniformsType>;
declare function bgPatternUniformValues(image: CrossFaded<ResolvedImage>, crossfade: CrossfadeParameters, painter: Painter, tile: {
    tileID: OverscaledTileID;
    tileSize: number;
}): UniformValues<BackgroundPatternUniformsType>;
export { bgPatternUniformValues, patternUniformValues };
//# sourceMappingURL=pattern.d.ts.map