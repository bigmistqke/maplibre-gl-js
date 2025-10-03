import type {Bucket} from './bucket';

/**
 * Bucket factory function type
 * Creates a bucket for a specific layer type
 */
export type BucketFactory = (options: any) => Bucket;

/**
 * Global bucket type registry for tree-shaking
 * Bucket types register themselves by importing their registration module
 */
const bucketRegistry = new Map<string, BucketFactory>();

/**
 * Register a bucket factory for a layer type
 * @param layerType - The layer type (e.g., 'symbol', 'fill', 'line')
 * @param factory - Factory function that creates the bucket
 */
export function registerBucketType(layerType: string, factory: BucketFactory): void {
    bucketRegistry.set(layerType, factory);
}

/**
 * Get a bucket factory from registry
 * @param layerType - The layer type to look up
 * @returns The factory function if registered, undefined otherwise
 */
export function getBucketFactory(layerType: string): BucketFactory | undefined {
    return bucketRegistry.get(layerType);
}

/**
 * Check if a bucket type is registered
 * @param layerType - The layer type to check
 * @returns True if the bucket type has been registered
 */
export function isBucketTypeRegistered(layerType: string): boolean {
    return bucketRegistry.has(layerType);
}
