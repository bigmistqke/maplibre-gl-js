import {describe, test, expect} from 'vitest';
import {mergeLines} from './merge_lines';
import type {SymbolFeature} from '../data/bucket/symbol_bucket';
import Point from '@mapbox/point-geometry';

function makeFeatures(lines: (string | number)[][]): SymbolFeature[] {
    const features: SymbolFeature[] = [];
    for (const line of lines) {
        const points: Point[] = [];
        for (let j = 1; j < line.length; j++) {
            points.push(new Point(line[j] as number, 0));
        }
        features.push({text: line[0] as any, geometry: [points]} as SymbolFeature);
    }
    return features;
}

describe('mergeLines', () => {
    test('mergeLines merges lines with the same text', () => {
        expect(
            mergeLines(makeFeatures([['a', 0, 1, 2], ['b', 4, 5, 6], ['a', 8, 9], ['a', 2, 3, 4], ['a', 6, 7, 8], ['a', 5, 6]]))
        ).toEqual(makeFeatures([['a', 0, 1, 2, 3, 4], ['b', 4, 5, 6], ['a', 5, 6, 7, 8, 9]]));
    });

    test('mergeLines handles merge from both ends', () => {
        expect(mergeLines(makeFeatures([['a', 0, 1, 2], ['a', 4, 5, 6], ['a', 2, 3, 4]]))).toEqual(makeFeatures([['a', 0, 1, 2, 3, 4, 5, 6]]));
    });

    test('mergeLines handles circular lines', () => {
        expect(mergeLines(makeFeatures([['a', 0, 1, 2], ['a', 2, 3, 4], ['a', 4, 0]]))).toEqual(makeFeatures([['a', 0, 1, 2, 3, 4, 0]]));
    });
});
