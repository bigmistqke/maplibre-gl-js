/**
 * Symbol system registry for lazy initialization
 * This allows the symbol system (placement, cross-tile indexing) to be tree-shaken
 */

import {registry} from '../registry';

export type CrossTileSymbolIndexConstructor = new () => any;
export type PauseablePlacementConstructor = new (...args: any[]) => any;

/**
 * Create a CrossTileSymbolIndex instance if symbols are registered
 */
export function createCrossTileSymbolIndex(): any | undefined {
    return registry.symbol.CrossTileSymbolIndex ? new registry.symbol.CrossTileSymbolIndex() : undefined;
}

/**
 * Create a PauseablePlacement instance if symbols are registered
 */
export function createPauseablePlacement(...args: any[]): any | undefined {
    return registry.symbol.PauseablePlacement ? new registry.symbol.PauseablePlacement(...args) : undefined;
}

/**
 * Check if symbol system is registered
 */
export function isSymbolSystemRegistered(): boolean {
    return registry.symbol.CrossTileSymbolIndex !== undefined && registry.symbol.PauseablePlacement !== undefined;
}
