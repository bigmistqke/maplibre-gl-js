import {type Feature, FeatureRegistry} from './feature';
import Worker from '../source/worker';
import {isWorker} from '../util/util';
import type {ActorTarget} from '../util/actor';
import type {WorkerGlobalScopeInterface} from '../util/web_worker';

let workerRegistry: FeatureRegistry | null = null;

/**
 * Initialize the worker runtime with the given features.
 * Creates the registry and, when running in a worker context,
 * instantiates the Worker and assigns it to `self.worker`.
 */
export function createWorker(features: Feature[]): FeatureRegistry {
    workerRegistry = new FeatureRegistry(features);
    if (isWorker(self)) {
        const workerSelf = self as unknown as WorkerGlobalScopeInterface & ActorTarget;
        workerSelf.worker = new Worker(workerSelf);
    }
    return workerRegistry;
}

/**
 * Get the worker registry. Throws if createWorker() hasn't been called.
 */
export function getWorkerRegistry(): FeatureRegistry {
    if (!workerRegistry) throw new Error('Worker not initialized. Call createWorker() first.');
    return workerRegistry;
}
