import { unicodeBlockLookup as isChar } from './is_char_in_unicode_block';
export function allowsIdeographicBreaking(chars) {
    for (const char of chars) {
        if (!charAllowsIdeographicBreaking(char.charCodeAt(0)))
            return false;
    }
    return true;
}
export function allowsVerticalWritingMode(chars) {
    for (const char of chars) {
        if (charHasUprightVerticalOrientation(char.charCodeAt(0)))
            return true;
    }
    return false;
}
export function allowsLetterSpacing(chars) {
    for (const char of chars) {
        if (!charAllowsLetterSpacing(char.charCodeAt(0)))
            return false;
    }
    return true;
}
function sanitizedRegExpFromScriptCodes(scriptCodes) {
    const supportedPropertyEscapes = scriptCodes.map(code => {
        try {
            return new RegExp(`\\p{sc=${code}}`, 'u').source;
        }
        catch (_a) {
            return null;
        }
    }).filter(pe => pe);
    return new RegExp(supportedPropertyEscapes.join('|'), 'u');
}
const cursiveScriptCodes = [
    'Arab',
    'Dupl',
    'Mong',
    'Ougr',
    'Syrc',
];
const cursiveScriptRegExp = sanitizedRegExpFromScriptCodes(cursiveScriptCodes);
export function charAllowsLetterSpacing(char) {
    return !cursiveScriptRegExp.test(String.fromCodePoint(char));
}
const ideographicBreakingScriptCodes = [
    'Bopo',
    'Hani',
    'Hira',
    'Kana',
    'Kits',
    'Nshu',
    'Tang',
    'Yiii',
];
const ideographicBreakingRegExp = sanitizedRegExpFromScriptCodes(ideographicBreakingScriptCodes);
export function charAllowsIdeographicBreaking(char) {
    if (char < 0x2E80)
        return false;
    if (isChar['CJK Compatibility Forms'](char))
        return true;
    if (isChar['CJK Compatibility'](char))
        return true;
    if (isChar['CJK Strokes'](char))
        return true;
    if (isChar['CJK Symbols and Punctuation'](char))
        return true;
    if (isChar['Enclosed CJK Letters and Months'](char))
        return true;
    if (isChar['Halfwidth and Fullwidth Forms'](char))
        return true;
    if (isChar['Ideographic Description Characters'](char))
        return true;
    if (isChar['Vertical Forms'](char))
        return true;
    return ideographicBreakingRegExp.test(String.fromCodePoint(char));
}
export function charHasUprightVerticalOrientation(char) {
    if (char === 0x02EA ||
        char === 0x02EB) {
        return true;
    }
    if (char < 0x1100)
        return false;
    if (isChar['CJK Compatibility Forms'](char)) {
        if (!((char >= 0xFE49 && char <= 0xFE4F))) {
            return true;
        }
    }
    if (isChar['CJK Compatibility'](char))
        return true;
    if (isChar['CJK Strokes'](char))
        return true;
    if (isChar['CJK Symbols and Punctuation'](char)) {
        if (!((char >= 0x3008 && char <= 0x3011)) &&
            !((char >= 0x3014 && char <= 0x301F)) &&
            char !== 0x3030) {
            return true;
        }
    }
    if (isChar['Enclosed CJK Letters and Months'](char))
        return true;
    if (isChar['Ideographic Description Characters'](char))
        return true;
    if (isChar['Kanbun'](char))
        return true;
    if (isChar['Katakana'](char)) {
        if (char !== 0x30FC) {
            return true;
        }
    }
    if (isChar['Halfwidth and Fullwidth Forms'](char)) {
        if (char !== 0xFF08 &&
            char !== 0xFF09 &&
            char !== 0xFF0D &&
            !((char >= 0xFF1A && char <= 0xFF1E)) &&
            char !== 0xFF3B &&
            char !== 0xFF3D &&
            char !== 0xFF3F &&
            !(char >= 0xFF5B && char <= 0xFFDF) &&
            char !== 0xFFE3 &&
            !(char >= 0xFFE8 && char <= 0xFFEF)) {
            return true;
        }
    }
    if (isChar['Small Form Variants'](char)) {
        if (!((char >= 0xFE58 && char <= 0xFE5E)) &&
            !((char >= 0xFE63 && char <= 0xFE66))) {
            return true;
        }
    }
    if (isChar['Vertical Forms'](char))
        return true;
    if (isChar['Yijing Hexagram Symbols'](char))
        return true;
    if (/\p{sc=Cans}/u.test(String.fromCodePoint(char)))
        return true;
    if (/\p{sc=Hang}/u.test(String.fromCodePoint(char)))
        return true;
    if (ideographicBreakingRegExp.test(String.fromCodePoint(char)))
        return true;
    return false;
}
export function charHasNeutralVerticalOrientation(char) {
    if (isChar['Latin-1 Supplement'](char)) {
        if (char === 0x00A7 ||
            char === 0x00A9 ||
            char === 0x00AE ||
            char === 0x00B1 ||
            char === 0x00BC ||
            char === 0x00BD ||
            char === 0x00BE ||
            char === 0x00D7 ||
            char === 0x00F7) {
            return true;
        }
    }
    if (isChar['General Punctuation'](char)) {
        if (char === 0x2016 ||
            char === 0x2020 ||
            char === 0x2021 ||
            char === 0x2030 ||
            char === 0x2031 ||
            char === 0x203B ||
            char === 0x203C ||
            char === 0x2042 ||
            char === 0x2047 ||
            char === 0x2048 ||
            char === 0x2049 ||
            char === 0x2051) {
            return true;
        }
    }
    if (isChar['Letterlike Symbols'](char))
        return true;
    if (isChar['Number Forms'](char))
        return true;
    if (isChar['Miscellaneous Technical'](char)) {
        if ((char >= 0x2300 && char <= 0x2307) ||
            (char >= 0x230C && char <= 0x231F) ||
            (char >= 0x2324 && char <= 0x2328) ||
            char === 0x232B ||
            (char >= 0x237D && char <= 0x239A) ||
            (char >= 0x23BE && char <= 0x23CD) ||
            char === 0x23CF ||
            (char >= 0x23D1 && char <= 0x23DB) ||
            (char >= 0x23E2 && char <= 0x23FF)) {
            return true;
        }
    }
    if (isChar['Control Pictures'](char) && char !== 0x2423)
        return true;
    if (isChar['Optical Character Recognition'](char))
        return true;
    if (isChar['Enclosed Alphanumerics'](char))
        return true;
    if (isChar['Geometric Shapes'](char))
        return true;
    if (isChar['Miscellaneous Symbols'](char)) {
        if (!((char >= 0x261A && char <= 0x261F))) {
            return true;
        }
    }
    if (isChar['Miscellaneous Symbols and Arrows'](char)) {
        if ((char >= 0x2B12 && char <= 0x2B2F) ||
            (char >= 0x2B50 && char <= 0x2B59) ||
            (char >= 0x2BB8 && char <= 0x2BEB)) {
            return true;
        }
    }
    if (isChar['CJK Symbols and Punctuation'](char))
        return true;
    if (isChar['Katakana'](char))
        return true;
    if (isChar['Private Use Area'](char))
        return true;
    if (isChar['CJK Compatibility Forms'](char))
        return true;
    if (isChar['Small Form Variants'](char))
        return true;
    if (isChar['Halfwidth and Fullwidth Forms'](char))
        return true;
    if (char === 0x221E ||
        char === 0x2234 ||
        char === 0x2235 ||
        (char >= 0x2700 && char <= 0x2767) ||
        (char >= 0x2776 && char <= 0x2793) ||
        char === 0xFFFC ||
        char === 0xFFFD) {
        return true;
    }
    return false;
}
export function charHasRotatedVerticalOrientation(char) {
    return !(charHasUprightVerticalOrientation(char) ||
        charHasNeutralVerticalOrientation(char));
}
export function charInComplexShapingScript(char) {
    return /\p{sc=Arab}/u.test(String.fromCodePoint(char));
}
const rtlScriptCodes = [
    'Adlm',
    'Arab',
    'Armi',
    'Avst',
    'Chrs',
    'Cprt',
    'Egyp',
    'Elym',
    'Gara',
    'Hatr',
    'Hebr',
    'Hung',
    'Khar',
    'Lydi',
    'Mand',
    'Mani',
    'Mend',
    'Merc',
    'Mero',
    'Narb',
    'Nbat',
    'Nkoo',
    'Orkh',
    'Palm',
    'Phli',
    'Phlp',
    'Phnx',
    'Prti',
    'Rohg',
    'Samr',
    'Sarb',
    'Sogo',
    'Syrc',
    'Thaa',
    'Todr',
    'Yezi',
];
const rtlScriptRegExp = sanitizedRegExpFromScriptCodes(rtlScriptCodes);
export function charInRTLScript(char) {
    return rtlScriptRegExp.test(String.fromCodePoint(char));
}
export function charInSupportedScript(char, canRenderRTL) {
    if (!canRenderRTL && charInRTLScript(char)) {
        return false;
    }
    if ((char >= 0x0900 && char <= 0x0DFF) ||
        (char >= 0x0F00 && char <= 0x109F) ||
        isChar['Khmer'](char)) {
        return false;
    }
    return true;
}
export function stringContainsRTLText(chars) {
    for (const char of chars) {
        if (charInRTLScript(char.charCodeAt(0))) {
            return true;
        }
    }
    return false;
}
export function isStringInSupportedScript(chars, canRenderRTL) {
    for (const char of chars) {
        if (!charInSupportedScript(char.charCodeAt(0), canRenderRTL)) {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=script_detection.js.map