import {type Feature, FeatureRegistry} from './feature';

let workerRegistry: FeatureRegistry | null = null;

/**
 * Initialize the worker runtime with the given features.
 * The worker uses the registry for worker source resolution and tile processing.
 */
export function createWorker(features: Feature[]): FeatureRegistry {
    workerRegistry = new FeatureRegistry(features);
    return workerRegistry;
}

/**
 * Get the worker registry. Throws if createWorker() hasn't been called.
 */
export function getWorkerRegistry(): FeatureRegistry {
    if (!workerRegistry) throw new Error('Worker not initialized. Call createWorker() first.');
    return workerRegistry;
}
