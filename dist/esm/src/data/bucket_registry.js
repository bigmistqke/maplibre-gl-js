const bucketRegistry = new Map();
export function registerBucketType(layerType, factory) {
    bucketRegistry.set(layerType, factory);
}
export function getBucketFactory(layerType) {
    return bucketRegistry.get(layerType);
}
export function isBucketTypeRegistered(layerType) {
    return bucketRegistry.has(layerType);
}
//# sourceMappingURL=bucket_registry.js.map