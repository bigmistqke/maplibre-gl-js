import {HeatmapStyleLayer} from '../style/style_layer/heatmap_style_layer';
import {HeatmapBucket} from '../data/bucket/heatmap_bucket';
import {drawHeatmap, drawHeatmapOffscreen} from '../render/draw_heatmap';
import {heatmapUniforms, heatmapTextureUniforms} from '../render/program/heatmap_program';
import {prepare} from '../shaders/shaders';
import heatmapFrag from '../shaders/heatmap.fragment.glsl.g';
import heatmapVert from '../shaders/heatmap.vertex.glsl.g';
import heatmapTextureFrag from '../shaders/heatmap_texture.fragment.glsl.g';
import heatmapTextureVert from '../shaders/heatmap_texture.vertex.glsl.g';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const heatmapBase: Feature = {
    layers: {
        heatmap: {
            StyleLayer: HeatmapStyleLayer,
            Bucket: HeatmapBucket,
            draw: drawHeatmap,
            drawOffscreen: drawHeatmapOffscreen,
        }
    },
    programs: {
        heatmap: {uniforms: heatmapUniforms, shaderSource: prepare(heatmapFrag, heatmapVert)},
        heatmapTexture: {uniforms: heatmapTextureUniforms, shaderSource: prepare(heatmapTextureFrag, heatmapTextureVert)},
    },
};

export function heatmap(...features: Feature[]): Feature {
    return merge(heatmapBase, ...features);
}
