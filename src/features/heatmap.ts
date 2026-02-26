import {HeatmapStyleLayer} from '../style/style_layer/heatmap_style_layer';
import {HeatmapBucket} from '../data/bucket/heatmap_bucket';
import {drawHeatmap} from '../render/draw_heatmap';
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
            StyleLayer: HeatmapStyleLayer as any,
            Bucket: HeatmapBucket,
            draw: drawHeatmap as any,
        }
    },
    programs: {
        heatmap: {uniforms: heatmapUniforms, shaderSource: prepare(heatmapFrag, heatmapVert)},
        heatmapTexture: {uniforms: heatmapTextureUniforms, shaderSource: prepare(heatmapTextureFrag, heatmapTextureVert)},
    },
};

export function heatmap(...capabilities: Feature[]): Feature {
    return merge(heatmapBase, ...capabilities);
}
