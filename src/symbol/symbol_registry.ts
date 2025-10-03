/**
 * Symbol system registry for lazy initialization
 * This allows the symbol system (placement, cross-tile indexing) to be tree-shaken
 */

export type CrossTileSymbolIndexConstructor = new () => any;
export type PauseablePlacementConstructor = new (...args: any[]) => any;

let crossTileSymbolIndexConstructor: CrossTileSymbolIndexConstructor | undefined;
let pauseablePlacementConstructor: PauseablePlacementConstructor | undefined;

/**
 * Register symbol system constructors
 * Called by the symbol layer registration module
 */
export function registerSymbolDependencies(
    CrossTileSymbolIndex: CrossTileSymbolIndexConstructor,
    PauseablePlacement: PauseablePlacementConstructor
): void {
    crossTileSymbolIndexConstructor = CrossTileSymbolIndex;
    pauseablePlacementConstructor = PauseablePlacement;
}

/**
 * Create a CrossTileSymbolIndex instance if symbols are registered
 */
export function createCrossTileSymbolIndex(): any | undefined {
    return crossTileSymbolIndexConstructor ? new crossTileSymbolIndexConstructor() : undefined;
}

/**
 * Create a PauseablePlacement instance if symbols are registered
 */
export function createPauseablePlacement(...args: any[]): any | undefined {
    return pauseablePlacementConstructor ? new pauseablePlacementConstructor(...args) : undefined;
}

/**
 * Check if symbol system is registered
 */
export function isSymbolSystemRegistered(): boolean {
    return crossTileSymbolIndexConstructor !== undefined && pauseablePlacementConstructor !== undefined;
}
