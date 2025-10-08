import type {PreparedShader} from './shaders';

/**
 * Noop shader fallback when a shader is not registered
 */
export const noopShader: PreparedShader = {
    fragmentSource: undefined,
    vertexSource: undefined,
    staticAttributes: [],
    staticUniforms: []
};
