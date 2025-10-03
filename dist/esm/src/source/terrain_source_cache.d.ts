import { type OverscaledTileID } from './tile_id';
import { Tile } from './tile';
import { Evented } from '../util/evented';
import type { ITransform } from '../geo/transform_interface';
import type { SourceCache } from '../source/source_cache';
import { type Terrain } from '../render/terrain';
import { type CanonicalTileRange } from './image_source';
export declare class TerrainSourceCache extends Evented {
    sourceCache: SourceCache;
    _tiles: {
        [_: string]: Tile;
    };
    _renderableTilesKeys: Array<string>;
    _sourceTileCache: {
        [_: string]: string;
    };
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    deltaZoom: number;
    _lastTilesetChange: number;
    constructor(sourceCache: SourceCache);
    destruct(): void;
    update(transform: ITransform, terrain: Terrain): void;
    freeRtt(tileID?: OverscaledTileID): void;
    getRenderableTiles(): Array<Tile>;
    getTileByID(id: string): Tile;
    getTerrainCoords(tileID: OverscaledTileID, terrainTileRanges?: {
        [zoom: string]: CanonicalTileRange;
    }): Record<string, OverscaledTileID>;
    _getTerrainCoordsForRegularTile(tileID: OverscaledTileID): Record<string, OverscaledTileID>;
    _getTerrainCoordsForTileRanges(tileID: OverscaledTileID, terrainTileRanges: {
        [zoom: string]: CanonicalTileRange;
    }): Record<string, OverscaledTileID>;
    getSourceTile(tileID: OverscaledTileID, searchForDEM?: boolean): Tile;
    anyTilesAfterTime(time?: number): boolean;
    private _isWithinTileRanges;
}
//# sourceMappingURL=terrain_source_cache.d.ts.map