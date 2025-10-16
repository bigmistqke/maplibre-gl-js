import {clamp, assertedNotNullish } from '../util/util';
import type Point from '@mapbox/point-geometry';

export class PathInterpolator {
    points: Array<Point> | undefined;
    length: number | undefined;
    paddedLength: number | undefined;
    padding: number | undefined;
    _distances: Array<number> | undefined;

    constructor(points_?: Array<Point> | null, padding_?: number | null) {
        this.reset(points_, padding_);
    }

    reset(points_?: Array<Point> | null, padding_?: number | null) {
        this.points = points_ || [];

        // Compute cumulative distance from first point to every other point in the segment.
        // Last entry in the array is total length of the path
        this._distances = [0.0];

        for (let i = 1; i < this.points.length; i++) {
            this._distances[i] = this._distances[i - 1] + this.points[i].dist(this.points[i - 1]);
        }

        this.length = this._distances[this._distances.length - 1];
        this.padding = Math.min(padding_ || 0, this.length * 0.5);
        this.paddedLength = this.length - this.padding * 2.0;
    }

    lerp(t: number): Point {
        if (assertedNotNullish(this.points).length === 1) {
            return assertedNotNullish(this.points)[0];
        }

        t = clamp(t, 0, 1);

        // Find the correct segment [p0, p1] where p0 <= x < p1
        let currentIndex = 1;
        let distOfCurrentIdx = assertedNotNullish(this._distances)[currentIndex];
        const distToTarget = t * assertedNotNullish(this.paddedLength) + assertedNotNullish(this.padding);

        while (distOfCurrentIdx < distToTarget && currentIndex < assertedNotNullish(this._distances).length) {
            distOfCurrentIdx = assertedNotNullish(this._distances)[++currentIndex];
        }

        // Interpolate between the two points of the segment
        const idxOfPrevPoint = currentIndex - 1;
        const distOfPrevIdx = assertedNotNullish(this._distances)[idxOfPrevPoint];
        const segmentLength = distOfCurrentIdx - distOfPrevIdx;
        const segmentT = segmentLength > 0 ? (distToTarget - distOfPrevIdx) / segmentLength : 0;

        return assertedNotNullish(this.points)[idxOfPrevPoint].mult(1.0 - segmentT).add(assertedNotNullish(this.points)[currentIndex].mult(segmentT));
    }
}
