import earcut from 'earcut'
import Point from '@mapbox/point-geometry'
import type { SubdivisionGranularityExpression } from './subdivision_granularity_settings'
export { SubdivisionGranularitySetting, SubdivisionGranularityExpression } from './subdivision_granularity_settings'

// Mini uses 4096 tile extent (MVT default); MapLibre uses 8192
const EXTENT = 4096

// Minimal CanonicalTileID stub matching MapLibre's interface
interface CanonicalTileID { z: number; x: number; y: number }

type SubdivisionResult = {
    verticesFlattened: Array<number>;
    indicesTriangles: Array<number>;

    /**
     * An array of arrays of indices of subdivided lines for polygon outlines.
     * Each array of lines corresponds to one ring of the original polygon.
     */
    indicesLineList: Array<Array<number>>;
};

// Special pole vertices have coordinates -32768,-32768 for the north pole and 32767,32767 for the south pole.
// First, find any *non-pole* vertices at those coordinates and move them slightly elsewhere.
export const NORTH_POLE_Y = -32768;
export const SOUTH_POLE_Y = 32767;

class Subdivider {
    /**
     * Flattened vertex positions (xyxyxy).
     */
    private _vertexBuffer: Array<number> = [];

    /**
     * Map of "vertex x and y coordinate" to "index of such vertex".
     */
    private _vertexDictionary: Map<number, number> = new Map<number, number>();
    private _used: boolean = false;

    private readonly _canonical: CanonicalTileID;

    private readonly _granularity;
    private readonly _granularityCellSize;

    constructor(granularity: number, canonical: CanonicalTileID) {
        this._granularity = granularity;
        this._granularityCellSize = EXTENT / granularity;
        this._canonical = canonical;
    }

    private _getKey(x: number, y: number) {
        // Assumes signed 16 bit positions.
        x = x + 32768;
        y = y + 32768;
        return (x << 16) | (y << 0);
    }

    /**
     * Returns an index into the internal vertex buffer for a vertex at the given coordinates.
     * If the internal vertex buffer contains no such vertex, then it is added.
     */
    private _vertexToIndex(x: number, y: number): number {
        if (x < -32768 || y < -32768 || x > 32767 || y > 32767) {
            throw new Error('Vertex coordinates are out of signed 16 bit integer range.');
        }
        const xInt = Math.round(x) | 0;
        const yInt = Math.round(y) | 0;
        const key = this._getKey(xInt, yInt);
        if (this._vertexDictionary.has(key)) {
            return this._vertexDictionary.get(key);
        }
        const index = this._vertexBuffer.length / 2;
        this._vertexDictionary.set(key, index);
        this._vertexBuffer.push(xInt, yInt);
        return index;
    }

