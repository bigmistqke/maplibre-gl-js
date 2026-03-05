import {FillStyleLayer} from '../style/style_layer/fill_style_layer';
import {FillBucket} from '../data/bucket/fill_bucket';
import {drawFill} from '../render/draw_fill';
import {fillUniforms, fillOutlineUniforms, fillPatternUniforms, fillOutlinePatternUniforms} from '../render/program/fill_program';
import {prepare} from '../shaders/shaders';
import fillFrag from '../shaders/fill.fragment.glsl.g';
import fillVert from '../shaders/fill.vertex.glsl.g';
import fillOutlineFrag from '../shaders/fill_outline.fragment.glsl.g';
import fillOutlineVert from '../shaders/fill_outline.vertex.glsl.g';
import fillPatternFrag from '../shaders/fill_pattern.fragment.glsl.g';
import fillPatternVert from '../shaders/fill_pattern.vertex.glsl.g';
import fillOutlinePatternFrag from '../shaders/fill_outline_pattern.fragment.glsl.g';
import fillOutlinePatternVert from '../shaders/fill_outline_pattern.vertex.glsl.g';
import type {Feature} from '../core/feature';
import {merge, ImageManager} from '../core/feature';

const fillBase: Feature = {
    layers: {
        fill: {
            StyleLayer: FillStyleLayer,
            Bucket: FillBucket,
            draw: drawFill,
        }
    },
    programs: {
        fill: {uniforms: fillUniforms, shaderSource: prepare(fillFrag, fillVert)},
        fillOutline: {uniforms: fillOutlineUniforms, shaderSource: prepare(fillOutlineFrag, fillOutlineVert)},
        fillPattern: {uniforms: fillPatternUniforms, shaderSource: prepare(fillPatternFrag, fillPatternVert)},
        fillOutlinePattern: {uniforms: fillOutlinePatternUniforms, shaderSource: prepare(fillOutlinePatternFrag, fillOutlinePatternVert)},
    },
    singletons: {ImageManager},
};

export function fill(...features: Feature[]): Feature {
    return merge(fillBase, ...features);
}
