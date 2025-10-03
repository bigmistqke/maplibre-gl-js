import { type Evented } from '../util/evented';
import { OverscaledTileID } from './tile_id';
import { RasterTileSource } from './raster_tile_source';
import '../data/dem_data';
import type { DEMEncoding } from '../data/dem_data';
import type { Source } from './source';
import type { Dispatcher } from '../util/dispatcher';
import type { Tile } from './tile';
import type { RasterDEMSourceSpecification } from '@maplibre/maplibre-gl-style-spec';
import { RGBAImage } from '../util/image';
export declare class RasterDEMTileSource extends RasterTileSource implements Source {
    encoding: DEMEncoding;
    redFactor?: number;
    greenFactor?: number;
    blueFactor?: number;
    baseShift?: number;
    constructor(id: string, options: RasterDEMSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented);
    loadTile(tile: Tile): Promise<void>;
    readImageNow(img: ImageBitmap | HTMLImageElement): Promise<RGBAImage | ImageData>;
    _getNeighboringTiles(tileID: OverscaledTileID): {};
    unloadTile(tile: Tile): Promise<void>;
}
//# sourceMappingURL=raster_dem_tile_source.d.ts.map