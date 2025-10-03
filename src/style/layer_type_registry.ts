import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {StyleLayer} from './style_layer';

/**
 * Layer factory function type for registry
 * Factory receives layer spec and global state, returns a StyleLayer instance
 */
export type LayerFactory = (layer: LayerSpecification, globalState: Record<string, any>) => StyleLayer;

/**
 * Global layer type registry for tree-shaking
 * Layer types register themselves by importing their registration module
 */
const layerTypeRegistry = new Map<string, LayerFactory>();

/**
 * Register a layer type factory
 * @param type - The layer type (e.g., 'symbol', 'fill', 'line')
 * @param factory - Factory function that creates the layer
 */
export function registerLayerType(type: string, factory: LayerFactory): void {
    layerTypeRegistry.set(type, factory);
}

/**
 * Get a layer factory from registry
 * @param type - The layer type to look up
 * @returns The factory function if registered, undefined otherwise
 */
export function getLayerFactory(type: string): LayerFactory | undefined {
    return layerTypeRegistry.get(type);
}

/**
 * Check if a layer type is registered
 * @param type - The layer type to check
 * @returns True if the layer type has been registered
 */
export function isLayerTypeRegistered(type: string): boolean {
    return layerTypeRegistry.has(type);
}
