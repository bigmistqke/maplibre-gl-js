import {type Feature, mergeFeatures} from './feature';

/**
 * Initialize the worker runtime with the given features.
 * The worker uses the merged config for worker source resolution and tile processing.
 */
export function createWorker(features: Feature[]) {
    const _config = mergeFeatures(features);

    // TODO: Wire merged config into worker runtime
    // For now this is a placeholder that will be wired up
    // when the worker source resolution is refactored.
    return _config;
}
