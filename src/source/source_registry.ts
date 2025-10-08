import {registry} from '../registry';
import type {SourceClass} from './source';

/**
 * Get a source type by name
 * @param name - Source type name
 * @returns Source class or undefined if not registered
 */
export function getSource(name: string): SourceClass | undefined {
    return registry.source[name];
}
