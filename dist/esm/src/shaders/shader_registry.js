const shaderRegistry = {};
export const noopShader = {
    fragmentSource: undefined,
    vertexSource: undefined,
    staticAttributes: [],
    staticUniforms: []
};
export function registerShader(name, shader) {
    shaderRegistry[name] = shader;
}
export function getShader(name) {
    var _a;
    return (_a = shaderRegistry[name]) !== null && _a !== void 0 ? _a : noopShader;
}
export function getShaders() {
    return shaderRegistry;
}
//# sourceMappingURL=shader_registry.js.map