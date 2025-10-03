const drawRegistry = new Map();
export function registerDrawFunction(layerType, drawFn) {
    drawRegistry.set(layerType, drawFn);
}
export function getDrawFunction(layerType) {
    return drawRegistry.get(layerType);
}
export function isDrawFunctionRegistered(layerType) {
    return drawRegistry.has(layerType);
}
//# sourceMappingURL=draw_registry.js.map