    /**
     * Subdivides a polygon by iterating over rows of granularity subdivision cells and splitting each row along vertical subdivision axes.
     * @param inputIndices - Indices into the internal vertex buffer of the triangulated polygon (after running `earcut`).
     * @returns Indices into the internal vertex buffer for triangles that are a subdivision of the input geometry.
     */
    private _subdivideTrianglesScanline(inputIndices: Array<number>): Array<number> {
        // A granularity cell is the square space between axes that subdivide geometry.
        // For granularity 8, cells would be 1024 by 1024 units.
        // For each triangle, we iterate over all cell rows it intersects, and generate subdivided geometry
        // only within one cell row at a time. This way, we implicitly subdivide along the X-parallel axes (cell row boundaries).
        // For each cell row, we generate an ordered point ring that describes the subdivided geometry inside this row (an intersection of the triangle and a given cell row).
        // Such ordered ring can be trivially triangulated.
        // Each ring may consist of sections of triangle edges that lie inside the cell row, and cell boundaries that lie inside the triangle. Both must be further subdivided along Y-parallel axes.
        // Most complexity of this function comes from generating correct vertex rings, and from placing the vertices into the ring in the correct order.

        if (this._granularity < 2) {
            // The actual subdivision code always produces triangles with the correct winding order.
            // Also apply winding order correction when skipping subdivision altogether to maintain consistency.
            return fixWindingOrder(this._vertexBuffer, inputIndices);
        }

        const finalIndices = [];

        // Iterate over all input triangles
        const numIndices = inputIndices.length;
        for (let primitiveIndex = 0; primitiveIndex < numIndices; primitiveIndex += 3) {
            const triangleIndices: [number, number, number] = [
                inputIndices[primitiveIndex + 0], // v0
                inputIndices[primitiveIndex + 1], // v1
                inputIndices[primitiveIndex + 2], // v2
            ];

            const triangleVertices: [number, number, number, number, number, number] = [
                this._vertexBuffer[inputIndices[primitiveIndex + 0] * 2 + 0], // v0.x
                this._vertexBuffer[inputIndices[primitiveIndex + 0] * 2 + 1], // v0.y
                this._vertexBuffer[inputIndices[primitiveIndex + 1] * 2 + 0], // v1.x
                this._vertexBuffer[inputIndices[primitiveIndex + 1] * 2 + 1], // v1.y
                this._vertexBuffer[inputIndices[primitiveIndex + 2] * 2 + 0], // v2.x
                this._vertexBuffer[inputIndices[primitiveIndex + 2] * 2 + 1], // v2.y
            ];

            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;

            // Compute AABB
            for (let i = 0; i < 3; i++) {
                const vx = triangleVertices[i * 2];
                const vy = triangleVertices[i * 2 + 1];
                minX = Math.min(minX, vx);
                maxX = Math.max(maxX, vx);
                minY = Math.min(minY, vy);
                maxY = Math.max(maxY, vy);
            }

            if (minX === maxX || minY === maxY) {
                continue; // Skip degenerate linear axis-aligned triangles
            }

            const cellXmin = Math.floor(minX / this._granularityCellSize);
            const cellXmax = Math.ceil(maxX / this._granularityCellSize);
            const cellYmin = Math.floor(minY / this._granularityCellSize);
            const cellYmax = Math.ceil(maxY / this._granularityCellSize);

            // Skip subdividing triangles that do not span multiple cells - just add them "as is".
            if (cellXmin === cellXmax && cellYmin === cellYmax) {
                finalIndices.push(...triangleIndices);
                continue;
            }

            // Iterate over cell rows that intersect this triangle
            for (let cellRow = cellYmin; cellRow < cellYmax; cellRow++) {
                const ring = this._scanlineGenerateVertexRingForCellRow(cellRow, triangleVertices, triangleIndices);
                scanlineTriangulateVertexRing(this._vertexBuffer, ring, finalIndices);
            }
        }

        return finalIndices;
    }

