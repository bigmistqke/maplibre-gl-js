import { type OverscaledTileID } from './tile_id';
import type { Tile } from './tile';
export declare class TileCache {
    max: number;
    data: {
        [key: string]: Array<{
            value: Tile;
            timeout: ReturnType<typeof setTimeout>;
        }>;
    };
    order: Array<string>;
    onRemove: (element: Tile) => void;
    constructor(max: number, onRemove: (element: Tile) => void);
    reset(): this;
    add(tileID: OverscaledTileID, data: Tile, expiryTimeout: number | void): this;
    has(tileID: OverscaledTileID): boolean;
    getAndRemove(tileID: OverscaledTileID): Tile;
    _getAndRemoveByKey(key: string): Tile;
    getByKey(key: string): Tile;
    get(tileID: OverscaledTileID): Tile;
    remove(tileID: OverscaledTileID, value?: {
        value: Tile;
        timeout: ReturnType<typeof setTimeout>;
    }): this;
    setMaxSize(max: number): TileCache;
    filter(filterFn: (tile: Tile) => boolean): void;
}
//# sourceMappingURL=tile_cache.d.ts.map