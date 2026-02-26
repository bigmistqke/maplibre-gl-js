import {FillExtrusionStyleLayer} from '../style/style_layer/fill_extrusion_style_layer';
import {drawFillExtrusion} from '../render/draw_fill_extrusion';
import {fillExtrusionUniforms, fillExtrusionPatternUniforms} from '../render/program/fill_extrusion_program';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const fillExtrusionBase: Feature = {
    layers: {
        'fill-extrusion': {
            StyleLayer: FillExtrusionStyleLayer as any,
            draw: drawFillExtrusion as any,
        }
    },
    programs: {
        fillExtrusion: {uniforms: fillExtrusionUniforms},
        fillExtrusionPattern: {uniforms: fillExtrusionPatternUniforms},
    },
};

export function fillExtrusion(...capabilities: Feature[]): Feature {
    return merge(fillExtrusionBase, ...capabilities);
}
