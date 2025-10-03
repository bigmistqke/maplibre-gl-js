import Point from '@mapbox/point-geometry';
export class Bounds {
    constructor() {
        this.minX = Infinity;
        this.maxX = -Infinity;
        this.minY = Infinity;
        this.maxY = -Infinity;
    }
    extend(point) {
        this.minX = Math.min(this.minX, point.x);
        this.minY = Math.min(this.minY, point.y);
        this.maxX = Math.max(this.maxX, point.x);
        this.maxY = Math.max(this.maxY, point.y);
        return this;
    }
    expandBy(amount) {
        this.minX -= amount;
        this.minY -= amount;
        this.maxX += amount;
        this.maxY += amount;
        if (this.minX > this.maxX || this.minY > this.maxY) {
            this.minX = Infinity;
            this.maxX = -Infinity;
            this.minY = Infinity;
            this.maxY = -Infinity;
        }
        return this;
    }
    shrinkBy(amount) {
        return this.expandBy(-amount);
    }
    map(fn) {
        const result = new Bounds();
        result.extend(fn(new Point(this.minX, this.minY)));
        result.extend(fn(new Point(this.maxX, this.minY)));
        result.extend(fn(new Point(this.minX, this.maxY)));
        result.extend(fn(new Point(this.maxX, this.maxY)));
        return result;
    }
    static fromPoints(points) {
        const result = new Bounds();
        for (const p of points) {
            result.extend(p);
        }
        return result;
    }
    contains(point) {
        return point.x >= this.minX && point.x <= this.maxX && point.y >= this.minY && point.y <= this.maxY;
    }
    empty() {
        return this.minX > this.maxX;
    }
    width() {
        return this.maxX - this.minX;
    }
    height() {
        return this.maxY - this.minY;
    }
    covers(other) {
        return !this.empty() && !other.empty() &&
            other.minX >= this.minX &&
            other.maxX <= this.maxX &&
            other.minY >= this.minY &&
            other.maxY <= this.maxY;
    }
    intersects(other) {
        return !this.empty() && !other.empty() &&
            other.minX <= this.maxX &&
            other.maxX >= this.minX &&
            other.minY <= this.maxY &&
            other.maxY >= this.minY;
    }
}
//# sourceMappingURL=bounds.js.map