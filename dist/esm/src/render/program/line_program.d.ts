import { Uniform1i, Uniform1f, Uniform2f, Uniform3f } from '../uniform_binding';
import type { Context } from '../../gl/context';
import type { UniformValues, UniformLocations } from '../uniform_binding';
import type { Tile } from '../../source/tile';
import type { CrossFaded } from '../../style/properties';
import type { LineStyleLayer } from '../../style/style_layer/line_style_layer';
import type { Painter } from '../painter';
import type { CrossfadeParameters } from '../../style/evaluation_parameters';
export type LineUniformsType = {
    'u_translation': Uniform2f;
    'u_ratio': Uniform1f;
    'u_device_pixel_ratio': Uniform1f;
    'u_units_to_pixels': Uniform2f;
};
export type LineGradientUniformsType = {
    'u_translation': Uniform2f;
    'u_ratio': Uniform1f;
    'u_device_pixel_ratio': Uniform1f;
    'u_units_to_pixels': Uniform2f;
    'u_image': Uniform1i;
    'u_image_height': Uniform1f;
};
export type LinePatternUniformsType = {
    'u_translation': Uniform2f;
    'u_texsize': Uniform2f;
    'u_ratio': Uniform1f;
    'u_device_pixel_ratio': Uniform1f;
    'u_units_to_pixels': Uniform2f;
    'u_image': Uniform1i;
    'u_scale': Uniform3f;
    'u_fade': Uniform1f;
};
export type LineSDFUniformsType = {
    'u_translation': Uniform2f;
    'u_ratio': Uniform1f;
    'u_device_pixel_ratio': Uniform1f;
    'u_units_to_pixels': Uniform2f;
    'u_patternscale_a': Uniform2f;
    'u_patternscale_b': Uniform2f;
    'u_sdfgamma': Uniform1f;
    'u_image': Uniform1i;
    'u_tex_y_a': Uniform1f;
    'u_tex_y_b': Uniform1f;
    'u_mix': Uniform1f;
};
declare const lineUniforms: (context: Context, locations: UniformLocations) => LineUniformsType;
declare const lineGradientUniforms: (context: Context, locations: UniformLocations) => LineGradientUniformsType;
declare const linePatternUniforms: (context: Context, locations: UniformLocations) => LinePatternUniformsType;
declare const lineSDFUniforms: (context: Context, locations: UniformLocations) => LineSDFUniformsType;
declare const lineUniformValues: (painter: Painter, tile: Tile, layer: LineStyleLayer, ratioScale: number) => UniformValues<LineUniformsType>;
declare const lineGradientUniformValues: (painter: Painter, tile: Tile, layer: LineStyleLayer, ratioScale: number, imageHeight: number) => UniformValues<LineGradientUniformsType>;
declare const linePatternUniformValues: (painter: Painter, tile: Tile, layer: LineStyleLayer, ratioScale: number, crossfade: CrossfadeParameters) => UniformValues<LinePatternUniformsType>;
declare const lineSDFUniformValues: (painter: Painter, tile: Tile, layer: LineStyleLayer, ratioScale: number, dasharray: CrossFaded<Array<number>>, crossfade: CrossfadeParameters) => UniformValues<LineSDFUniformsType>;
export { lineUniforms, lineGradientUniforms, linePatternUniforms, lineSDFUniforms, lineUniformValues, lineGradientUniformValues, linePatternUniformValues, lineSDFUniformValues };
//# sourceMappingURL=line_program.d.ts.map