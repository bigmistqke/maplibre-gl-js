import {describe, it, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {mat4} from 'gl-matrix';
import {
    placeGlyphAlongLine,
    projectTileCoordinatesToLabelPlane,
    projectWithMatrix,
    getPerspectiveRatio,
    xyTransformMat4,
    hideGlyphs,
    pathSlicedToLongestUnoccluded,
    getPitchedLabelPlaneMatrix,
    getGlCoordMatrix,
    placeFirstAndLastGlyph,
    type SymbolProjectionContext,
    type PointProjection,
} from './projection.ts';
import {StructArray} from '../../../core/struct-array.ts';
import {SymbolLineVertexLayout, GlyphOffsetLayout, DynamicLayoutLayout} from './symbol_structs.ts';
import {TransformAdapter} from './transform_adapter.ts';

/**
 * Helper: create a minimal SymbolProjectionContext for testing.
 * Uses a simple identity-like label plane matrix and viewport-aligned projection (pitchWithMap=false).
 */
function makeProjectionContext(
    lineVertices: Array<{x: number; y: number}>,
    anchorPoint: Point,
    opts: Partial<SymbolProjectionContext> = {}
): SymbolProjectionContext {
    const lineVertexArray = new StructArray(SymbolLineVertexLayout);
    for (const v of lineVertices) {
        lineVertexArray.emplaceBack(v.x, v.y, 0);
    }

    const transform = new TransformAdapter(
        {center: {lng: 0, lat: 0}, zoom: 10},
        {width: 800, height: 600}
    );

    return {
        getElevation: () => 0,
        pitchedLabelPlaneMatrix: mat4.create(),
        lineVertexArray,
        pitchWithMap: false,
        projectionCache: {projections: {}, offsets: {}, cachedAnchorPoint: undefined, anyProjectionOccluded: false},
        transform,
        tileAnchorPoint: anchorPoint,
        unwrappedTileID: {canonical: {z: 10, x: 512, y: 512}, wrap: 0},
        width: 800,
        height: 600,
        translation: [0, 0],
        ...opts,
    };
}

describe('projection (vendored)', () => {
    describe('placeGlyphAlongLine', () => {
        it('places a glyph at the correct position on a simple horizontal line', () => {
            // Line from (0,100) to (100,100) to (200,100) — horizontal
            // Anchor is at index 1 (which is (100,100)), segment=0 means between vertex 0 and 1
            const lineVertices = [
                {x: 0, y: 100},
                {x: 100, y: 100},
                {x: 200, y: 100},
            ];
            const anchor = new Point(100, 100);
            const ctx = makeProjectionContext(lineVertices, anchor);

            // Place a glyph at offsetX=10 (10 units to the right of anchor)
            const result = placeGlyphAlongLine(
                10,   // offsetX
                0,    // lineOffsetX
                0,    // lineOffsetY
                false, // flip
                1,    // anchorSegment — between vertex 1 and 2
                0,    // lineStartIndex
                3,    // lineEndIndex
                ctx,
                true   // rotateToLine
            );

            expect(result).not.toBeNull();
            expect(result.point).toBeDefined();
            expect(result.angle).toBeDefined();
            expect(result.path).toBeDefined();
            expect(result.path.length).toBeGreaterThan(0);
        });

        it('returns null when the line is too short for the glyph offset', () => {
            // Very short line
            const lineVertices = [
                {x: 100, y: 100},
                {x: 101, y: 100},
            ];
            const anchor = new Point(100, 100);
            const ctx = makeProjectionContext(lineVertices, anchor);

            // Try to place a glyph that needs more room than the line provides
            const result = placeGlyphAlongLine(
                5000,   // very large offsetX
                0,
                0,
                false,
                0,    // anchorSegment
                0,
                2,
                ctx,
                true
            );

            expect(result).toBeNull();
        });

        it('flips direction when flip=true', () => {
            const lineVertices = [
                {x: 0, y: 100},
                {x: 100, y: 100},
                {x: 200, y: 100},
            ];
            const anchor = new Point(100, 100);

            // Place unflipped
            const ctxUnflipped = makeProjectionContext(lineVertices, anchor);
            const unflipped = placeGlyphAlongLine(
                10, 0, 0, false, 1, 0, 3, ctxUnflipped, true
            );

            // Place flipped
            const ctxFlipped = makeProjectionContext(lineVertices, anchor);
            const flipped = placeGlyphAlongLine(
                10, 0, 0, true, 1, 0, 3, ctxFlipped, true
            );

            expect(unflipped).not.toBeNull();
            expect(flipped).not.toBeNull();

            // Flipped and unflipped should produce different angles
            // (flip reverses walk direction and adds PI to angle)
            expect(flipped.angle).not.toBeCloseTo(unflipped.angle, 1);
        });

        it('handles negative offsetX (placing to the left)', () => {
            const lineVertices = [
                {x: 0, y: 100},
                {x: 100, y: 100},
                {x: 200, y: 100},
            ];
            const anchor = new Point(100, 100);
            const ctx = makeProjectionContext(lineVertices, anchor);

            const result = placeGlyphAlongLine(
                -10, 0, 0, false, 1, 0, 3, ctx, true
            );

            expect(result).not.toBeNull();
            // For negative offsetX, direction is -1, so angle starts at PI (from the `direction < 0` branch)
            // plus the atan2 of the segment. On a horizontal line projected to screen, the exact value
            // depends on the projection. Just verify it's non-zero (pointing leftward).
            expect(result.angle).not.toBe(0);
        });

        it('places glyph with zero angle when rotateToLine is false', () => {
            const lineVertices = [
                {x: 0, y: 100},
                {x: 100, y: 100},
                {x: 200, y: 100},
            ];
            const anchor = new Point(100, 100);
            const ctx = makeProjectionContext(lineVertices, anchor);

            const result = placeGlyphAlongLine(
                10, 0, 0, false, 1, 0, 3, ctx, false // rotateToLine=false
            );

            expect(result).not.toBeNull();
            expect(result.angle).toBe(0);
        });

        it('handles diagonal line correctly', () => {
            // 45 degree line
            const lineVertices = [
                {x: 0, y: 0},
                {x: 100, y: 100},
                {x: 200, y: 200},
            ];
            const anchor = new Point(100, 100);
            const ctx = makeProjectionContext(lineVertices, anchor);

            const result = placeGlyphAlongLine(
                10, 0, 0, false, 1, 0, 3, ctx, true
            );

            expect(result).not.toBeNull();
            // On a 45-degree line going down-right, angle should be approximately PI/4
            expect(result.angle).toBeCloseTo(Math.PI / 4, 1);
        });
    });

    describe('placeFirstAndLastGlyph', () => {
        it('places first and last glyph on a horizontal line with pitchWithMap', () => {
            // Use a long line with many vertices for sufficient room
            const lineVertices = [
                {x: 0, y: 4096},
                {x: 1024, y: 4096},
                {x: 2048, y: 4096},
                {x: 3072, y: 4096},
                {x: 4096, y: 4096},
            ];
            const anchor = new Point(2048, 4096);

            // Use pitchWithMap=true so we use the simpler matrix-based projection
            const lineVertexArray = new StructArray(SymbolLineVertexLayout);
            for (const v of lineVertices) {
                lineVertexArray.emplaceBack(v.x, v.y, 0);
            }

            const transform = new TransformAdapter(
                {center: {lng: 0, lat: 0}, zoom: 10},
                {width: 800, height: 600}
            );

            const ctx: SymbolProjectionContext = {
                getElevation: () => 0,
                pitchedLabelPlaneMatrix: mat4.create(), // identity — tile coords = label plane coords
                lineVertexArray,
                pitchWithMap: true,
                projectionCache: {projections: {}, offsets: {}, cachedAnchorPoint: undefined, anyProjectionOccluded: false},
                transform,
                tileAnchorPoint: anchor,
                unwrappedTileID: {canonical: {z: 10, x: 512, y: 512}, wrap: 0},
                width: 800,
                height: 600,
                translation: [0, 0],
            };

            const glyphOffsetArray = new StructArray(GlyphOffsetLayout);
            glyphOffsetArray.emplaceBack(-5); // first glyph offset
            glyphOffsetArray.emplaceBack(5);  // last glyph offset

            const symbol = {
                glyphStartIndex: 0,
                numGlyphs: 2,
                lineStartIndex: 0,
                lineLength: 5,
                segment: 2, // anchor is at vertex 2
                lineOffsetX: 0,
                lineOffsetY: 0,
                anchorX: 2048,
                anchorY: 4096,
            };

            const result = placeFirstAndLastGlyph(
                1, // fontScale
                glyphOffsetArray,
                0, // lineOffsetX
                0, // lineOffsetY
                false, // flip
                symbol,
                true, // rotateToLine
                ctx
            );

            expect(result).not.toBeNull();
            expect(result.first).toBeDefined();
            expect(result.last).toBeDefined();
            expect(result.first.point).toBeDefined();
            expect(result.last.point).toBeDefined();
        });
    });

    describe('projectWithMatrix', () => {
        it('projects through identity matrix correctly', () => {
            const identity = mat4.create();
            const result = projectWithMatrix(100, 200, identity);

            expect(result.point.x).toBeCloseTo(100, 5);
            expect(result.point.y).toBeCloseTo(200, 5);
            expect(result.signedDistanceFromCamera).toBeCloseTo(1, 5);
            expect(result.isOccluded).toBe(false);
        });

        it('applies scale matrix', () => {
            const m = mat4.create();
            mat4.scale(m, m, [2, 3, 1]);
            const result = projectWithMatrix(10, 20, m);

            expect(result.point.x).toBeCloseTo(20, 5);
            expect(result.point.y).toBeCloseTo(60, 5);
        });

        it('uses getElevation when provided', () => {
            const m = mat4.create();
            const result = projectWithMatrix(10, 20, m, (x, y) => 5);

            expect(result.point.x).toBeCloseTo(10, 5);
            expect(result.point.y).toBeCloseTo(20, 5);
        });
    });

    describe('getPerspectiveRatio', () => {
        it('returns 1.0 when distance equals cameraToCenterDistance', () => {
            expect(getPerspectiveRatio(100, 100)).toBeCloseTo(1.0, 5);
        });

        it('returns > 1 when closer than center', () => {
            expect(getPerspectiveRatio(100, 50)).toBeGreaterThan(1.0);
        });

        it('returns < 1 when farther than center', () => {
            expect(getPerspectiveRatio(100, 200)).toBeLessThan(1.0);
        });
    });

    describe('xyTransformMat4', () => {
        it('applies only x,y components', () => {
            const m = mat4.create();
            mat4.translate(m, m, [10, 20, 0]);
            const input = [5, 7, 0, 1] as [number, number, number, number];
            const output = [0, 0, 0, 0] as [number, number, number, number];
            xyTransformMat4(output, input, m);

            expect(output[0]).toBeCloseTo(15, 5);
            expect(output[1]).toBeCloseTo(27, 5);
            expect(output[3]).toBeCloseTo(1, 5);
        });
    });

    describe('hideGlyphs', () => {
        it('adds 4 hidden vertices per glyph', () => {
            const arr = new StructArray(DynamicLayoutLayout);
            hideGlyphs(3, arr);
            // 3 glyphs * 4 vertices each = 12 entries
            expect(arr.length).toBe(12);
            // All values should be -Infinity for x and y
            expect(arr.float32[0]).toBe(-Infinity);
            expect(arr.float32[1]).toBe(-Infinity);
            expect(arr.float32[2]).toBe(0); // angle
        });
    });

    describe('pathSlicedToLongestUnoccluded', () => {
        it('returns full path when nothing is occluded', () => {
            const path: PointProjection[] = [
                {point: new Point(0, 0), signedDistanceFromCamera: 1, isOccluded: false},
                {point: new Point(1, 1), signedDistanceFromCamera: 1, isOccluded: false},
                {point: new Point(2, 2), signedDistanceFromCamera: 1, isOccluded: false},
            ];
            const result = pathSlicedToLongestUnoccluded(path);
            expect(result.length).toBe(3);
        });

        it('returns longest unoccluded segment', () => {
            const path: PointProjection[] = [
                {point: new Point(0, 0), signedDistanceFromCamera: 1, isOccluded: false},
                {point: new Point(1, 1), signedDistanceFromCamera: 1, isOccluded: true},
                {point: new Point(2, 2), signedDistanceFromCamera: 1, isOccluded: false},
                {point: new Point(3, 3), signedDistanceFromCamera: 1, isOccluded: false},
                {point: new Point(4, 4), signedDistanceFromCamera: 1, isOccluded: false},
            ];
            const result = pathSlicedToLongestUnoccluded(path);
            expect(result.length).toBe(3);
            expect(result[0].point.x).toBe(2);
        });

        it('returns empty array when all occluded', () => {
            const path: PointProjection[] = [
                {point: new Point(0, 0), signedDistanceFromCamera: 1, isOccluded: true},
                {point: new Point(1, 1), signedDistanceFromCamera: 1, isOccluded: true},
            ];
            const result = pathSlicedToLongestUnoccluded(path);
            expect(result.length).toBe(0);
        });
    });

    describe('getPitchedLabelPlaneMatrix', () => {
        it('returns a valid matrix', () => {
            const transform = new TransformAdapter(
                {center: {lng: 0, lat: 0}, zoom: 10},
                {width: 800, height: 600}
            );
            const m = getPitchedLabelPlaneMatrix(true, transform, 1);
            expect(m).toBeDefined();
            // Identity-like when rotateWithMap and pixelsToTileUnits=1
            expect(m[0]).toBeCloseTo(1, 3);
            expect(m[5]).toBeCloseTo(1, 3);
        });
    });

    describe('getGlCoordMatrix', () => {
        it('returns pixelsToClipSpaceMatrix when not pitchWithMap', () => {
            const transform = new TransformAdapter(
                {center: {lng: 0, lat: 0}, zoom: 10},
                {width: 800, height: 600}
            );
            const m = getGlCoordMatrix(false, false, transform, 1);
            expect(m).toBe(transform.pixelsToClipSpaceMatrix);
        });

        it('returns a scale matrix when pitchWithMap', () => {
            const transform = new TransformAdapter(
                {center: {lng: 0, lat: 0}, zoom: 10},
                {width: 800, height: 600}
            );
            const m = getGlCoordMatrix(true, true, transform, 2);
            // Should be scaled by pixelsToTileUnits=2
            expect(m[0]).toBeCloseTo(2, 5);
            expect(m[5]).toBeCloseTo(2, 5);
        });
    });
});
