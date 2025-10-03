import type { PreparedShader } from './shaders';
export declare const noopShader: PreparedShader;
export declare function registerShader(name: string, shader: PreparedShader): void;
export declare function getShader(name: string): PreparedShader;
export declare function getShaders(): Record<string, PreparedShader>;
//# sourceMappingURL=shader_registry.d.ts.map