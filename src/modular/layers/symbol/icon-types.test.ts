// src/modular/layers/symbol/icon-types.test.ts
import {describe, it, expect} from 'vitest';
import {IconVertexLayout} from '@modular/layers/symbol/icon-types';

describe('IconVertexLayout', () => {
    it('has stride of 12 bytes (6 int16/uint16 fields × 2 bytes each)', () => {
        expect(IconVertexLayout.stride).toBe(12);
    });

    it('has ax at byte offset 0', () => {
        expect(IconVertexLayout.fields.ax.offset).toBe(0);
    });

    it('has ay at byte offset 2', () => {
        expect(IconVertexLayout.fields.ay.offset).toBe(2);
    });

    it('has ox at byte offset 4', () => {
        expect(IconVertexLayout.fields.ox.offset).toBe(4);
    });

    it('has oy at byte offset 6', () => {
        expect(IconVertexLayout.fields.oy.offset).toBe(6);
    });

    it('has u at byte offset 8', () => {
        expect(IconVertexLayout.fields.u.offset).toBe(8);
    });

    it('has v at byte offset 10', () => {
        expect(IconVertexLayout.fields.v.offset).toBe(10);
    });
});
