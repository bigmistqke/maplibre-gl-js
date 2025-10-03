import type { Bucket } from './bucket';
export type BucketFactory = (options: any) => Bucket;
export declare function registerBucketType(layerType: string, factory: BucketFactory): void;
export declare function getBucketFactory(layerType: string): BucketFactory | undefined;
export declare function isBucketTypeRegistered(layerType: string): boolean;
//# sourceMappingURL=bucket_registry.d.ts.map