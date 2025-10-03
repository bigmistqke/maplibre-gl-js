import type { CollisionBoxArray } from '../data/array_types.g';
import type { Anchor } from './anchor';
import { type SymbolPadding } from '../style/style_layer/symbol_style_layer';
export declare class CollisionFeature {
    boxStartIndex: number;
    boxEndIndex: number;
    circleDiameter: number;
    constructor(collisionBoxArray: CollisionBoxArray, anchor: Anchor, featureIndex: number, sourceLayerIndex: number, bucketIndex: number, shaped: any, boxScale: number, padding: SymbolPadding, alignLine: boolean, rotate: number);
}
//# sourceMappingURL=collision_feature.d.ts.map