    /**
     * Takes a triangle and a cell row index, returns a subdivided vertex ring of the intersection of the triangle and the cell row.
     * @param cellRow - Index of the cell row. A cell row of index `i` covert range from `i * granularityCellSize` to `(i + 1) * granularityCellSize`.
     * @param triangleVertices - An array of 6 elements, contains flattened positions of the triangle's vertices: `[v0x, v0y, v1x, v1y, v2x, v2y]`.
     * @param triangleIndices - An array of 3 elements, contains the original indices of the triangle's vertices: `[index0, index1, index2]`.
     * @returns The resulting ring of vertex indices and the index (to the returned ring array) of the leftmost vertex in the ring.
     */
    private _scanlineGenerateVertexRingForCellRow(
        cellRow: number,
        triangleVertices: [number, number, number, number, number, number],
        triangleIndices: [number, number, number]
    ) {
        const cellRowYTop = cellRow * this._granularityCellSize;
        const cellRowYBottom = cellRowYTop + this._granularityCellSize;
        const ring = [];

        // Generate the vertex ring
        for (let edgeIndex = 0; edgeIndex < 3; edgeIndex++) {
            // Current edge that will be subdivided: a --> b
            // The remaining vertex of the triangle: c
            const aX = triangleVertices[edgeIndex * 2];
            const aY = triangleVertices[edgeIndex * 2 + 1];
            const bX = triangleVertices[((edgeIndex + 1) * 2) % 6];
            const bY = triangleVertices[((edgeIndex + 1) * 2 + 1) % 6];
            const cX = triangleVertices[((edgeIndex + 2) * 2) % 6];
            const cY = triangleVertices[((edgeIndex + 2) * 2 + 1) % 6];
            // Edge direction
            const dirX = bX - aX;
            const dirY = bY - aY;

            // Edges parallel with either axis will need special handling later.
            const isParallelY = dirX === 0;
            const isParallelX = dirY === 0;

            // Distance along edge where it enters/exits current cell row,
            // where distance 0 is the edge start point, 1 the endpoint, 0.5 the mid point, etc.
            const tTop = (cellRowYTop - aY) / dirY;
            const tBottom = (cellRowYBottom - aY) / dirY;
            const tEnter = Math.min(tTop, tBottom);
            const tExit = Math.max(tTop, tBottom);

            // Determine if edge lies entirely outside this cell row.
            // Check entry and exit points, or if edge is parallel with X, check its Y coordinate.
            if ((!isParallelX && (tEnter >= 1 || tExit <= 0)) ||
                (isParallelX && (aY < cellRowYTop || aY > cellRowYBottom))) {
                // Skip this edge
                // But make sure to add its endpoint vertex if needed.
                if (bY >= cellRowYTop && bY <= cellRowYBottom) {
                    // The edge endpoint is withing this row, add it to the ring
                    ring.push(triangleIndices[(edgeIndex + 1) % 3]);
                }
                continue;
            }

            // Do not add original triangle vertices now, those are handled separately later

            // Special case: edge vertex for entry into cell row
            // If edge is parallel with X axis, there is no entry vertex
            if (!isParallelX && tEnter > 0) {
                const x = aX + dirX * tEnter;
                const y = aY + dirY * tEnter;
                ring.push(this._vertexToIndex(x, y));
            }

            // The X coordinates of the points where the edge enters/exits the current cell row,
            // or the edge start/endpoint, if the entry/exit happens beyond the edge bounds.
            const enterX = aX + dirX * Math.max(tEnter, 0);
            const exitX = aX + dirX * Math.min(tExit, 1);

            // Generate edge interior vertices
            // No need to subdivide (along X) edges that are parallel with Y
            if (!isParallelY) {
                this._generateIntraEdgeVertices(ring, aX, aY, bX, bY, enterX, exitX);
            }

            // Special case: edge vertex for exit from cell row
            if (!isParallelX && tExit < 1) {
                const x = aX + dirX * tExit;
                const y = aY + dirY * tExit;
                ring.push(this._vertexToIndex(x, y));
            }

            // Add endpoint vertex
            if (isParallelX || (bY >= cellRowYTop && bY <= cellRowYBottom)) {
                ring.push(triangleIndices[(edgeIndex + 1) % 3]);
            }
            // Any edge that has endpoint outside this row or on its boundary gets
            // inter-edge vertices.
            // No row boundary to split for edges parallel with X
            if (!isParallelX && (bY <= cellRowYTop || bY >= cellRowYBottom)) {
                this._generateInterEdgeVertices(ring, aX, aY, bX, bY, cX, cY,
                    exitX, cellRowYTop, cellRowYBottom);
            }
        }

        return ring;
    }

