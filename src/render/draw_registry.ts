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

/**
 * Global draw function registry for tree-shaking
 * Draw functions register themselves by importing their registration module
 */
const drawRegistry = new Map<string, DrawFunction>();

/**
 * Register a draw function for a layer type
 * @param layerType - The layer type (e.g., 'symbol', 'fill', 'line')
 * @param drawFn - Function that renders the layer
 */
export function registerDrawFunction(layerType: string, drawFn: DrawFunction): void {
    drawRegistry.set(layerType, drawFn);
}

/**
 * Get a draw function from registry
 * @param layerType - The layer type to look up
 * @returns The draw function if registered, undefined otherwise
 */
export function getDrawFunction(layerType: string): DrawFunction | undefined {
    return drawRegistry.get(layerType);
}

/**
 * Check if a draw function is registered for a layer type
 * @param layerType - The layer type to check
 * @returns True if a draw function has been registered
 */
export function isDrawFunctionRegistered(layerType: string): boolean {
    return drawRegistry.has(layerType);
}
