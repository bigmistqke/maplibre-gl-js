import type { Painter, RenderOptions } from './painter';
import type { SourceCache } from '../source/source_cache';
import type { HeatmapStyleLayer } from '../style/style_layer/heatmap_style_layer';
import type { OverscaledTileID } from '../source/tile_id';
export declare function drawHeatmap(painter: Painter, sourceCache: SourceCache, layer: HeatmapStyleLayer, tileIDs: Array<OverscaledTileID>, renderOptions: RenderOptions): void;
//# sourceMappingURL=draw_heatmap.d.ts.map