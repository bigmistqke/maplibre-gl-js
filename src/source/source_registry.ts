import type {SourceClass} from './source';

/**
 * Source registry for tree-shaking
 * Sources register themselves when imported
 */
const sourceRegistry: Record<string, SourceClass> = {};

/**
 * Register a source type
 * @param name - Source type name (e.g., 'vector', 'raster', 'geojson')
 * @param sourceClass - Source class constructor
 */
export function registerSource(name: string, sourceClass: SourceClass): void {
    sourceRegistry[name] = sourceClass;
}

/**
 * Get a source type by name
 * @param name - Source type name
 * @returns Source class or undefined if not registered
 */
export function getSource(name: string): SourceClass | undefined {
    return sourceRegistry[name];
}
