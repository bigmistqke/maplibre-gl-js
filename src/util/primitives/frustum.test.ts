import {describe, test, expect} from 'vitest';
import {Frustum} from './frustum';
import * as mat4 from 'gl-matrix/mat4';

import type {Vec4} from 'gl-matrix';

describe('frustum', () => {
    test('Create a frustum from inverse projection matrix', () => {
        const proj = new Float64Array(16);
        const invProj = new Float64Array(16);
        mat4.perspective(proj, Math.PI / 2, 1.0, 0.1, 100.0);
        mat4.invert(invProj, proj);

        const frustum = Frustum.fromInvProjectionMatrix(invProj, 1.0, 0.0);
        // mat4.perspective generates a projection matrix for right handed coordinate space.
        // This means that forward direction will be -z
        const expectedFrustumPoints = [
            [-0.1, 0.1, -0.1, 1.0],
            [0.1, 0.1, -0.1, 1.0],
            [0.1, -0.1, -0.1, 1.0],
            [-0.1, -0.1, -0.1, 1.0],
            [-100.0, 100.0, -100.0, 1.0],
            [100.0, 100.0, -100.0, 1.0],
            [100.0, -100.0, -100.0, 1.0],
            [-100.0, -100.0, -100.0, 1.0],
        ];

        frustum.points = frustum.points.map(array => Array.from(array).map(n => Math.round(n * 10) / 10)) as Vec4[];
        frustum.planes = frustum.planes.map(array => Array.from(array).map(n => Math.round(n * 1000) / 1000)) as Vec4[];

        const expectedFrustumPlanes = [
            [0, 0, 1.0, 0.1],
            [-0, -0, -1.0, -100.0],
            [-0.707, 0, 0.707, -0],
            [0.707, 0, 0.707, -0],
            [0, -0.707, 0.707, -0],
            [-0, 0.707, 0.707, -0]
        ];

        expect(frustum.points).toEqual(expectedFrustumPoints);
        expect(frustum.planes).toEqual(expectedFrustumPlanes);
    });
});