    /**
     * Generates ring vertices along an edge A-\>B, but only in the part that intersects a given cell row.
     * Does not handle adding edge endpoint vertices or edge cell row enter/exit vertices.
     * @param ring - Ordered array of vertex indices for the constructed ring. New indices are placed here.
     * @param enterX - The X coordinate of the point where edge A-\>B enters the current cell row.
     * @param exitX - The X coordinate of the point where edge A-\>B exits the current cell row.
     */
    private _generateIntraEdgeVertices(
        ring: Array<number>,
        aX: number,
        aY: number,
        bX: number,
        bY: number,
        enterX: number,
        exitX: number
    ): void {
        const dirX = bX - aX;
        const dirY = bY - aY;
        const isParallelX = dirY === 0;

        const leftX = isParallelX ? Math.min(aX, bX) : Math.min(enterX, exitX);
        const rightX = isParallelX ? Math.max(aX, bX) : Math.max(enterX, exitX);

        const edgeSubdivisionLeftCellX = Math.floor(leftX / this._granularityCellSize) + 1;
        const edgeSubdivisionRightCellX = Math.ceil(rightX / this._granularityCellSize) - 1;

        const isEdgeLeftToRight = isParallelX ? (aX < bX) : (enterX < exitX);
        if (isEdgeLeftToRight) {
            // Left to right
            for (let cellX = edgeSubdivisionLeftCellX; cellX <= edgeSubdivisionRightCellX; cellX++) {
                const x = cellX * this._granularityCellSize;
                const y = aY + dirY * (x - aX) / dirX;
                ring.push(this._vertexToIndex(x, y));
            }
        } else {
            // Right to left
            for (let cellX = edgeSubdivisionRightCellX; cellX >= edgeSubdivisionLeftCellX; cellX--) {
                const x = cellX * this._granularityCellSize;
                const y = aY + dirY * (x - aX) / dirX;
                ring.push(this._vertexToIndex(x, y));
            }
        }
    }

    /**
     * Generates ring vertices along cell border.
     * Call when processing an edge A-\>B that exits the current row (B lies outside the current row).
     */
    private _generateInterEdgeVertices(
        ring: Array<number>,
        aX: number,
        aY: number,
        bX: number,
        bY: number,
        cX: number,
        cY: number,
        exitX: number,
        cellRowYTop: number,
        cellRowYBottom: number
    ): void {
        const dirY = bY - aY;

        const dir2X = cX - bX;
        const dir2Y = cY - bY;
        const t2Top = (cellRowYTop - bY) / dir2Y;
        const t2Bottom = (cellRowYBottom - bY) / dir2Y;
        const t2Enter = Math.min(t2Top, t2Bottom);
        const t2Exit = Math.max(t2Top, t2Bottom);
        const enter2X = bX + dir2X * t2Enter;
        let boundarySubdivisionLeftCellX = Math.floor(Math.min(enter2X, exitX) / this._granularityCellSize) + 1;
        let boundarySubdivisionRightCellX = Math.ceil(Math.max(enter2X, exitX) / this._granularityCellSize) - 1;
        let isBoundaryLeftToRight = exitX < enter2X;

        const isParallelX2 = dir2Y === 0;

        if (isParallelX2 && (cY === cellRowYTop || cY === cellRowYBottom)) {
            return;
        }

        if (isParallelX2 || t2Enter >= 1 || t2Exit <= 0) {
            const dir3X = aX - cX;
            const dir3Y = aY - cY;
            const t3Top = (cellRowYTop - cY) / dir3Y;
            const t3Bottom = (cellRowYBottom - cY) / dir3Y;
            const t3Enter = Math.min(t3Top, t3Bottom);
            const enter3X = cX + dir3X * t3Enter;

            boundarySubdivisionLeftCellX = Math.floor(Math.min(enter3X, exitX) / this._granularityCellSize) + 1;
            boundarySubdivisionRightCellX = Math.ceil(Math.max(enter3X, exitX) / this._granularityCellSize) - 1;
            isBoundaryLeftToRight = exitX < enter3X;
        }

        const boundaryY = dirY > 0 ? cellRowYBottom : cellRowYTop;
        if (isBoundaryLeftToRight) {
            // Left to right
            for (let cellX = boundarySubdivisionLeftCellX; cellX <= boundarySubdivisionRightCellX; cellX++) {
                const x = cellX * this._granularityCellSize;
                ring.push(this._vertexToIndex(x, boundaryY));
            }
        } else {
            // Right to left
            for (let cellX = boundarySubdivisionRightCellX; cellX >= boundarySubdivisionLeftCellX; cellX--) {
                const x = cellX * this._granularityCellSize;
                ring.push(this._vertexToIndex(x, boundaryY));
            }
        }
    }

