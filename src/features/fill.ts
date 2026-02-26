import {FillStyleLayer} from '../style/style_layer/fill_style_layer';
import {drawFill} from '../render/draw_fill';
import {fillUniforms, fillOutlineUniforms, fillPatternUniforms, fillOutlinePatternUniforms} from '../render/program/fill_program';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const fillBase: Feature = {
    layers: {
        fill: {
            StyleLayer: FillStyleLayer as any,
            draw: drawFill as any,
        }
    },
    programs: {
        fill: {uniforms: fillUniforms},
        fillOutline: {uniforms: fillOutlineUniforms},
        fillPattern: {uniforms: fillPatternUniforms},
        fillOutlinePattern: {uniforms: fillOutlinePatternUniforms},
    },
};

export function fill(...capabilities: Feature[]): Feature {
    return merge(fillBase, ...capabilities);
}
