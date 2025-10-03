import { CanonicalTileID } from './tile_id';
import { Evented } from '../util/evented';
import { Texture } from '../render/texture';
import { MercatorCoordinate } from '../geo/mercator_coordinate';
import type { Source } from './source';
import type { CanvasSourceSpecification } from './canvas_source';
import type { Map } from '../ui/map';
import type { Dispatcher } from '../util/dispatcher';
import type { Tile } from './tile';
import type { ImageSourceSpecification, VideoSourceSpecification } from '@maplibre/maplibre-gl-style-spec';
import type Point from '@mapbox/point-geometry';
export type Coordinates = [[number, number], [number, number], [number, number], [number, number]];
export type UpdateImageOptions = {
    url: string;
    coordinates?: Coordinates;
};
export type CanonicalTileRange = {
    minTileX: number;
    minTileY: number;
    maxTileX: number;
    maxTileY: number;
};
export declare class ImageSource extends Evented implements Source {
    type: string;
    id: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    url: string;
    terrainTileRanges: {
        [zoom: string]: CanonicalTileRange;
    };
    coordinates: Coordinates;
    tiles: {
        [_: string]: Tile;
    };
    options: any;
    dispatcher: Dispatcher;
    map: Map;
    texture: Texture | null;
    image: HTMLImageElement | ImageBitmap;
    tileID: CanonicalTileID;
    tileCoords: Array<Point>;
    flippedWindingOrder: boolean;
    _loaded: boolean;
    _request: AbortController;
    constructor(id: string, options: ImageSourceSpecification | VideoSourceSpecification | CanvasSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented);
    load(newCoordinates?: Coordinates): Promise<void>;
    loaded(): boolean;
    updateImage(options: UpdateImageOptions): this;
    _finishLoading(): void;
    onAdd(map: Map): void;
    onRemove(): void;
    setCoordinates(coordinates: Coordinates): this;
    prepare(): void;
    loadTile(tile: Tile): Promise<void>;
    serialize(): ImageSourceSpecification | VideoSourceSpecification | CanvasSourceSpecification;
    hasTransition(): boolean;
    private _getOverlappingTileRanges;
}
export declare function getCoordinatesCenterTileID(coords: Array<MercatorCoordinate>): CanonicalTileID;
//# sourceMappingURL=image_source.d.ts.map