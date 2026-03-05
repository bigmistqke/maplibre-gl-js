import {HillshadeStyleLayer} from '../style/style_layer/hillshade_style_layer';
import {drawHillshade} from '../render/draw_hillshade';
import {hillshadeUniforms, hillshadePrepareUniforms} from '../render/program/hillshade_program';
import {prepare} from '../shaders/shaders';
import hillshadeFrag from '../shaders/hillshade.fragment.glsl.g';
import hillshadeVert from '../shaders/hillshade.vertex.glsl.g';
import hillshadePrepareFrag from '../shaders/hillshade_prepare.fragment.glsl.g';
import hillshadePrepareVert from '../shaders/hillshade_prepare.vertex.glsl.g';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const hillshadeBase: Feature = {
    layers: {
        hillshade: {
            StyleLayer: HillshadeStyleLayer,
            draw: drawHillshade,
        }
    },
    programs: {
        hillshade: {uniforms: hillshadeUniforms, shaderSource: prepare(hillshadeFrag, hillshadeVert)},
        hillshadePrepare: {uniforms: hillshadePrepareUniforms, shaderSource: prepare(hillshadePrepareFrag, hillshadePrepareVert)},
    },
};

export function hillshade(...features: Feature[]): Feature {
    return merge(hillshadeBase, ...features);
}
