var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { loadGlyphRange } from '../style/load_glyph_range';
import TinySDF from '@mapbox/tiny-sdf';
import { unicodeBlockLookup } from '../util/is_char_in_unicode_block';
import { AlphaImage } from '../util/image';
export class GlyphManager {
    constructor(requestManager, localIdeographFontFamily, lang) {
        this.requestManager = requestManager;
        this.localIdeographFontFamily = localIdeographFontFamily;
        this.entries = {};
        this.lang = lang;
    }
    setURL(url) {
        this.url = url;
    }
    getGlyphs(glyphs) {
        return __awaiter(this, void 0, void 0, function* () {
            const glyphsPromises = [];
            for (const stack in glyphs) {
                for (const id of glyphs[stack]) {
                    glyphsPromises.push(this._getAndCacheGlyphsPromise(stack, id));
                }
            }
            const updatedGlyphs = yield Promise.all(glyphsPromises);
            const result = {};
            for (const { stack, id, glyph } of updatedGlyphs) {
                if (!result[stack]) {
                    result[stack] = {};
                }
                result[stack][id] = glyph && {
                    id: glyph.id,
                    bitmap: glyph.bitmap.clone(),
                    metrics: glyph.metrics
                };
            }
            return result;
        });
    }
    _getAndCacheGlyphsPromise(stack, id) {
        return __awaiter(this, void 0, void 0, function* () {
            let entry = this.entries[stack];
            if (!entry) {
                entry = this.entries[stack] = {
                    glyphs: {},
                    requests: {},
                    ranges: {}
                };
            }
            let glyph = entry.glyphs[id];
            if (glyph !== undefined) {
                return { stack, id, glyph };
            }
            glyph = this._tinySDF(entry, stack, id);
            if (glyph) {
                entry.glyphs[id] = glyph;
                return { stack, id, glyph };
            }
            const range = Math.floor(id / 256);
            if (range * 256 > 65535) {
                throw new Error('glyphs > 65535 not supported');
            }
            if (entry.ranges[range]) {
                return { stack, id, glyph };
            }
            if (!this.url) {
                throw new Error('glyphsUrl is not set');
            }
            if (!entry.requests[range]) {
                const promise = GlyphManager.loadGlyphRange(stack, range, this.url, this.requestManager);
                entry.requests[range] = promise;
            }
            const response = yield entry.requests[range];
            for (const id in response) {
                if (!this._doesCharSupportLocalGlyph(+id)) {
                    entry.glyphs[+id] = response[+id];
                }
            }
            entry.ranges[range] = true;
            return { stack, id, glyph: response[id] || null };
        });
    }
    _doesCharSupportLocalGlyph(id) {
        return !!this.localIdeographFontFamily &&
            (/\p{Ideo}|\p{sc=Hang}|\p{sc=Hira}|\p{sc=Kana}/u.test(String.fromCodePoint(id)) ||
                unicodeBlockLookup['CJK Unified Ideographs'](id) ||
                unicodeBlockLookup['Hangul Syllables'](id) ||
                unicodeBlockLookup['Hiragana'](id) ||
                unicodeBlockLookup['Katakana'](id) ||
                unicodeBlockLookup['CJK Symbols and Punctuation'](id) ||
                unicodeBlockLookup['Halfwidth and Fullwidth Forms'](id));
    }
    _tinySDF(entry, stack, id) {
        const fontFamily = this.localIdeographFontFamily;
        if (!fontFamily) {
            return;
        }
        if (!this._doesCharSupportLocalGlyph(id)) {
            return;
        }
        const textureScale = 2;
        let tinySDF = entry.tinySDF;
        if (!tinySDF) {
            let fontWeight = '400';
            if (/bold/i.test(stack)) {
                fontWeight = '900';
            }
            else if (/medium/i.test(stack)) {
                fontWeight = '500';
            }
            else if (/light/i.test(stack)) {
                fontWeight = '200';
            }
            tinySDF = entry.tinySDF = new GlyphManager.TinySDF({
                fontSize: 24 * textureScale,
                buffer: 3 * textureScale,
                radius: 8 * textureScale,
                cutoff: 0.25,
                lang: this.lang,
                fontFamily,
                fontWeight
            });
        }
        const char = tinySDF.draw(String.fromCharCode(id));
        const topAdjustment = 27.5;
        const leftAdjustment = 0.5;
        return {
            id,
            bitmap: new AlphaImage({ width: char.width || 30 * textureScale, height: char.height || 30 * textureScale }, char.data),
            metrics: {
                width: char.glyphWidth / textureScale || 24,
                height: char.glyphHeight / textureScale || 24,
                left: (char.glyphLeft / textureScale + leftAdjustment) || 0,
                top: char.glyphTop / textureScale - topAdjustment || -8,
                advance: char.glyphAdvance / textureScale || 24,
                isDoubleResolution: true
            }
        };
    }
}
GlyphManager.loadGlyphRange = loadGlyphRange;
GlyphManager.TinySDF = TinySDF;
//# sourceMappingURL=glyph_manager.js.map