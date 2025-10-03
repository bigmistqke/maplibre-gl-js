export type PreparedShader = {
    fragmentSource: string;
    vertexSource: string;
    staticAttributes: Array<string>;
    staticUniforms: Array<string>;
};
export declare function prepare(fragmentSource: string, vertexSource: string): PreparedShader;
export declare function transpileVertexShaderToWebGL1(source: string): string;
export declare function transpileFragmentShaderToWebGL1(source: string): string;
//# sourceMappingURL=shaders.d.ts.map