import {CircleStyleLayer} from '../style/style_layer/circle_style_layer';
import {drawCircles} from '../render/draw_circle';
import {circleUniforms} from '../render/program/circle_program';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const circleBase: Feature = {
    layers: {
        circle: {
            StyleLayer: CircleStyleLayer as any,
            draw: drawCircles as any,
        }
    },
    programs: {
        circle: {uniforms: circleUniforms},
    },
};

export function circle(...capabilities: Feature[]): Feature {
    return merge(circleBase, ...capabilities);
}
