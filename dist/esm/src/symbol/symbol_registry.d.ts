export type CrossTileSymbolIndexConstructor = new () => any;
export type PauseablePlacementConstructor = new (...args: any[]) => any;
export declare function registerSymbolDependencies(CrossTileSymbolIndex: CrossTileSymbolIndexConstructor, PauseablePlacement: PauseablePlacementConstructor): void;
export declare function createCrossTileSymbolIndex(): any | undefined;
export declare function createPauseablePlacement(...args: any[]): any | undefined;
export declare function isSymbolSystemRegistered(): boolean;
//# sourceMappingURL=symbol_registry.d.ts.map