    /**
     * Generates an outline for a given polygon, returns a list of arrays of line indices.
     */
    private _generateOutline(polygon: Array<Array<Point>>): Array<Array<number>> {
        const subdividedLines: Array<Array<number>> = [];
        for (const ring of polygon) {
            const line = subdivideVertexLine(ring, this._granularity, true);
            const pathIndices = this._pointArrayToIndices(line);
            const lineIndices: Array<number> = [];
            for (let i = 1; i < pathIndices.length; i++) {
                lineIndices.push(pathIndices[i - 1]);
                lineIndices.push(pathIndices[i]);
            }
            subdividedLines.push(lineIndices);
        }
        return subdividedLines;
    }

    /**
     * Adds pole geometry if needed.
     * @param subdividedTriangles - Array of generated triangle indices, new pole geometry is appended here.
     */
    private _handlePoles(subdividedTriangles: Array<number>) {
        let north = false;
        let south = false;
        if (this._canonical) {
            if (this._canonical.y === 0) {
                north = true;
            }
            if (this._canonical.y === (1 << this._canonical.z) - 1) {
                south = true;
            }
        }
        if (north || south) {
            this._fillPoles(subdividedTriangles, north, south);
        }
    }

    /**
     * Checks the internal vertex buffer for all vertices that might lie on the special pole coordinates and shifts them by one unit.
     */
    private _ensureNoPoleVertices() {
        const flattened = this._vertexBuffer;

        for (let i = 0; i < flattened.length; i += 2) {
            const vy = flattened[i + 1];
            if (vy === NORTH_POLE_Y) {
                flattened[i + 1] = NORTH_POLE_Y + 1;
            }
            if (vy === SOUTH_POLE_Y) {
                flattened[i + 1] = SOUTH_POLE_Y - 1;
            }
        }
    }

    private _generatePoleQuad(indices, i0, i1, v0x, v1x, poleY): void {
        const flip = (v0x > v1x) !== (poleY === NORTH_POLE_Y);

        if (flip) {
            indices.push(i0);
            indices.push(i1);
            indices.push(this._vertexToIndex(v0x, poleY));

            indices.push(i1);
            indices.push(this._vertexToIndex(v1x, poleY));
            indices.push(this._vertexToIndex(v0x, poleY));
        } else {
            indices.push(i1);
            indices.push(i0);
            indices.push(this._vertexToIndex(v0x, poleY));

            indices.push(this._vertexToIndex(v1x, poleY));
            indices.push(i1);
            indices.push(this._vertexToIndex(v0x, poleY));
        }
    }

    private _fillPoles(indices: Array<number>, north: boolean, south: boolean): void {
        const flattened = this._vertexBuffer;

        const northEdge = 0;
        const southEdge = EXTENT;

        const numIndices = indices.length;
        for (let primitiveIndex = 2; primitiveIndex < numIndices; primitiveIndex += 3) {
            const i0 = indices[primitiveIndex - 2];
            const i1 = indices[primitiveIndex - 1];
            const i2 = indices[primitiveIndex];
            const v0x = flattened[i0 * 2];
            const v0y = flattened[i0 * 2 + 1];
            const v1x = flattened[i1 * 2];
            const v1y = flattened[i1 * 2 + 1];
            const v2x = flattened[i2 * 2];
            const v2y = flattened[i2 * 2 + 1];

            if (north) {
                if (v0y === northEdge && v1y === northEdge) {
                    this._generatePoleQuad(indices, i0, i1, v0x, v1x, NORTH_POLE_Y);
                }
                if (v1y === northEdge && v2y === northEdge) {
                    this._generatePoleQuad(indices, i1, i2, v1x, v2x, NORTH_POLE_Y);
                }
                if (v2y === northEdge && v0y === northEdge) {
                    this._generatePoleQuad(indices, i2, i0, v2x, v0x, NORTH_POLE_Y);
                }
            }
            if (south) {
                if (v0y === southEdge && v1y === southEdge) {
                    this._generatePoleQuad(indices, i0, i1, v0x, v1x, SOUTH_POLE_Y);
                }
                if (v1y === southEdge && v2y === southEdge) {
                    this._generatePoleQuad(indices, i1, i2, v1x, v2x, SOUTH_POLE_Y);
                }
                if (v2y === southEdge && v0y === southEdge) {
                    this._generatePoleQuad(indices, i2, i0, v2x, v0x, SOUTH_POLE_Y);
                }
            }
        }
    }

