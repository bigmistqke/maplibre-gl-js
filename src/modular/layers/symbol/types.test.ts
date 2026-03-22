import {describe, it, expect} from 'vitest';
import {GlyphVertexLayout} from '@modular/layers/symbol/types.ts';

describe('GlyphVertexLayout', () => {
    it('has stride of 12 bytes (6 fields × 2 bytes each)', () => {
        expect(GlyphVertexLayout.stride).toBe(12);
    });

    it('ax field is at offset 0', () => {
        expect(GlyphVertexLayout.fields.ax.offset).toBe(0);
    });

    it('ay field is at offset 2', () => {
        expect(GlyphVertexLayout.fields.ay.offset).toBe(2);
    });

    it('ox field is at offset 4', () => {
        expect(GlyphVertexLayout.fields.ox.offset).toBe(4);
    });

    it('oy field is at offset 6', () => {
        expect(GlyphVertexLayout.fields.oy.offset).toBe(6);
    });

    it('u field is at offset 8', () => {
        expect(GlyphVertexLayout.fields.u.offset).toBe(8);
    });

    it('v field is at offset 10', () => {
        expect(GlyphVertexLayout.fields.v.offset).toBe(10);
    });
});
