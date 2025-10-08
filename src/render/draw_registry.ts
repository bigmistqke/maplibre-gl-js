import type {Painter, RenderOptions} from './painter';
import type {SourceCache} from '../source/source_cache';
import type {StyleLayer} from '../style/style_layer';
import type {OverscaledTileID} from '../source/tile_id';

/**
 * Draw function type - handles rendering for a specific layer type
 */
export type DrawFunction = (
    painter: Painter,
    sourceCache: SourceCache,
    layer: StyleLayer,
    coords: Array<OverscaledTileID>,
    renderOptions: RenderOptions
) => void;
