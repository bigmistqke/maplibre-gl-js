import type { Painter, RenderOptions } from './painter';
import type { SourceCache } from '../source/source_cache';
import type { StyleLayer } from '../style/style_layer';
import type { OverscaledTileID } from '../source/tile_id';
export type DrawFunction = (painter: Painter, sourceCache: SourceCache, layer: StyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) => void;
export declare function registerDrawFunction(layerType: string, drawFn: DrawFunction): void;
export declare function getDrawFunction(layerType: string): DrawFunction | undefined;
export declare function isDrawFunctionRegistered(layerType: string): boolean;
//# sourceMappingURL=draw_registry.d.ts.map