    private _initializeVertices(flattened: Array<number>) {
        for (let i = 0; i < flattened.length; i += 2) {
            this._vertexToIndex(flattened[i], flattened[i + 1]);
        }
    }

    public subdividePolygonInternal(polygon: Array<Array<Point>>, generateOutlineLines: boolean): SubdivisionResult {
        if (this._used) {
            throw new Error('Subdivision: multiple use not allowed.');
        }
        this._used = true;

        const {flattened, holeIndices} = flatten(polygon);
        this._initializeVertices(flattened);

        let subdividedTriangles: Array<number>;
        try {
            const earcutResult = earcut(flattened, holeIndices);
            const cut = this._convertIndices(flattened, earcutResult);
            subdividedTriangles = this._subdivideTrianglesScanline(cut);
        } catch (e) {
            console.error(e);
        }

        let subdividedLines: Array<Array<number>> = [];
        if (generateOutlineLines) {
            subdividedLines = this._generateOutline(polygon);
        }

        this._ensureNoPoleVertices();
        this._handlePoles(subdividedTriangles);

        return {
            verticesFlattened: this._vertexBuffer,
            indicesTriangles: subdividedTriangles,
            indicesLineList: subdividedLines,
        };
    }

    private _convertIndices(vertices: Array<number>, oldIndices: Array<number>): Array<number> {
        const newIndices = [];
        for (let i = 0; i < oldIndices.length; i++) {
            const x = vertices[oldIndices[i] * 2];
            const y = vertices[oldIndices[i] * 2 + 1];
            newIndices.push(this._vertexToIndex(x, y));
        }
        return newIndices;
    }

    private _pointArrayToIndices(array: Array<Point>): Array<number> {
        const indices = [];
        for (let i = 0; i < array.length; i++) {
            const p = array[i];
            indices.push(this._vertexToIndex(p.x, p.y));
        }
        return indices;
    }
}

/**
 * Subdivides a polygon to a given granularity.
 */
export function subdividePolygon(polygon: Array<Array<Point>>, canonical: CanonicalTileID, granularity: number, generateOutlineLines: boolean = true): SubdivisionResult {
    const subdivider = new Subdivider(granularity, canonical);
    return subdivider.subdividePolygonInternal(polygon, generateOutlineLines);
}

/**
 * Subdivides a line represented by an array of points.
 */
