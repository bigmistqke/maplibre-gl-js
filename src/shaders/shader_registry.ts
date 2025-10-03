import type {PreparedShader} from './shaders';

/**
 * Shader registry for tree-shaking
 * Shaders register themselves when their corresponding draw function is imported
 */
const shaderRegistry: Record<string, PreparedShader> = {};

/**
 * Noop shader fallback when a shader is not registered
 */
export const noopShader: PreparedShader = {
    fragmentSource: '',
    vertexSource: '',
    staticAttributes: [],
    staticUniforms: []
};

/**
 * Register a shader program
 * @param name - Shader name (e.g., 'circle', 'fill', 'line')
 * @param shader - Prepared shader object
 */
export function registerShader(name: string, shader: PreparedShader): void {
    shaderRegistry[name] = shader;
}

/**
 * Get a specific shader by name, returns noop shader if not registered
 */
export function getShader(name: string): PreparedShader {
    return shaderRegistry[name] ?? noopShader;
}

/**
 * Get all registered shaders
 */
export function getShaders(): Record<string, PreparedShader> {
    return shaderRegistry;
}
