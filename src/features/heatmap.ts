import {HeatmapStyleLayer} from '../style/style_layer/heatmap_style_layer';
import {drawHeatmap} from '../render/draw_heatmap';
import {heatmapUniforms, heatmapTextureUniforms} from '../render/program/heatmap_program';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const heatmapBase: Feature = {
    layers: {
        heatmap: {
            StyleLayer: HeatmapStyleLayer as any,
            draw: drawHeatmap as any,
        }
    },
    programs: {
        heatmap: {uniforms: heatmapUniforms},
        heatmapTexture: {uniforms: heatmapTextureUniforms},
    },
};

export function heatmap(...capabilities: Feature[]): Feature {
    return merge(heatmapBase, ...capabilities);
}
