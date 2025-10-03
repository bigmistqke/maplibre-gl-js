import { type Dispatcher } from '../util/dispatcher';
import type { SourceSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Event, Evented } from '../util/evented';
import type { Map } from '../ui/map';
import type { Tile } from './tile';
import type { OverscaledTileID, CanonicalTileID } from './tile_id';
import type { CanvasSourceSpecification } from '../source/canvas_source';
import { type CalculateTileZoomFunction } from '../geo/projection/covering_tiles';
export interface Source {
    readonly type: string;
    id: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    attribution?: string;
    roundZoom?: boolean;
    isTileClipped?: boolean;
    tileID?: CanonicalTileID;
    reparseOverscaled?: boolean;
    vectorLayerIds?: Array<string>;
    hasTransition(): boolean;
    loaded(): boolean;
    fire(event: Event): unknown;
    onAdd?(map: Map): void;
    onRemove?(map: Map): void;
    loadTile(tile: Tile): Promise<void>;
    hasTile?(tileID: OverscaledTileID): boolean;
    abortTile?(tile: Tile): Promise<void>;
    unloadTile?(tile: Tile): Promise<void>;
    serialize(): any;
    prepare?(): void;
    calculateTileZoom?: CalculateTileZoomFunction;
}
export type SourceClass = {
    new (id: string, specification: SourceSpecification | CanvasSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented): Source;
};
export declare const create: (id: string, specification: SourceSpecification | CanvasSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) => Source | null;
export declare const addSourceType: (name: string, SourceType: SourceClass) => Promise<void>;
//# sourceMappingURL=source.d.ts.map