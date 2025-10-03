import type {PreparedShader} from './shaders';

/**
 * Shader registry for tree-shaking
 * Shaders register themselves when their corresponding draw function is imported
 */
const shaderRegistry: Record<string, PreparedShader> = {};

/**
 * Register a shader program
 * @param name - Shader name (e.g., 'circle', 'fill', 'line')
 * @param shader - Prepared shader object
 */
export function registerShader(name: string, shader: PreparedShader): void {
    shaderRegistry[name] = shader;
}

/**
 * Get all registered shaders as an object (for painter.useProgram)
 */
export function getShaders(): Record<string, PreparedShader> {
    return shaderRegistry;
}
