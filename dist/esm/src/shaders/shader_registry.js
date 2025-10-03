const shaderRegistry = {};
export function registerShader(name, shader) {
    shaderRegistry[name] = shader;
}
export function getShaders() {
    return shaderRegistry;
}
//# sourceMappingURL=shader_registry.js.map