import {charHasRotatedVerticalOrientation} from './script_detection';

export const verticalizedCharacterMap = {
    '!': '︕',
    '#': '＃',
    '$': '＄',
    '%': '％',
    '&': '＆',
    '(': '︵',
    ')': '︶',
    '*': '＊',
    '+': '＋',
    ',': '︐',
    '-': '︲',
    '.': '・',
    '/': '／',
    ':': '︓',
    ';': '︔',
    '<': '︿',
    '=': '＝',
    '>': '﹀',
    '?': '︖',
    '@': '＠',
    '[': '﹇',
    '\\': '＼',
    ']': '﹈',
    '^': '＾',
    '_': '︳',
    '`': '｀',
    '{': '︷',
    '|': '―',
    '}': '︸',
    '~': '～',
    '¢': '￠',
    '£': '￡',
    '¥': '￥',
    '¦': '￤',
    '¬': '￢',
    '¯': '￣',
    '–': '︲',
    '—': '︱',
    '‘': '﹃',
    '’': '﹄',
    '“': '﹁',
    '”': '﹂',
    '…': '︙',
    '⋯': '︙',
    '‧': '・',
    '₩': '￦',
    '、': '︑',
    '。': '︒',
    '〈': '︿',
    '〉': '﹀',
    '《': '︽',
    '》': '︾',
    '「': '﹁',
    '」': '﹂',
    '『': '﹃',
    '』': '﹄',
    '【': '︻',
    '】': '︼',
    '〔': '︹',
    '〕': '︺',
    '〖': '︗',
    '〗': '︘',
    '！': '︕',
    '（': '︵',
    '）': '︶',
    '，': '︐',
    '－': '︲',
    '．': '・',
    '：': '︓',
    '；': '︔',
    '＜': '︿',
    '＞': '﹀',
    '？': '︖',
    '［': '﹇',
    '］': '﹈',
    '＿': '︳',
    '｛': '︷',
    '｜': '―',
    '｝': '︸',
    '｟': '︵',
    '｠': '︶',
    '｡': '︒',
    '｢': '﹁',
    '｣': '﹂'
};

type VerticalizedCharacter = keyof typeof verticalizedCharacterMap;

function isValidVerticalizedCharacter(char: string): char is VerticalizedCharacter {
    return char in verticalizedCharacterMap;
}

export function verticalizePunctuation(input: string) {
    let output = '';

    let prevChar: {premature:true; value: undefined} | {premature:false; value: string} = {premature: true, value: undefined};
    const chars = input[Symbol.iterator]();
    let char = chars.next();
    const nextChars = input[Symbol.iterator]();
    nextChars.next();
    let nextChar = nextChars.next();

    while (!char.done) {
        const canReplacePunctuation = (
            (nextChar.done || !charHasRotatedVerticalOrientation(nextChar.value.codePointAt(0)!) || isValidVerticalizedCharacter(nextChar.value)) &&
            (prevChar.premature || !charHasRotatedVerticalOrientation(prevChar.value.codePointAt(0)!) || isValidVerticalizedCharacter(prevChar.value))
        );

        if (canReplacePunctuation && isValidVerticalizedCharacter(char.value)) {
            output += verticalizedCharacterMap[char.value];
        } else {
            output += char.value;
        }

        prevChar = {value: char.value, premature: false};
        char = chars.next();
        nextChar = nextChars.next();
    }

    return output;
}

