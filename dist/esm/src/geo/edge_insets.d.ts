import Point from '@mapbox/point-geometry';
import { type Complete, type RequireAtLeastOne } from '../util/util';
export declare class EdgeInsets {
    top: number;
    bottom: number;
    left: number;
    right: number;
    constructor(top?: number, bottom?: number, left?: number, right?: number);
    interpolate(start: PaddingOptions | EdgeInsets, target: PaddingOptions, t: number): EdgeInsets;
    getCenter(width: number, height: number): Point;
    equals(other: PaddingOptions): boolean;
    clone(): EdgeInsets;
    toJSON(): Complete<PaddingOptions>;
}
export type PaddingOptions = RequireAtLeastOne<{
    top: number;
    bottom: number;
    right: number;
    left: number;
}>;
//# sourceMappingURL=edge_insets.d.ts.map