import Queue from 'tinyqueue';
import Point from '@mapbox/point-geometry';
import { distToSegmentSquared } from './intersection_tests';
import { Bounds } from '../geo/bounds';
export function findPoleOfInaccessibility(polygonRings, precision = 1, debug = false) {
    const bounds = Bounds.fromPoints(polygonRings[0]);
    const cellSize = Math.min(bounds.width(), bounds.height());
    let h = cellSize / 2;
    const cellQueue = new Queue([], compareMax);
    const { minX, minY, maxX, maxY } = bounds;
    if (cellSize === 0)
        return new Point(minX, minY);
    for (let x = minX; x < maxX; x += cellSize) {
        for (let y = minY; y < maxY; y += cellSize) {
            cellQueue.push(new Cell(x + h, y + h, h, polygonRings));
        }
    }
    let bestCell = getCentroidCell(polygonRings);
    let numProbes = cellQueue.length;
    while (cellQueue.length) {
        const cell = cellQueue.pop();
        if (cell.d > bestCell.d || !bestCell.d) {
            bestCell = cell;
            if (debug)
                console.log('found best %d after %d probes', Math.round(1e4 * cell.d) / 1e4, numProbes);
        }
        if (cell.max - bestCell.d <= precision)
            continue;
        h = cell.h / 2;
        cellQueue.push(new Cell(cell.p.x - h, cell.p.y - h, h, polygonRings));
        cellQueue.push(new Cell(cell.p.x + h, cell.p.y - h, h, polygonRings));
        cellQueue.push(new Cell(cell.p.x - h, cell.p.y + h, h, polygonRings));
        cellQueue.push(new Cell(cell.p.x + h, cell.p.y + h, h, polygonRings));
        numProbes += 4;
    }
    if (debug) {
        console.log(`num probes: ${numProbes}`);
        console.log(`best distance: ${bestCell.d}`);
    }
    return bestCell.p;
}
function compareMax(a, b) {
    return b.max - a.max;
}
function Cell(x, y, h, polygon) {
    this.p = new Point(x, y);
    this.h = h;
    this.d = pointToPolygonDist(this.p, polygon);
    this.max = this.d + this.h * Math.SQRT2;
}
function pointToPolygonDist(p, polygon) {
    let inside = false;
    let minDistSq = Infinity;
    for (let k = 0; k < polygon.length; k++) {
        const ring = polygon[k];
        for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
            const a = ring[i];
            const b = ring[j];
            if ((a.y > p.y !== b.y > p.y) &&
                (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x))
                inside = !inside;
            minDistSq = Math.min(minDistSq, distToSegmentSquared(p, a, b));
        }
    }
    return (inside ? 1 : -1) * Math.sqrt(minDistSq);
}
function getCentroidCell(polygon) {
    let area = 0;
    let x = 0;
    let y = 0;
    const points = polygon[0];
    for (let i = 0, len = points.length, j = len - 1; i < len; j = i++) {
        const a = points[i];
        const b = points[j];
        const f = a.x * b.y - b.x * a.y;
        x += (a.x + b.x) * f;
        y += (a.y + b.y) * f;
        area += f * 3;
    }
    return new Cell(x / area, y / area, 0, polygon);
}
//# sourceMappingURL=find_pole_of_inaccessibility.js.map