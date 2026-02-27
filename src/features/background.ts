import {BackgroundStyleLayer} from '../style/style_layer/background_style_layer';
import {drawBackground} from '../render/draw_background';
import {backgroundUniforms, backgroundPatternUniforms} from '../render/program/background_program';
import {prepare} from '../shaders/shaders';
import backgroundFrag from '../shaders/background.fragment.glsl.g';
import backgroundVert from '../shaders/background.vertex.glsl.g';
import backgroundPatternFrag from '../shaders/background_pattern.fragment.glsl.g';
import backgroundPatternVert from '../shaders/background_pattern.vertex.glsl.g';
import type {Feature} from '../core/feature';
import {merge, ImageManager} from '../core/feature';

const backgroundBase: Feature = {
    layers: {
        background: {
            StyleLayer: BackgroundStyleLayer as any,
            draw: drawBackground as any,
        }
    },
    programs: {
        background: {uniforms: backgroundUniforms, shaderSource: prepare(backgroundFrag, backgroundVert)},
        backgroundPattern: {uniforms: backgroundPatternUniforms, shaderSource: prepare(backgroundPatternFrag, backgroundPatternVert)},
    },
    managers: {ImageManager},
};

export function background(...capabilities: Feature[]): Feature {
    return merge(backgroundBase, ...capabilities);
}
