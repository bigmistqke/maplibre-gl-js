import {ColorReliefStyleLayer} from '../style/style_layer/color_relief_style_layer';
import {drawColorRelief} from '../render/draw_color_relief';
import {colorReliefUniforms} from '../render/program/color_relief_program';
import {prepare} from '../shaders/shaders';
import colorReliefFrag from '../shaders/color_relief.fragment.glsl.g';
import colorReliefVert from '../shaders/color_relief.vertex.glsl.g';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const colorReliefBase: Feature = {
    layers: {
        'color-relief': {
            StyleLayer: ColorReliefStyleLayer as any,
            draw: drawColorRelief as any,
        }
    },
    programs: {
        colorRelief: {uniforms: colorReliefUniforms, shaderSource: prepare(colorReliefFrag, colorReliefVert)},
    },
};

export function colorRelief(...capabilities: Feature[]): Feature {
    return merge(colorReliefBase, ...capabilities);
}
