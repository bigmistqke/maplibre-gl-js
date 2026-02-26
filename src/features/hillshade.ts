import {HillshadeStyleLayer} from '../style/style_layer/hillshade_style_layer';
import {drawHillshade} from '../render/draw_hillshade';
import {hillshadeUniforms, hillshadePrepareUniforms} from '../render/program/hillshade_program';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const hillshadeBase: Feature = {
    layers: {
        hillshade: {
            StyleLayer: HillshadeStyleLayer as any,
            draw: drawHillshade as any,
        }
    },
    programs: {
        hillshade: {uniforms: hillshadeUniforms},
        hillshadePrepare: {uniforms: hillshadePrepareUniforms},
    },
};

export function hillshade(...capabilities: Feature[]): Feature {
    return merge(hillshadeBase, ...capabilities);
}
