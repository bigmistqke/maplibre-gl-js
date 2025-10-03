import { type Point2D } from '@maplibre/maplibre-gl-style-spec';
export interface ReadOnlyBounds {
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
    contains(point: Point2D): boolean;
    empty(): boolean;
    width(): number;
    height(): number;
    covers(other: ReadOnlyBounds): boolean;
    intersects(other: ReadOnlyBounds): boolean;
}
export declare class Bounds implements ReadOnlyBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    extend(point: Point2D): this;
    expandBy(amount: number): this;
    shrinkBy(amount: number): this;
    map(fn: (point: Point2D) => Point2D): Bounds;
    static fromPoints(points: Point2D[]): Bounds;
    contains(point: Point2D): boolean;
    empty(): boolean;
    width(): number;
    height(): number;
    covers(other: ReadOnlyBounds): boolean;
    intersects(other: ReadOnlyBounds): boolean;
}
//# sourceMappingURL=bounds.d.ts.map