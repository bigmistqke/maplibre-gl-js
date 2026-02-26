import {Map, type MapOptions} from '../ui/map';
import {type Feature, FeatureRegistry} from './feature';

export type CreateMapOptions = Omit<MapOptions, '_featureRegistry'> & {
    use: Feature[];
};

/**
 * Create a Map with pluggable features.
 * Merges all features into a FeatureRegistry and passes it to the Map constructor.
 */
export function createMap(options: CreateMapOptions): Map {
    const {use, ...mapOptions} = options;
    const registry = new FeatureRegistry(use);

    return new Map({
        ...mapOptions,
        _featureRegistry: registry,
    });
}
