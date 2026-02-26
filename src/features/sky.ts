import {skyUniforms} from '../render/program/sky_program';
import {atmosphereUniforms} from '../render/program/atmosphere_program';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const skyBase: Feature = {
    programs: {
        sky: {uniforms: skyUniforms},
        atmosphere: {uniforms: atmosphereUniforms},
    },
};

export function sky(...capabilities: Feature[]): Feature {
    return merge(skyBase, ...capabilities);
}
