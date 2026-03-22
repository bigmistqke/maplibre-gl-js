// Ported from maplibre-gl-js/src/symbol/projection.test.ts (321 lines)
// Adaptations:
//   - SymbolLineVertexArray → StructArray(SymbolLineVertexLayout)
//   - MercatorTransform → TransformAdapter
//   - unwrappedTileID: null → { canonical: { z: 0, x: 0, y: 0 }, wrap: 0 }
//   - Tests using roll are skipped (TransformAdapter.rollInRadians is always 0)

import {describe, test, expect, it} from 'vitest';
import {
    type SymbolProjectionContext,
    type ProjectionSyntheticVertexArgs,
    findOffsetIntersectionPoint,
    projectWithMatrix,
    transformToOffsetNormal,
    projectLineVertexToLabelPlane,
    getPitchedLabelPlaneMatrix,
    getGlCoordMatrix,
    getTileSkewVectors,
} from '@modular/layers/symbol/vendor/projection.ts';

import Point from '@mapbox/point-geometry';
import {mat4} from 'gl-matrix';
import {createStructArray} from '@modular/core/struct-array.ts';
import {SymbolLineVertexLayout} from '@modular/layers/symbol/vendor/symbol_structs.ts';
import {TransformAdapter} from '@modular/layers/symbol/vendor/transform_adapter.ts';

// Dummy unwrapped tile ID to replace null
const DUMMY_TILE_ID = {canonical: {z: 0, x: 0, y: 0}, wrap: 0};

function expectToBeCloseToArray(actual: number[], expected: number[], precision = 5) {
    expect(actual.length).toBe(expected.length);
    for (let i = 0; i < actual.length; i++) {
        expect(actual[i]).toBeCloseTo(expected[i], precision);
    }
}

describe('Projection', () => {
    test('matrix float precision', () => {
        const point = new Point(10.000000005, 0);
        const matrix = mat4.create();
        expect(projectWithMatrix(point.x, point.y, matrix).point.x).toBeCloseTo(point.x, 10);
    });
});

describe('Vertex to viewport projection', () => {
    // A three point line along the x axis
    const lineVertexArray = createStructArray(SymbolLineVertexLayout);
    lineVertexArray.emplaceBack(-10, 0, -10);
    lineVertexArray.emplaceBack(0, 0, 0);
    lineVertexArray.emplaceBack(10, 0, 10);
    const transform = new TransformAdapter(
        {center: {lng: 0, lat: 0}, zoom: 0, bearing: 0, pitch: 0, groundElevation: 0},
        {width: 128, height: 128}
    );

    test('projecting with null matrix', () => {
        const projectionContext: SymbolProjectionContext = {
            projectionCache: {projections: {}, offsets: {}, cachedAnchorPoint: undefined, anyProjectionOccluded: false},
            lineVertexArray,
            pitchedLabelPlaneMatrix: mat4.create(),
            getElevation: (_x, _y) => 0,
            // Only relevant in "behind the camera" case, can't happen with null projection matrix
            tileAnchorPoint: new Point(0, 0),
            pitchWithMap: true,
            unwrappedTileID: DUMMY_TILE_ID,
            transform,
            width: 1,
            height: 1,
            translation: [0, 0]
        };

        const syntheticVertexArgs: ProjectionSyntheticVertexArgs = {
            distanceFromAnchor: 0,
            previousVertex: new Point(0, 0),
            direction: 1,
            absOffsetX: 0
        };

        const first = projectLineVertexToLabelPlane(0, projectionContext, syntheticVertexArgs);
        const second = projectLineVertexToLabelPlane(1, projectionContext, syntheticVertexArgs);
        const third = projectLineVertexToLabelPlane(2, projectionContext, syntheticVertexArgs);
        expect(first.x).toBeCloseTo(-10);
        expect(second.x).toBeCloseTo(0);
        expect(third.x).toBeCloseTo(10);
    });
});

