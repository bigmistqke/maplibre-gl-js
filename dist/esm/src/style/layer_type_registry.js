const layerTypeRegistry = new Map();
export function registerLayerType(type, factory) {
    layerTypeRegistry.set(type, factory);
}
export function getLayerFactory(type) {
    return layerTypeRegistry.get(type);
}
export function isLayerTypeRegistered(type) {
    return layerTypeRegistry.has(type);
}
//# sourceMappingURL=layer_type_registry.js.map