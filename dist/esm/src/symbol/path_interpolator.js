import { clamp } from '../util/util';
export class PathInterpolator {
    constructor(points_, padding_) {
        this.reset(points_, padding_);
    }
    reset(points_, padding_) {
        this.points = points_ || [];
        this._distances = [0.0];
        for (let i = 1; i < this.points.length; i++) {
            this._distances[i] = this._distances[i - 1] + this.points[i].dist(this.points[i - 1]);
        }
        this.length = this._distances[this._distances.length - 1];
        this.padding = Math.min(padding_ || 0, this.length * 0.5);
        this.paddedLength = this.length - this.padding * 2.0;
    }
    lerp(t) {
        if (this.points.length === 1) {
            return this.points[0];
        }
        t = clamp(t, 0, 1);
        let currentIndex = 1;
        let distOfCurrentIdx = this._distances[currentIndex];
        const distToTarget = t * this.paddedLength + this.padding;
        while (distOfCurrentIdx < distToTarget && currentIndex < this._distances.length) {
            distOfCurrentIdx = this._distances[++currentIndex];
        }
        const idxOfPrevPoint = currentIndex - 1;
        const distOfPrevIdx = this._distances[idxOfPrevPoint];
        const segmentLength = distOfCurrentIdx - distOfPrevIdx;
        const segmentT = segmentLength > 0 ? (distToTarget - distOfPrevIdx) / segmentLength : 0;
        return this.points[idxOfPrevPoint].mult(1.0 - segmentT).add(this.points[currentIndex].mult(segmentT));
    }
}
//# sourceMappingURL=path_interpolator.js.map