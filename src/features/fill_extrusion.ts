import {FillExtrusionStyleLayer} from '../style/style_layer/fill_extrusion_style_layer';
import {FillExtrusionBucket} from '../data/bucket/fill_extrusion_bucket';
import {drawFillExtrusion} from '../render/draw_fill_extrusion';
import {fillExtrusionUniforms, fillExtrusionPatternUniforms} from '../render/program/fill_extrusion_program';
import {prepare} from '../shaders/shaders';
import fillExtrusionFrag from '../shaders/fill_extrusion.fragment.glsl.g';
import fillExtrusionVert from '../shaders/fill_extrusion.vertex.glsl.g';
import fillExtrusionPatternFrag from '../shaders/fill_extrusion_pattern.fragment.glsl.g';
import fillExtrusionPatternVert from '../shaders/fill_extrusion_pattern.vertex.glsl.g';
import type {Feature} from '../core/feature';
import {merge, ImageManager} from '../core/feature';

const fillExtrusionBase: Feature = {
    layers: {
        'fill-extrusion': {
            StyleLayer: FillExtrusionStyleLayer,
            Bucket: FillExtrusionBucket,
            draw: drawFillExtrusion,
        }
    },
    programs: {
        fillExtrusion: {uniforms: fillExtrusionUniforms, shaderSource: prepare(fillExtrusionFrag, fillExtrusionVert)},
        fillExtrusionPattern: {uniforms: fillExtrusionPatternUniforms, shaderSource: prepare(fillExtrusionPatternFrag, fillExtrusionPatternVert)},
    },
    singletons: {ImageManager},
};

export function fillExtrusion(...features: Feature[]): Feature {
    return merge(fillExtrusionBase, ...features);
}
