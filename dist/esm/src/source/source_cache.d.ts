import { Tile } from './tile';
import { Evented } from '../util/evented';
import { TileCache } from './tile_cache';
import { type Context } from '../gl/context';
import Point from '@mapbox/point-geometry';
import { OverscaledTileID } from './tile_id';
import { SourceFeatureState } from './source_state';
import type { Source } from './source';
import type { Map } from '../ui/map';
import type { Style } from '../style/style';
import type { Dispatcher } from '../util/dispatcher';
import type { IReadonlyTransform, ITransform } from '../geo/transform_interface';
import type { TileState } from './tile';
import type { ICanonicalTileID, SourceSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Terrain } from '../render/terrain';
import type { CanvasSourceSpecification } from './canvas_source';
type TileResult = {
    tile: Tile;
    tileID: OverscaledTileID;
    queryGeometry: Array<Point>;
    cameraQueryGeometry: Array<Point>;
    scale: number;
};
export declare class SourceCache extends Evented {
    id: string;
    dispatcher: Dispatcher;
    map: Map;
    style: Style;
    _source: Source;
    _sourceLoaded: boolean;
    _sourceErrored: boolean;
    _tiles: {
        [_: string]: Tile;
    };
    _prevLng: number;
    _cache: TileCache;
    _timers: {
        [_ in any]: ReturnType<typeof setTimeout>;
    };
    _cacheTimers: {
        [_ in any]: ReturnType<typeof setTimeout>;
    };
    _maxTileCacheSize: number;
    _maxTileCacheZoomLevels: number;
    _paused: boolean;
    _shouldReloadOnResume: boolean;
    _coveredTiles: {
        [_: string]: boolean;
    };
    transform: ITransform;
    terrain: Terrain;
    used: boolean;
    usedForTerrain: boolean;
    tileSize: number;
    _state: SourceFeatureState;
    _loadedParentTiles: {
        [_: string]: Tile;
    };
    _loadedSiblingTiles: {
        [_: string]: Tile;
    };
    _didEmitContent: boolean;
    _updated: boolean;
    static maxUnderzooming: number;
    static maxOverzooming: number;
    constructor(id: string, options: SourceSpecification | CanvasSourceSpecification, dispatcher: Dispatcher);
    onAdd(map: Map): void;
    onRemove(map: Map): void;
    loaded(): boolean;
    getSource(): Source;
    pause(): void;
    resume(): void;
    _loadTile(tile: Tile, id: string, state: TileState): Promise<void>;
    _unloadTile(tile: Tile): void;
    _abortTile(tile: Tile): void;
    serialize(): any;
    prepare(context: Context): void;
    getIds(): Array<string>;
    getRenderableIds(symbolLayer?: boolean): Array<string>;
    hasRenderableParent(tileID: OverscaledTileID): boolean;
    _isIdRenderable(id: string, symbolLayer?: boolean): boolean;
    reload(sourceDataChanged?: boolean): void;
    _reloadTile(id: string, state: TileState): Promise<void>;
    _tileLoaded(tile: Tile, id: string, previousState: TileState): void;
    _backfillDEM(tile: Tile): void;
    getTile(tileID: OverscaledTileID): Tile;
    getTileByID(id: string): Tile;
    _retainLoadedChildren(idealTiles: {
        [_ in any]: OverscaledTileID;
    }, zoom: number, maxCoveringZoom: number, retain: {
        [_ in any]: OverscaledTileID;
    }): void;
    findLoadedParent(tileID: OverscaledTileID, minCoveringZoom: number): Tile;
    findLoadedSibling(tileID: OverscaledTileID): Tile;
    _getLoadedTile(tileID: OverscaledTileID): Tile;
    updateCacheSize(transform: IReadonlyTransform): void;
    handleWrapJump(lng: number): void;
    _updateCoveredAndRetainedTiles(retain: {
        [_: string]: OverscaledTileID;
    }, minCoveringZoom: number, maxCoveringZoom: number, zoom: number, idealTileIDs: OverscaledTileID[], terrain?: Terrain): void;
    update(transform: ITransform, terrain?: Terrain): void;
    releaseSymbolFadeTiles(): void;
    _updateRetainedTiles(idealTileIDs: Array<OverscaledTileID>, zoom: number): {
        [_: string]: OverscaledTileID;
    };
    _updateLoadedParentTileCache(): void;
    _updateLoadedSiblingTileCache(): void;
    _addTile(tileID: OverscaledTileID): Tile;
    _setTileReloadTimer(id: string, tile: Tile): void;
    refreshTiles(tileIds: Array<ICanonicalTileID>): void;
    _removeTile(id: string): void;
    private _dataHandler;
    clearTiles(): void;
    tilesIn(pointQueryGeometry: Array<Point>, maxPitchScaleFactor: number, has3DLayer: boolean): TileResult[];
    private transformBbox;
    getVisibleCoordinates(symbolLayer?: boolean): Array<OverscaledTileID>;
    hasTransition(): boolean;
    setFeatureState(sourceLayer: string, featureId: number | string, state: any): void;
    removeFeatureState(sourceLayer?: string, featureId?: number | string, key?: string): void;
    getFeatureState(sourceLayer: string, featureId: number | string): import("@maplibre/maplibre-gl-style-spec").FeatureState;
    setDependencies(tileKey: string, namespace: string, dependencies: Array<string>): void;
    reloadTilesForDependencies(namespaces: Array<string>, keys: Array<string>): void;
}
export {};
//# sourceMappingURL=source_cache.d.ts.map