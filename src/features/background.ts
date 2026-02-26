import {BackgroundStyleLayer} from '../style/style_layer/background_style_layer';
import {drawBackground} from '../render/draw_background';
import {backgroundUniforms, backgroundPatternUniforms} from '../render/program/background_program';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const backgroundBase: Feature = {
    layers: {
        background: {
            StyleLayer: BackgroundStyleLayer as any,
            draw: drawBackground as any,
        }
    },
    programs: {
        background: {uniforms: backgroundUniforms},
        backgroundPattern: {uniforms: backgroundPatternUniforms},
    },
};

export function background(...capabilities: Feature[]): Feature {
    return merge(backgroundBase, ...capabilities);
}
