import {describe, test, expect} from 'vitest';
import {triangulatePolygon} from './triangulate_polygon';
import {SegmentVector} from '../segment';
import {CanonicalTileID} from '../../tile/tile_id';
import Point from '@mapbox/point-geometry';

// Minimal mock arrays matching the interfaces
function createMockArrays() {
    const vertices: Array<{x: number; y: number}> = [];
    const triangleIndices: Array<{a: number; b: number; c: number}> = [];
    const lineIndices: Array<{a: number; b: number}> = [];

    // Minimal StructArray-like for vertex tracking
    const vertexArray = {
        length: 0,
        arrayBuffer: new ArrayBuffer(0),
        uint8: new Uint8Array(0),
        bytesPerElement: 4,
        members: [],
        capacity: -1,
        isTransferred: false,
        emplaceBack() { this.length++; return this.length - 1; },
        emplace() { return 0; },
        resize(n: number) { this.length = n; },
        reserve() {},
        clear() { this.length = 0; },
        _trim() {},
        _refreshViews() {},
        serialize() { return {length: 0, arrayBuffer: new ArrayBuffer(0)}; },
    };

    const triangleIndexArray = {
        length: 0,
        arrayBuffer: new ArrayBuffer(0),
        uint8: new Uint8Array(0),
        bytesPerElement: 6,
        members: [],
        capacity: -1,
        isTransferred: false,
        emplaceBack(a: number, b: number, c: number) {
            triangleIndices.push({a, b, c});
            this.length++;
            return this.length - 1;
        },
        emplace() { return 0; },
        resize(n: number) { this.length = n; },
        reserve() {},
        clear() { this.length = 0; },
        _trim() {},
        _refreshViews() {},
        serialize() { return {length: 0, arrayBuffer: new ArrayBuffer(0)}; },
    };

    const lineIndexArray = {
        length: 0,
        arrayBuffer: new ArrayBuffer(0),
        uint8: new Uint8Array(0),
        bytesPerElement: 4,
        members: [],
        capacity: -1,
        isTransferred: false,
        emplaceBack(a: number, b: number) {
            lineIndices.push({a, b});
            this.length++;
            return this.length - 1;
        },
        emplace() { return 0; },
        resize(n: number) { this.length = n; },
        reserve() {},
        clear() { this.length = 0; },
        _trim() {},
        _refreshViews() {},
        serialize() { return {length: 0, arrayBuffer: new ArrayBuffer(0)}; },
    };

    return {vertices, triangleIndices, lineIndices, vertexArray, triangleIndexArray, lineIndexArray};
}

describe('triangulatePolygon', () => {
    test('triangulates a simple square', () => {
        const {vertices, triangleIndices, lineIndices, vertexArray, triangleIndexArray, lineIndexArray} = createMockArrays();

        // Simple square: 4 points forming a ring
        const geometry: Array<Array<Point>> = [[
            new Point(0, 0),
            new Point(100, 0),
            new Point(100, 100),
            new Point(0, 100),
            new Point(0, 0), // closed ring
        ]];

        const canonical = new CanonicalTileID(0, 0, 0);
        const triangleSegments = new SegmentVector();
        const lineSegments = new SegmentVector();

        triangulatePolygon(geometry, canonical, 0, {
            addVertex: (x, y) => {
                vertices.push({x, y});
                vertexArray.emplaceBack();
            },
            vertexArray: vertexArray as any,
            triangleIndexArray: triangleIndexArray as any,
            triangleSegments,
            lineIndexArray: lineIndexArray as any,
            lineSegments,
        });

        // Should produce vertices
        expect(vertices.length).toBeGreaterThanOrEqual(4);
        // Should produce triangle indices (at least 2 triangles for a quad)
        expect(triangleIndices.length).toBeGreaterThanOrEqual(2);
        // Should produce line indices for outline
        expect(lineIndices.length).toBeGreaterThanOrEqual(4);
        // Should create segments
        expect(triangleSegments.get().length).toBeGreaterThanOrEqual(1);
    });

    test('triangulates polygon with hole', () => {
        const {vertices, triangleIndices, vertexArray, triangleIndexArray} = createMockArrays();

        // Outer ring (CCW)
        const outer = [
            new Point(0, 0),
            new Point(200, 0),
            new Point(200, 200),
            new Point(0, 200),
            new Point(0, 0),
        ];
        // Inner hole (CW)
        const hole = [
            new Point(50, 50),
            new Point(50, 150),
            new Point(150, 150),
            new Point(150, 50),
            new Point(50, 50),
        ];

        const geometry: Array<Array<Point>> = [outer, hole];
        const canonical = new CanonicalTileID(0, 0, 0);
        const triangleSegments = new SegmentVector();

        triangulatePolygon(geometry, canonical, 0, {
            addVertex: (x, y) => {
                vertices.push({x, y});
                vertexArray.emplaceBack();
            },
            vertexArray: vertexArray as any,
            triangleIndexArray: triangleIndexArray as any,
            triangleSegments,
        });

        // With a hole, we need more triangles than a simple quad
        expect(triangleIndices.length).toBeGreaterThan(2);
        expect(vertices.length).toBeGreaterThan(4);
    });

    test('addVertex callback receives correct coordinates', () => {
        const {vertices, vertexArray, triangleIndexArray} = createMockArrays();

        const geometry: Array<Array<Point>> = [[
            new Point(10, 20),
            new Point(30, 40),
            new Point(50, 60),
            new Point(10, 20),
        ]];

        const canonical = new CanonicalTileID(0, 0, 0);
        const triangleSegments = new SegmentVector();

        triangulatePolygon(geometry, canonical, 0, {
            addVertex: (x, y) => {
                vertices.push({x, y});
                vertexArray.emplaceBack();
            },
            vertexArray: vertexArray as any,
            triangleIndexArray: triangleIndexArray as any,
            triangleSegments,
        });

        // All original vertices should be present in the output
        const hasVertex = (px: number, py: number) =>
            vertices.some(v => v.x === px && v.y === py);

        expect(hasVertex(10, 20)).toBe(true);
        expect(hasVertex(30, 40)).toBe(true);
        expect(hasVertex(50, 60)).toBe(true);
    });
});
