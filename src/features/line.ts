import {LineStyleLayer} from '../style/style_layer/line_style_layer';
import {LineBucket} from '../data/bucket/line_bucket';
import {drawLine} from '../render/draw_line';
import {lineUniforms, lineGradientUniforms, linePatternUniforms, lineSDFUniforms, lineGradientSDFUniforms} from '../render/program/line_program';
import {prepare} from '../shaders/shaders';
import lineFrag from '../shaders/line.fragment.glsl.g';
import lineVert from '../shaders/line.vertex.glsl.g';
import lineGradientFrag from '../shaders/line_gradient.fragment.glsl.g';
import lineGradientVert from '../shaders/line_gradient.vertex.glsl.g';
import linePatternFrag from '../shaders/line_pattern.fragment.glsl.g';
import linePatternVert from '../shaders/line_pattern.vertex.glsl.g';
import lineSDFFrag from '../shaders/line_sdf.fragment.glsl.g';
import lineSDFVert from '../shaders/line_sdf.vertex.glsl.g';
import lineGradientSDFFrag from '../shaders/line_gradient_sdf.fragment.glsl.g';
import lineGradientSDFVert from '../shaders/line_gradient_sdf.vertex.glsl.g';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const lineBase: Feature = {
    layers: {
        line: {
            StyleLayer: LineStyleLayer as any,
            Bucket: LineBucket,
            draw: drawLine as any,
        }
    },
    programs: {
        line: {uniforms: lineUniforms, shaderSource: prepare(lineFrag, lineVert)},
        lineGradient: {uniforms: lineGradientUniforms, shaderSource: prepare(lineGradientFrag, lineGradientVert)},
        linePattern: {uniforms: linePatternUniforms, shaderSource: prepare(linePatternFrag, linePatternVert)},
        lineSDF: {uniforms: lineSDFUniforms, shaderSource: prepare(lineSDFFrag, lineSDFVert)},
        lineGradientSDF: {uniforms: lineGradientSDFUniforms, shaderSource: prepare(lineGradientSDFFrag, lineGradientSDFVert)},
    },
};

export function line(...capabilities: Feature[]): Feature {
    return merge(lineBase, ...capabilities);
}
