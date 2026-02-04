import {describe, test, expect} from 'vitest';
import {unicodeBlockLookup} from './is_char_in_unicode_block';

describe('unicodeBlockLookup', () => {
    test('each code block lookup function follows the same pattern', () => {
        for (const codeBlock in unicodeBlockLookup) {
            const lookup = unicodeBlockLookup[codeBlock];
            const match = lookup.toString().match(/^\(char\) => char >= (\d+) && char <= (\d+)$/);
            expect(match).not.toBeNull();
            const matchArray = match as RegExpMatchArray;
            expect(matchArray).toHaveLength(3);
            const lower = Number.parseInt(matchArray[1], 16);
            const upper = Number.parseInt(matchArray[2], 16);
            expect(upper).toBeGreaterThan(lower);
        }
    });
});
