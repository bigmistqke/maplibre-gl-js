import {describe, it, expect} from 'vitest';
import {checkMaxAngle} from '@modular/layers/symbol/vendor/check_max_angle.ts';
import {Anchor} from '../../../../symbol/anchor.ts';
import Point from '@mapbox/point-geometry';

describe('checkMaxAngle', () => {
    it('returns true when anchor has no segment (horizontal label)', () => {
    // anchor.segment === undefined → always passes
        const anchor = new Anchor(0, 0, 0, undefined);
        const line = [new Point(0, 0), new Point(100, 0)];
        expect(checkMaxAngle(line, anchor, 50, 25, Math.PI / 4)).toBe(true);
    });

    it('returns true for a perfectly straight line regardless of maxAngle', () => {
        const line = [
            new Point(0, 0),
            new Point(100, 0),
            new Point(200, 0),
            new Point(300, 0),
        ];
        const anchor = new Anchor(150, 0, 0, 1);
        // Straight line has zero combined angle — should always pass
        expect(checkMaxAngle(line, anchor, 100, 50, 0.01)).toBe(true);
    });

    it('returns false for a sharp 90-degree turn when maxAngle is small', () => {
        const line = [
            new Point(0, 0),
            new Point(100, 0),
            new Point(100, 100),  // sharp right-angle turn
        ];
        const anchor = new Anchor(100, 0, 0, 1);
        // maxAngle = 0.01 rad (very strict) — should fail
        expect(checkMaxAngle(line, anchor, 150, 75, 0.01)).toBe(false);
    });

    it('returns true for labelLength 0', () => {
        const line = [new Point(0, 0), new Point(100, 0), new Point(100, 100)];
        const anchor = new Anchor(50, 0, 0, 0);
        expect(checkMaxAngle(line, anchor, 0, 50, 0.01)).toBe(true);
    });
});
