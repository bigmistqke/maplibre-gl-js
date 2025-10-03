const sourceRegistry = {};
export function registerSource(name, sourceClass) {
    sourceRegistry[name] = sourceClass;
}
export function getSource(name) {
    return sourceRegistry[name];
}
//# sourceMappingURL=source_registry.js.map