var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { getArrayBuffer } from '../util/ajax';
import { parseGlyphPbf } from './parse_glyph_pbf';
export function loadGlyphRange(fontstack, range, urlTemplate, requestManager) {
    return __awaiter(this, void 0, void 0, function* () {
        const begin = range * 256;
        const end = begin + 255;
        const request = requestManager.transformRequest(urlTemplate.replace('{fontstack}', fontstack).replace('{range}', `${begin}-${end}`), "Glyphs");
        const response = yield getArrayBuffer(request, new AbortController());
        if (!response || !response.data) {
            throw new Error(`Could not load glyph range. range: ${range}, ${begin}-${end}`);
        }
        const glyphs = {};
        for (const glyph of parseGlyphPbf(response.data)) {
            glyphs[glyph.id] = glyph;
        }
        return glyphs;
    });
}
//# sourceMappingURL=load_glyph_range.js.map