export function subdivideVertexLine(linePoints: Array<Point>, granularity: number, isRing: boolean = false): Array<Point> {
    if (!linePoints || linePoints.length < 1) {
        return [];
    }

    if (linePoints.length < 2) {
        return [];
    }

    const first = linePoints[0];
    const last = linePoints[linePoints.length - 1];
    const addLastToFirstSegment = isRing && (first.x !== last.x || first.y !== last.y);

    if (granularity < 2) {
        if (addLastToFirstSegment) {
            return [...linePoints, linePoints[0]];
        } else {
            return [...linePoints];
        }
    }

    const cellSize = Math.floor(EXTENT / granularity);
    const finalLineVertices: Array<Point> = [];

    finalLineVertices.push(new Point(linePoints[0].x, linePoints[0].y));

    const totalPoints = linePoints.length;
    const lastIndex = addLastToFirstSegment ? totalPoints : (totalPoints - 1);
    for (let pointIndex = 0; pointIndex < lastIndex; pointIndex++) {
        const linePoint0 = linePoints[pointIndex];
        const linePoint1 = pointIndex < (totalPoints - 1) ? linePoints[pointIndex + 1] : linePoints[0];
        const lineVertex0x = linePoint0.x;
        const lineVertex0y = linePoint0.y;
        const lineVertex1x = linePoint1.x;
        const lineVertex1y = linePoint1.y;

        const dirXnonZero = lineVertex0x !== lineVertex1x;
        const dirYnonZero = lineVertex0y !== lineVertex1y;

        if (!dirXnonZero && !dirYnonZero) {
            continue;
        }

        const dirX = lineVertex1x - lineVertex0x;
        const dirY = lineVertex1y - lineVertex0y;
        const absDirX = Math.abs(dirX);
        const absDirY = Math.abs(dirY);

        let lastPointX = lineVertex0x;
        let lastPointY = lineVertex0y;

        while (true) {
            const nextBoundaryX = dirX > 0 ?
                ((Math.floor(lastPointX / cellSize) + 1) * cellSize) :
                ((Math.ceil(lastPointX / cellSize) - 1) * cellSize);
            const nextBoundaryY = dirY > 0 ?
                ((Math.floor(lastPointY / cellSize) + 1) * cellSize) :
                ((Math.ceil(lastPointY / cellSize) - 1) * cellSize);
            const axisDistanceToBoundaryX = Math.abs(lastPointX - nextBoundaryX);
            const axisDistanceToBoundaryY = Math.abs(lastPointY - nextBoundaryY);

            const axisDistanceToEndX = Math.abs(lastPointX - lineVertex1x);
            const axisDistanceToEndY = Math.abs(lastPointY - lineVertex1y);

            const realDistanceToBoundaryX = dirXnonZero ? axisDistanceToBoundaryX / absDirX : Number.POSITIVE_INFINITY;
            const realDistanceToBoundaryY = dirYnonZero ? axisDistanceToBoundaryY / absDirY : Number.POSITIVE_INFINITY;

            if ((axisDistanceToEndX <= axisDistanceToBoundaryX || !dirXnonZero) &&
            (axisDistanceToEndY <= axisDistanceToBoundaryY || !dirYnonZero)) {
                break;
            }

            if ((realDistanceToBoundaryX < realDistanceToBoundaryY && dirXnonZero) || !dirYnonZero) {
                lastPointX = nextBoundaryX;
                lastPointY = lastPointY + dirY * realDistanceToBoundaryX;
                const next = new Point(lastPointX, Math.round(lastPointY));

                if (finalLineVertices[finalLineVertices.length - 1].x !== next.x ||
                    finalLineVertices[finalLineVertices.length - 1].y !== next.y) {
                    finalLineVertices.push(next);
                }
            } else {
                lastPointX = lastPointX + dirX * realDistanceToBoundaryY;
                lastPointY = nextBoundaryY;
                const next = new Point(Math.round(lastPointX), lastPointY);

                if (finalLineVertices[finalLineVertices.length - 1].x !== next.x ||
                    finalLineVertices[finalLineVertices.length - 1].y !== next.y) {
                    finalLineVertices.push(next);
                }
            }
        }

        const last = new Point(lineVertex1x, lineVertex1y);
        if (finalLineVertices[finalLineVertices.length - 1].x !== last.x ||
            finalLineVertices[finalLineVertices.length - 1].y !== last.y) {
            finalLineVertices.push(last);
        }
    }

    return finalLineVertices;
}

/**
 * Takes a polygon as an array of point rings, returns a flattened array of the X,Y coordinates of these points.
 */
function flatten(polygon: Array<Array<Point>>): {
    flattened: Array<number>;
    holeIndices: Array<number>;
} {
    const holeIndices = [];
    const flattened = [];

    for (const ring of polygon) {
        if (ring.length === 0) {
            continue;
        }

        if (ring !== polygon[0]) {
            holeIndices.push(flattened.length / 2);
        }

        for (let i = 0; i < ring.length; i++) {
            flattened.push(ring[i].x);
            flattened.push(ring[i].y);
        }
    }

    return {
        flattened,
        holeIndices
    };
}

/**
 * Returns a new array of indices where all triangles have the counter-clockwise winding order.
 */
