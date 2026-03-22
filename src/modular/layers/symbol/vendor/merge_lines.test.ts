import {describe, it, expect} from 'vitest';
import {mergeLines} from '@modular/layers/symbol/vendor/merge_lines.ts';
import Point from '@mapbox/point-geometry';

// Minimal SymbolFeature shape — only geometry and text are needed for mergeLines
function makeFeature(points: [number, number][], text: string): any {
    return {
        geometry: [points.map(([x, y]) => new Point(x, y))],
        text: {toString: () => text},
    // Other SymbolFeature fields are not needed by mergeLines
    };
}

describe('mergeLines', () => {
    it('returns empty array for empty input', () => {
        expect(mergeLines([])).toEqual([]);
    });

    it('returns unchanged features when no merges are possible', () => {
        const f1 = makeFeature([[0, 0], [10, 0]], 'A');
        const f2 = makeFeature([[20, 0], [30, 0]], 'B');
        const result = mergeLines([f1, f2]);
        expect(result.length).toBe(2);
    });

    it('merges two collinear features with matching text and shared endpoints', () => {
    // f1 ends at (10,0), f2 starts at (10,0) — same text
        const f1 = makeFeature([[0, 0], [10, 0]], 'road');
        const f2 = makeFeature([[10, 0], [20, 0]], 'road');
        const result = mergeLines([f1, f2]);
        // After merging, should have 1 feature with 3 points: (0,0)→(10,0)→(20,0)
        expect(result.length).toBe(1);
        expect(result[0].geometry[0].length).toBe(3);
    });

    it('does not merge features with different text', () => {
        const f1 = makeFeature([[0, 0], [10, 0]], 'Main St');
        const f2 = makeFeature([[10, 0], [20, 0]], 'Oak Ave');
        const result = mergeLines([f1, f2]);
        expect(result.length).toBe(2);
    });
});
