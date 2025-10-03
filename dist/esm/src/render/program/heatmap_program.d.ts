import { Uniform1i, Uniform1f, Uniform2f, UniformMatrix4f } from '../uniform_binding';
import type { Context } from '../../gl/context';
import type { Tile } from '../../source/tile';
import type { UniformValues, UniformLocations } from '../uniform_binding';
import type { Painter } from '../painter';
import type { HeatmapStyleLayer } from '../../style/style_layer/heatmap_style_layer';
export type HeatmapUniformsType = {
    'u_extrude_scale': Uniform1f;
    'u_intensity': Uniform1f;
    'u_globe_extrude_scale': Uniform1f;
};
export type HeatmapTextureUniformsType = {
    'u_matrix': UniformMatrix4f;
    'u_world': Uniform2f;
    'u_image': Uniform1i;
    'u_color_ramp': Uniform1i;
    'u_opacity': Uniform1f;
};
declare const heatmapUniforms: (context: Context, locations: UniformLocations) => HeatmapUniformsType;
declare const heatmapTextureUniforms: (context: Context, locations: UniformLocations) => HeatmapTextureUniformsType;
declare const heatmapUniformValues: (tile: Tile, zoom: number, intensity: number, radiusCorrectionFactor: number) => UniformValues<HeatmapUniformsType>;
declare const heatmapTextureUniformValues: (painter: Painter, layer: HeatmapStyleLayer, textureUnit: number, colorRampUnit: number) => UniformValues<HeatmapTextureUniformsType>;
export { heatmapUniforms, heatmapTextureUniforms, heatmapUniformValues, heatmapTextureUniformValues };
//# sourceMappingURL=heatmap_program.d.ts.map