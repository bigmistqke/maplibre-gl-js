let crossTileSymbolIndexConstructor;
let pauseablePlacementConstructor;
export function registerSymbolDependencies(CrossTileSymbolIndex, PauseablePlacement) {
    crossTileSymbolIndexConstructor = CrossTileSymbolIndex;
    pauseablePlacementConstructor = PauseablePlacement;
}
export function createCrossTileSymbolIndex() {
    return crossTileSymbolIndexConstructor ? new crossTileSymbolIndexConstructor() : undefined;
}
export function createPauseablePlacement(...args) {
    return pauseablePlacementConstructor ? new pauseablePlacementConstructor(...args) : undefined;
}
export function isSymbolSystemRegistered() {
    return crossTileSymbolIndexConstructor !== undefined && pauseablePlacementConstructor !== undefined;
}
//# sourceMappingURL=symbol_registry.js.map