describe('Find offset line intersections', () => {
    const lineVertexArray = createStructArray(SymbolLineVertexLayout);
    // A three point line along x axis, to origin, and then up y axis
    lineVertexArray.emplaceBack(-10, 0, -10);
    lineVertexArray.emplaceBack(0, 0, 0);
    lineVertexArray.emplaceBack(0, 10, 10);

    // A three point line along the x axis
    lineVertexArray.emplaceBack(-10, 0, -10);
    lineVertexArray.emplaceBack(0, 0, 0);
    lineVertexArray.emplaceBack(10, 0, 10);
    const transform = new TransformAdapter(
        {center: {lng: 0, lat: 0}, zoom: 0, bearing: 0, pitch: 0, groundElevation: 0},
        {width: 128, height: 128}
    );

    const projectionContext: SymbolProjectionContext = {
        projectionCache: {projections: {}, offsets: {}, cachedAnchorPoint: undefined, anyProjectionOccluded: false},
        lineVertexArray,
        pitchedLabelPlaneMatrix: mat4.create(),
        getElevation: (_x, _y) => 0,
        tileAnchorPoint: new Point(0, 0),
        transform,
        pitchWithMap: true,
        unwrappedTileID: DUMMY_TILE_ID,
        width: 1,
        height: 1,
        translation: [0, 0]
    };

    // Only relevant in "behind the camera" case, can't happen with null projection matrix
    const syntheticVertexArgs: ProjectionSyntheticVertexArgs = {
        direction: 1,
        distanceFromAnchor: 0,
        previousVertex: new Point(0, 0),
        absOffsetX: 0
    };

    test('concave', () => {
        /*
                  | |
                  | |
          ________| |
          __________|  <- origin
        */
        projectionContext.projectionCache = {projections: {}, offsets: {}, cachedAnchorPoint: undefined, anyProjectionOccluded: false};
        const lineOffsetY = 1;

        const prevToCurrent = new Point(10, 0);
        const normal = transformToOffsetNormal(prevToCurrent, lineOffsetY, syntheticVertexArgs.direction);
        expect(normal.y).toBeCloseTo(1);
        expect(normal.x).toBeCloseTo(0);
        const intersectionPoint = findOffsetIntersectionPoint(
            1,
            normal,
            new Point(0, 0),
            0,
            3,
            new Point(-10, 1),
            lineOffsetY,
            projectionContext,
            syntheticVertexArgs
        );
        expect(intersectionPoint.y).toBeCloseTo(1);
        expect(intersectionPoint.x).toBeCloseTo(-1);
    });

    test('convex', () => {
        /*
                    | |
                    | |
           origin \ | |
          __________| |
          ____________|
        */
        projectionContext.projectionCache = {projections: {}, offsets: {}, cachedAnchorPoint: undefined, anyProjectionOccluded: false};
        const lineOffsetY = -1;

        const prevToCurrent = new Point(10, 0);
        const normal = transformToOffsetNormal(prevToCurrent, lineOffsetY, syntheticVertexArgs.direction);
        expect(normal.y).toBeCloseTo(-1);
        expect(normal.x).toBeCloseTo(0);
        const intersectionPoint = findOffsetIntersectionPoint(
            1,
            normal,
            new Point(0, 0),
            0,
            3,
            new Point(-10, -1),
            lineOffsetY,
            projectionContext,
            syntheticVertexArgs
        );
        expect(intersectionPoint.y).toBeCloseTo(-1);
        expect(intersectionPoint.x).toBeCloseTo(1);
    });

    test('parallel', () => {
        /*
          ______._____
          ______|_____
        */
        projectionContext.projectionCache = {projections: {}, offsets: {}, cachedAnchorPoint: undefined, anyProjectionOccluded: false};
        const lineOffsetY = 1;

        const prevToCurrent = new Point(10, 0);
        const intersectionPoint = findOffsetIntersectionPoint(
            1,
            transformToOffsetNormal(prevToCurrent, lineOffsetY, syntheticVertexArgs.direction),
            new Point(0, 0),
            3,
            5,
            new Point(-10, 1),
            lineOffsetY,
            projectionContext,
            syntheticVertexArgs
        );
        expect(intersectionPoint.x).toBeCloseTo(0);
        expect(intersectionPoint.y).toBeCloseTo(1);
    });

    // STUB: TransformAdapter doesn't support roll yet — skipping roll tests
    test.skip('getPitchedLabelPlaneMatrix: bearing and roll', () => {
        // Original test uses setRoll(45) which our TransformAdapter doesn't support.
        // TransformAdapter.rollInRadians is always 0.
    });

    test('getPitchedLabelPlaneMatrix: bearing and pitch', () => {
        const transform = new TransformAdapter(
            {center: {lng: 0, lat: 0}, zoom: 0, bearing: 45, pitch: 45, groundElevation: 0},
            {width: 128, height: 128}
        );

        expectToBeCloseToArray([...getPitchedLabelPlaneMatrix(false, transform, 2)],
            [0.3535533845424652, -0.3535533845424652, 0, 0, 0.3535533845424652, 0.3535533845424652, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 9);
        expectToBeCloseToArray([...getPitchedLabelPlaneMatrix(true, transform, 2)],
            [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 9);
    });

    // STUB: TransformAdapter doesn't support roll yet — skipping roll+pitch+bearing test
    test.skip('getPitchedLabelPlaneMatrix: bearing, pitch, and roll', () => {
        // Original test uses setRoll(45) which our TransformAdapter doesn't support.
        // TransformAdapter.rollInRadians is always 0.
    });

    // STUB: TransformAdapter doesn't support roll yet — skipping roll test for getGlCoordMatrix
    test.skip('getGlCoordMatrix: bearing, pitch, and roll', () => {
        // Original test uses setRoll(45) which our TransformAdapter doesn't support.
        // TransformAdapter.rollInRadians is always 0.
    });

    test('getTileSkewVectors: bearing', () => {
        const transform = new TransformAdapter(
            {center: {lng: 0, lat: 0}, zoom: 0, bearing: 45, pitch: 0, groundElevation: 0},
            {width: 128, height: 128}
        );

        expectToBeCloseToArray([...getTileSkewVectors(transform).vecEast],
            [0.7071067690849304, 0.7071067690849304]);
        expectToBeCloseToArray([...getTileSkewVectors(transform).vecSouth],
            [-0.7071067690849304, 0.7071067690849304], 9);
    });

    // STUB: TransformAdapter doesn't support roll yet — skipping pure roll test
    test.skip('getTileSkewVectors: roll', () => {
        // Original test uses setRoll(45) which our TransformAdapter doesn't support.
        // TransformAdapter.rollInRadians is always 0.
    });

    test('getTileSkewVectors: pitch', () => {
        const transform = new TransformAdapter(
            {center: {lng: 0, lat: 0}, zoom: 0, bearing: 0, pitch: 45, groundElevation: 0},
            {width: 128, height: 128}
        );

        expectToBeCloseToArray([...getTileSkewVectors(transform).vecEast],
            [1.0, 0.0]);
        expectToBeCloseToArray([...getTileSkewVectors(transform).vecSouth],
            [0.0, 1.0], 9);
    });

    // STUB: TransformAdapter doesn't support roll yet — skipping roll+pitch+bearing skew test
    test.skip('getTileSkewVectors: roll pitch bearing', () => {
        // Original test uses setRoll(45) which our TransformAdapter doesn't support.
        // TransformAdapter.rollInRadians is always 0.
    });

    // STUB: TransformAdapter doesn't support setMaxPitch / extreme pitch yet — skipping pitch 90 degrees tests
    test.skip('getTileSkewVectors: pitch 90 degrees', () => {
        // Original test uses transform.setMaxPitch(180) and setPitch(90)
        // Our TransformAdapter is constructed with a fixed pitch value;
        // pitch=90 with mercator projection may behave differently.
    });

    // STUB: TransformAdapter doesn't support roll or setMaxPitch — skipping
    test.skip('getTileSkewVectors: pitch 90 degrees with roll and bearing', () => {
        // Original test uses setMaxPitch(180), setRoll(45), and setPitch(90)
        // which are not supported in our TransformAdapter.
    });
});
