import type { Painter, RenderOptions } from './painter';
import type { SourceCache } from '../source/source_cache';
import type { RasterStyleLayer } from '../style/style_layer/raster_style_layer';
import type { OverscaledTileID } from '../source/tile_id';
export declare function drawRaster(painter: Painter, sourceCache: SourceCache, layer: RasterStyleLayer, tileIDs: Array<OverscaledTileID>, renderOptions: RenderOptions): void;
//# sourceMappingURL=draw_raster.d.ts.map