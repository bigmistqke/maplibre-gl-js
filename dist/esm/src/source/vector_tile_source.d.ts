import { Evented } from '../util/evented';
import { TileBounds } from './tile_bounds';
import type { Source } from './source';
import type { OverscaledTileID } from './tile_id';
import type { Map } from '../ui/map';
import type { Dispatcher } from '../util/dispatcher';
import type { Tile } from './tile';
import type { VectorSourceSpecification, PromoteIdSpecification } from '@maplibre/maplibre-gl-style-spec';
export type VectorTileSourceOptions = VectorSourceSpecification & {
    collectResourceTiming?: boolean;
    tileSize?: number;
};
export declare class VectorTileSource extends Evented implements Source {
    type: 'vector';
    id: string;
    minzoom: number;
    maxzoom: number;
    url: string;
    scheme: string;
    tileSize: number;
    promoteId: PromoteIdSpecification;
    _options: VectorSourceSpecification;
    _collectResourceTiming: boolean;
    dispatcher: Dispatcher;
    map: Map;
    bounds: [number, number, number, number];
    tiles: Array<string>;
    tileBounds: TileBounds;
    reparseOverscaled: boolean;
    isTileClipped: boolean;
    _tileJSONRequest: AbortController;
    _loaded: boolean;
    constructor(id: string, options: VectorTileSourceOptions, dispatcher: Dispatcher, eventedParent: Evented);
    load(): Promise<void>;
    loaded(): boolean;
    hasTile(tileID: OverscaledTileID): boolean;
    onAdd(map: Map): void;
    setSourceProperty(callback: Function): void;
    setTiles(tiles: Array<string>): this;
    setUrl(url: string): this;
    onRemove(): void;
    serialize(): VectorSourceSpecification;
    loadTile(tile: Tile): Promise<void>;
    private _afterTileLoadWorkerResponse;
    abortTile(tile: Tile): Promise<void>;
    unloadTile(tile: Tile): Promise<void>;
    hasTransition(): boolean;
}
//# sourceMappingURL=vector_tile_source.d.ts.map