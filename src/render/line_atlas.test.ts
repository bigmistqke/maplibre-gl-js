import {describe, test, expect} from 'vitest';
import {LineAtlas} from './line_atlas';
import {assertedNotNullish} from '../util/util';

describe('LineAtlas', () => {
    const lineAtlas = new LineAtlas(64, 64);
    test('round [0, 0]', () => {
        const entry = assertedNotNullish(lineAtlas.addDash([0, 0], true));
        expect(entry.width).toBe(0);
    });
    test('round [1, 0]', () => {
        const entry = assertedNotNullish(lineAtlas.addDash([1, 0], true));
        expect(entry.width).toBe(1);
    });
    test('round [0, 1]', () => {
        const entry = assertedNotNullish(lineAtlas.addDash([0, 1], true));
        expect(entry.width).toBe(1);
    });
    test('odd round [1, 2, 1]', () => {
        const entry = assertedNotNullish(lineAtlas.addDash([1, 2, 1], true));
        expect(entry.width).toBe(4);
    });

    test('regular [0, 0]', () => {
        const entry = assertedNotNullish(lineAtlas.addDash([0, 0], false));
        expect(entry.width).toBe(0);
    });
    test('regular [1, 0]', () => {
        const entry = assertedNotNullish(lineAtlas.addDash([1, 0], false));
        expect(entry.width).toBe(1);
    });
    test('regular [0, 1]', () => {
        const entry = assertedNotNullish(lineAtlas.addDash([0, 1], false));
        expect(entry.width).toBe(1);
    });
    test('odd regular [1, 2, 1]', () => {
        const entry = assertedNotNullish(lineAtlas.addDash([1, 2, 1], false));
        expect(entry.width).toBe(4);
    });
});
