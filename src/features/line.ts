import {LineStyleLayer} from '../style/style_layer/line_style_layer';
import {drawLine} from '../render/draw_line';
import {lineUniforms, lineGradientUniforms, linePatternUniforms, lineSDFUniforms, lineGradientSDFUniforms} from '../render/program/line_program';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const lineBase: Feature = {
    layers: {
        line: {
            StyleLayer: LineStyleLayer as any,
            draw: drawLine as any,
        }
    },
    programs: {
        line: {uniforms: lineUniforms},
        lineGradient: {uniforms: lineGradientUniforms},
        linePattern: {uniforms: linePatternUniforms},
        lineSDF: {uniforms: lineSDFUniforms},
        lineGradientSDF: {uniforms: lineGradientSDFUniforms},
    },
};

export function line(...capabilities: Feature[]): Feature {
    return merge(lineBase, ...capabilities);
}
