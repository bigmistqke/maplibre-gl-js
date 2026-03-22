import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {loadGlyphRange, glyphRange} from '@modular/layers/symbol/glyph-loader.ts';

// Build a minimal glyph PBF for a single codepoint (id=65 = 'A')
// We use a hand-crafted protobuf. Since constructing real PBFs is complex in
// tests, we mock fetch to return a known ArrayBuffer that parseGlyphPbfLocal
// will decode — here we use an empty response and just verify the shape.

describe('glyphRange', () => {
    it('returns 0 for codepoint 0', () => expect(glyphRange(0)).toBe(0));
    it('returns 0 for codepoint 65 (A)', () => expect(glyphRange(65)).toBe(0));
    it('returns 256 for codepoint 256', () => expect(glyphRange(256)).toBe(256));
    it('returns 256 for codepoint 511', () => expect(glyphRange(511)).toBe(256));
    it('returns 512 for codepoint 512', () => expect(glyphRange(512)).toBe(512));
});

describe('loadGlyphRange', () => {
    beforeEach(() => {
    // Mock fetch to return an empty valid protobuf (no glyphs in the range)
    // An empty ArrayBuffer is a valid protobuf with zero fields.
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(0),
        }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('calls fetch with interpolated URL', async () => {
        await loadGlyphRange('Open Sans Regular', 0, 'https://example.com/{fontstack}/{range}.pbf');
        expect(vi.mocked(fetch)).toHaveBeenCalledWith(
            expect.stringContaining('Open%20Sans%20Regular'),
            expect.any(Object),
        );
        expect(vi.mocked(fetch)).toHaveBeenCalledWith(
            expect.stringContaining('0-255'),
            expect.any(Object),
        );
    });

    it('returns a map pre-filled with null for the full range', async () => {
        const result = await loadGlyphRange('Open Sans Regular', 0, 'https://example.com/{fontstack}/{range}.pbf');
        // With empty PBF, all 256 slots should be null
        expect(result[0]).toBeNull();
        expect(result[65]).toBeNull();
        expect(result[255]).toBeNull();
        // But outside this range should be undefined
        expect(result[256]).toBeUndefined();
    });

    it('throws on HTTP error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: false, status: 404}));
        await expect(
            loadGlyphRange('Open Sans Regular', 0, 'https://example.com/{fontstack}/{range}.pbf'),
        ).rejects.toThrow('HTTP 404');
    });

    it('passes AbortSignal to fetch', async () => {
        const controller = new AbortController();
        await loadGlyphRange('Open Sans Regular', 0, 'https://example.com/{fontstack}/{range}.pbf', controller.signal);
        expect(vi.mocked(fetch)).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({signal: controller.signal}),
        );
    });
});
