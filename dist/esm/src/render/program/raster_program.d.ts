import { Uniform1i, Uniform1f, Uniform2f, Uniform3f, Uniform4f } from '../uniform_binding';
import type { Context } from '../../gl/context';
import type { UniformValues, UniformLocations } from '../uniform_binding';
import type { RasterStyleLayer } from '../../style/style_layer/raster_style_layer';
import type Point from '@mapbox/point-geometry';
export type RasterUniformsType = {
    'u_tl_parent': Uniform2f;
    'u_scale_parent': Uniform1f;
    'u_buffer_scale': Uniform1f;
    'u_fade_t': Uniform1f;
    'u_opacity': Uniform1f;
    'u_image0': Uniform1i;
    'u_image1': Uniform1i;
    'u_brightness_low': Uniform1f;
    'u_brightness_high': Uniform1f;
    'u_saturation_factor': Uniform1f;
    'u_contrast_factor': Uniform1f;
    'u_spin_weights': Uniform3f;
    'u_coords_top': Uniform4f;
    'u_coords_bottom': Uniform4f;
};
declare const rasterUniforms: (context: Context, locations: UniformLocations) => RasterUniformsType;
declare const rasterUniformValues: (parentTL: [number, number], parentScaleBy: number, fade: {
    mix: number;
    opacity: number;
}, layer: RasterStyleLayer, cornerCoords: Array<Point>) => UniformValues<RasterUniformsType>;
export { rasterUniforms, rasterUniformValues };
//# sourceMappingURL=raster_program.d.ts.map