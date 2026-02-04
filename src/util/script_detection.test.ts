import {describe, test, expect} from 'vitest';
import {charAllowsIdeographicBreaking, charAllowsLetterSpacing, charHasUprightVerticalOrientation, charInComplexShapingScript, charInRTLScript} from './script_detection';
import {assertedNotNullish} from './util';

/** codePointAt(0) for single-char string literals - always defined for non-empty strings */
const cp = (s: string) => assertedNotNullish(s.codePointAt(0));

describe('charAllowsIdeographicBreaking', () => {
    test('disallows ideographic breaking of Latin text', () => {
        expect(charAllowsIdeographicBreaking(cp('A'))).toBe(false);
    });

    test('allows ideographic breaking of ideographic punctuation', () => {
        expect(charAllowsIdeographicBreaking(cp('〈'))).toBe(true);
    });

    test('allows ideographic breaking of Bopomofo text', () => {
        expect(charAllowsIdeographicBreaking(cp('ㄎ'))).toBe(true);
    });

    test('allows ideographic breaking of Chinese and Vietnamese text', () => {
        expect(charAllowsIdeographicBreaking(cp('市'))).toBe(true);
        expect(charAllowsIdeographicBreaking(cp('𡔖'))).toBe(true);
    });

    test('disallows ideographic breaking of Korean text', () => {
        expect(charAllowsIdeographicBreaking(cp('아'))).toBe(false);
    });

    test('allows ideographic breaking of Japanese text', () => {
        expect(charAllowsIdeographicBreaking(cp('あ'))).toBe(true);
        expect(charAllowsIdeographicBreaking(cp('カ'))).toBe(true);
    });

    test('allows ideographic breaking of Yi text', () => {
        expect(charAllowsIdeographicBreaking(cp('ꉆ'))).toBe(true);
    });
});

describe('charAllowsLetterSpacing', () => {
    test('allows letter spacing of Latin text', () => {
        expect(charAllowsLetterSpacing(cp('A'))).toBe(true);
    });

    test('disallows ideographic breaking of Arabic text', () => {
        // Arabic
        expect(charAllowsLetterSpacing(cp('۳'))).toBe(false);
        // Arabic Supplement
        expect(charAllowsLetterSpacing(cp('ݣ'))).toBe(false);
        // Arabic Extended-A
        expect(charAllowsLetterSpacing(cp('ࢳ'))).toBe(false);
        // Arabic Extended-B
        expect(charAllowsLetterSpacing(cp('࢐'))).toBe(false);
        // Arabic Presentation Forms-A
        expect(charAllowsLetterSpacing(cp('ﰤ'))).toBe(false);
        // Arabic Presentation Forms-B
        expect(charAllowsLetterSpacing(cp('ﺽ'))).toBe(false);
    });
});

describe('charHasUprightVerticalOrientation', () => {
    test('rotates Latin text sideways', () => {
        expect(charHasUprightVerticalOrientation(cp('A'))).toBe(false);
    });

    test('keeps Bopomofo text upright', () => {
        expect(charHasUprightVerticalOrientation(cp('ㄎ'))).toBe(true);
    });

    test('keeps Canadian Aboriginal text upright', () => {
        expect(charHasUprightVerticalOrientation(cp('ᐃ'))).toBe(true);
    });

    test('keeps Chinese and Vietnamese text upright', () => {
        expect(charHasUprightVerticalOrientation(cp('市'))).toBe(true);
        expect(charHasUprightVerticalOrientation(cp('𡔖'))).toBe(true);
    });

    test('keeps Korean text upright', () => {
        expect(charHasUprightVerticalOrientation(cp('아'))).toBe(true);
    });

    test('keeps Japanese text upright', () => {
        expect(charHasUprightVerticalOrientation(cp('あ'))).toBe(true);
        expect(charHasUprightVerticalOrientation(cp('カ'))).toBe(true);
    });

    test('keeps Yi text upright', () => {
        expect(charHasUprightVerticalOrientation(cp('ꉆ'))).toBe(true);
    });
});

describe('charInComplexShapingScript', () => {
    test('recognizes that Arabic text needs complex shaping', () => {
        // Non-Arabic
        expect(charInComplexShapingScript(cp('3'))).toBe(false);
        // Arabic
        expect(charInComplexShapingScript(cp('۳'))).toBe(true);
        // Arabic Supplement
        expect(charInComplexShapingScript(cp('ݣ'))).toBe(true);
        // Arabic Extended-A
        expect(charInComplexShapingScript(cp('ࢳ'))).toBe(true);
        // Arabic Extended-B
        expect(charInComplexShapingScript(cp('࢐'))).toBe(true);
        // Arabic Presentation Forms-A
        expect(charInComplexShapingScript(cp('ﰤ'))).toBe(true);
        // Arabic Presentation Forms-B
        expect(charInComplexShapingScript(cp('ﺽ'))).toBe(true);
    });
});

describe('charInRTLScript', () => {
    test('does not identify direction-neutral text as right-to-left', () => {
        expect(charInRTLScript(cp('3'))).toBe(false);
    });

    test('identifies Arabic text as right-to-left', () => {
        // Arabic
        expect(charInRTLScript(cp('۳'))).toBe(true);
        // Arabic Supplement
        expect(charInRTLScript(cp('ݣ'))).toBe(true);
        // Arabic Extended-A
        expect(charInRTLScript(cp('ࢳ'))).toBe(true);
        // Arabic Extended-B
        expect(charInRTLScript(cp('࢐'))).toBe(true);
        // Arabic Presentation Forms-A
        expect(charInRTLScript(cp('ﰤ'))).toBe(true);
        // Arabic Presentation Forms-B
        expect(charInRTLScript(cp('ﺽ'))).toBe(true);
    });

    test('identifies Hebrew text as right-to-left', () => {
        // Hebrew
        expect(charInRTLScript(cp('ה'))).toBe(true);
        // Alphabetic Presentation Forms
        expect(charInRTLScript(cp('ﬡ'))).toBe(true);
    });

    test('identifies Thaana text as right-to-left', () => {
        // Thaana
        expect(charInRTLScript(cp('ޘ'))).toBe(true);
    });
});
