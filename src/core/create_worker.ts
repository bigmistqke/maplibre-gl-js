import {type Feature, FeatureRegistry} from './feature';

/**
 * Initialize the worker runtime with the given features.
 * The worker uses the registry for worker source resolution and tile processing.
 */
export function createWorker(features: Feature[]) {
    const _registry = new FeatureRegistry(features);

    // TODO: Wire registry into worker runtime
    return _registry;
}
