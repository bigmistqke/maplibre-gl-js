import {skyUniforms} from '../render/program/sky_program';
import {atmosphereUniforms} from '../render/program/atmosphere_program';
import {drawSky, drawAtmosphere} from '../render/draw_sky';
import {prepare} from '../shaders/shaders';
import skyFrag from '../shaders/sky.fragment.glsl.g';
import skyVert from '../shaders/sky.vertex.glsl.g';
import atmosphereFrag from '../shaders/atmosphere.fragment.glsl.g';
import atmosphereVert from '../shaders/atmosphere.vertex.glsl.g';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const skyBase: Feature = {
    programs: {
        sky: {uniforms: skyUniforms, shaderSource: prepare(skyFrag, skyVert)},
        atmosphere: {uniforms: atmosphereUniforms, shaderSource: prepare(atmosphereFrag, atmosphereVert)},
    },
    renderHooks: [
        {
            phase: 'beforeLayers',
            render: (painter, style) => {
                if (style.sky) drawSky(painter, style.sky);
            }
        },
        {
            phase: 'afterTranslucent',
            render: (painter, style) => {
                if (style.projection?.transitionState > 0) {
                    drawAtmosphere(painter, style.sky, style.light);
                }
            }
        }
    ]
};

export function sky(...capabilities: Feature[]): Feature {
    return merge(skyBase, ...capabilities);
}
