import {CircleStyleLayer} from '../style/style_layer/circle_style_layer';
import {CircleBucket} from '../data/bucket/circle_bucket';
import {drawCircles} from '../render/draw_circle';
import {circleUniforms} from '../render/program/circle_program';
import {prepare} from '../shaders/shaders';
import circleFrag from '../shaders/circle.fragment.glsl.g';
import circleVert from '../shaders/circle.vertex.glsl.g';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const circleBase: Feature = {
    layers: {
        circle: {
            StyleLayer: CircleStyleLayer as any,
            Bucket: CircleBucket,
            draw: drawCircles as any,
        }
    },
    programs: {
        circle: {uniforms: circleUniforms, shaderSource: prepare(circleFrag, circleVert)},
    },
};

export function circle(...capabilities: Feature[]): Feature {
    return merge(circleBase, ...capabilities);
}
