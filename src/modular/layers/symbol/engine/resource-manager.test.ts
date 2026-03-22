// src/modular/layers/symbol/engine/resource-manager.test.ts
import {describe, it, expect, vi} from 'vitest';
import {ResourceManager} from '@modular/layers/symbol/engine/resource-manager.ts';

vi.mock('../glyph-manager.ts', () => ({
    GlyphManager: vi.fn().mockImplementation(function (this: any, opts: { url: string }) {
        this.url = opts.url;
        this.addGlyphsLoadedListener = vi.fn();
        this.removeGlyphsLoadedListener = vi.fn();
        this.destroy = vi.fn();
    }),
}));

vi.mock('../image-manager.ts', () => ({
    ImageManager: vi.fn().mockImplementation(function (this: any, opts: { url: string }) {
        this.url = opts.url;
        this.destroy = vi.fn();
    }),
}));

describe('ResourceManager', () => {
    it('returns the same GlyphManager for identical url+fontstack', () => {
        const rm = new ResourceManager();
        const a = rm.getGlyphManager('https://ex.com/{fontstack}/{range}.pbf', 'Open Sans');
        const b = rm.getGlyphManager('https://ex.com/{fontstack}/{range}.pbf', 'Open Sans');
        expect(a).toBe(b);
    });

    it('returns different GlyphManagers for different fontstacks', () => {
        const rm = new ResourceManager();
        const a = rm.getGlyphManager('https://ex.com/{fontstack}/{range}.pbf', 'Open Sans');
        const b = rm.getGlyphManager('https://ex.com/{fontstack}/{range}.pbf', 'Roboto');
        expect(a).not.toBe(b);
    });

    it('returns the same ImageManager for identical sprite URL', () => {
        const rm = new ResourceManager();
        const a = rm.getImageManager('https://ex.com/sprite');
        const b = rm.getImageManager('https://ex.com/sprite');
        expect(a).toBe(b);
    });

    it('destroy() cleans up all managers', () => {
        const rm = new ResourceManager();
        const gm = rm.getGlyphManager('https://ex.com/{fontstack}/{range}.pbf', 'Open Sans');
        const im = rm.getImageManager('https://ex.com/sprite');
        rm.destroy();
        expect(gm.destroy).toHaveBeenCalled();
        expect(im.destroy).toHaveBeenCalled();
    });
});
