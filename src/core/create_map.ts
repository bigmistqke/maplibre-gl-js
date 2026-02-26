import {Map, type MapOptions} from '../ui/map';
import {type Feature, mergeFeatures} from './feature';

export type CreateMapOptions = Omit<MapOptions, '_featureConfig'> & {
    use: Feature[];
};

/**
 * Create a Map with pluggable features.
 * Merges all features and passes the merged config to the Map constructor.
 */
export function createMap(options: CreateMapOptions): Map {
    const {use, ...mapOptions} = options;
    const featureConfig = mergeFeatures(use);

    return new Map({
        ...mapOptions,
        _featureConfig: featureConfig,
    });
}