export function fixWindingOrder(flattened: Array<number>, indices: Array<number>): Array<number> {
    const corrected = [];

    for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        const v0x = flattened[i0 * 2];
        const v0y = flattened[i0 * 2 + 1];
        const v1x = flattened[i1 * 2];
        const v1y = flattened[i1 * 2 + 1];
        const v2x = flattened[i2 * 2];
        const v2y = flattened[i2 * 2 + 1];

        const e0x = v1x - v0x;
        const e0y = v1y - v0y;
        const e1x = v2x - v0x;
        const e1y = v2y - v0y;

        const crossProduct = e0x * e1y - e0y * e1x;

        if (crossProduct > 0) {
            corrected.push(i0);
            corrected.push(i2);
            corrected.push(i1);
        } else {
            corrected.push(i0);
            corrected.push(i1);
            corrected.push(i2);
        }
    }

    return corrected;
}

/**
 * Triangulates a ring of vertex indices. Appends to the supplied array of final triangle indices.
 */
export function scanlineTriangulateVertexRing(vertexBuffer: Array<number>, ring: Array<number>, finalIndices: Array<number>): void {
    if (ring.length === 0) {
        throw new Error('Subdivision vertex ring is empty.');
    }

    let leftmostIndex = 0;
    let leftmostX = vertexBuffer[ring[0] * 2];
    for (let i = 1; i < ring.length; i++) {
        const x = vertexBuffer[ring[i] * 2];
        if (x < leftmostX) {
            leftmostX = x;
            leftmostIndex = i;
        }
    }

    const ringVertexLength = ring.length;
    let lastEdgeA = leftmostIndex;
    let lastEdgeB = (lastEdgeA + 1) % ringVertexLength;

    while (true) {
        const candidateIndexA = (lastEdgeA - 1) >= 0 ? (lastEdgeA - 1) : (ringVertexLength - 1);
        const candidateIndexB = (lastEdgeB + 1) % ringVertexLength;

        const candidateAx = vertexBuffer[ring[candidateIndexA] * 2];
        const candidateAy = vertexBuffer[ring[candidateIndexA] * 2 + 1];
        const candidateBx = vertexBuffer[ring[candidateIndexB] * 2];
        const candidateBy = vertexBuffer[ring[candidateIndexB] * 2 + 1];
        const lastEdgeAx = vertexBuffer[ring[lastEdgeA] * 2];
        const lastEdgeAy = vertexBuffer[ring[lastEdgeA] * 2 + 1];
        const lastEdgeBx = vertexBuffer[ring[lastEdgeB] * 2];
        const lastEdgeBy = vertexBuffer[ring[lastEdgeB] * 2 + 1];

        let pickA = false;

        if (candidateAx < candidateBx) {
            pickA = true;
        } else if (candidateAx > candidateBx) {
            pickA = false;
        } else {
            const ex = lastEdgeBx - lastEdgeAx;
            const ey = lastEdgeBy - lastEdgeAy;
            const nx = ey;
            const ny = -ex;
            const sign = (lastEdgeAy < lastEdgeBy) ? 1 : -1;
            const aRight = ((candidateAx - lastEdgeAx) * nx + (candidateAy - lastEdgeAy) * ny) * sign;
            const bRight = ((candidateBx - lastEdgeAx) * nx + (candidateBy - lastEdgeAy) * ny) * sign;
            if (aRight > bRight) {
                pickA = true;
            }
        }

        if (pickA) {
            const c = ring[candidateIndexA];
            const a = ring[lastEdgeA];
            const b = ring[lastEdgeB];
            if (c !== a && c !== b && a !== b) {
                finalIndices.push(b, a, c);
            }
            lastEdgeA--;
            if (lastEdgeA < 0) {
                lastEdgeA = ringVertexLength - 1;
            }
        } else {
            const c = ring[candidateIndexB];
            const a = ring[lastEdgeA];
            const b = ring[lastEdgeB];
            if (c !== a && c !== b && a !== b) {
                finalIndices.push(b, a, c);
            }
            lastEdgeB++;
            if (lastEdgeB >= ringVertexLength) {
                lastEdgeB = 0;
            }
        }

        if (candidateIndexA === candidateIndexB) {
            break;
        }
    }
}
