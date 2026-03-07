import {describe, test, expect} from 'vitest';
import {createLayout} from '../util/struct_array';
import {createStructLayout} from './struct_layout';

// Minimal StructArray-like object for testing
function createTestArray(layout: ReturnType<typeof createLayout>) {
    let arrayBuffer = new ArrayBuffer(layout.size * 16);
    let length = 0;

    const arr = {
        arrayBuffer,
        length,
        _refreshViews() {
            // no-op for tests — views are managed by StructLayout
        },
        resize(n: number) {
            if (n * layout.size > arrayBuffer.byteLength) {
                const newBuffer = new ArrayBuffer(n * layout.size * 2);
                new Uint8Array(newBuffer).set(new Uint8Array(arrayBuffer));
                arrayBuffer = newBuffer;
                arr.arrayBuffer = arrayBuffer;
                arr._refreshViews();
            }
            arr.length = n;
        },
    };
    return arr;
}

describe('createStructLayout', () => {
    test('simple position write', () => {
        const gpuLayout = createLayout([
            {name: 'a_pos', components: 2, type: 'Int16'},
        ], 4);

        const struct = createStructLayout(gpuLayout, {
            pos: {attr: 'a_pos', components: 2},
        });

        const array = createTestArray(gpuLayout);
        const writer = struct.writer(array);

        array.resize(1);
        writer.index = 0;
        writer.pos(100, 200);

        const view = new Int16Array(array.arrayBuffer);
        expect(view[0]).toBe(100);
        expect(view[1]).toBe(200);
    });

    test('encoding transform', () => {
        const gpuLayout = createLayout([
            {name: 'a_pos', components: 2, type: 'Int16'},
        ], 4);

        const struct = createStructLayout(gpuLayout, {
            pos: {attr: 'a_pos', components: 2, encode: (v) => v << 1},
        });

        const array = createTestArray(gpuLayout);
        const writer = struct.writer(array);

        array.resize(1);
        writer.index = 0;
        writer.pos(100, 200);

        const view = new Int16Array(array.arrayBuffer);
        expect(view[0]).toBe(200); // 100 << 1
        expect(view[1]).toBe(400); // 200 << 1
    });

    test('bit field packing', () => {
        const gpuLayout = createLayout([
            {name: 'a_pos_normal', components: 2, type: 'Int16'},
        ], 4);

        const struct = createStructLayout(gpuLayout, {
            pos: {attr: 'a_pos_normal', components: 2, encode: (v) => v << 1},
            round: {attr: 'a_pos_normal', component: 0, bit: 0},
            up: {attr: 'a_pos_normal', component: 1, bit: 0},
        });

        const array = createTestArray(gpuLayout);
        const writer = struct.writer(array);

        array.resize(1);
        writer.index = 0;
        // Write position first (shifts left, clearing LSB)
        writer.pos(50, 75);
        // Then OR in bit flags
        writer.round(true);
        writer.up(false);

        const view = new Int16Array(array.arrayBuffer);
        expect(view[0]).toBe((50 << 1) | 1);  // pos=100, round=1
        expect(view[1]).toBe(75 << 1);          // pos=150, up=0
    });

    test('mixed types (line-like layout)', () => {
        const gpuLayout = createLayout([
            {name: 'a_pos_normal', components: 2, type: 'Int16'},
            {name: 'a_data', components: 4, type: 'Uint8'},
        ], 4);

        const EXTRUDE_SCALE = 63;

        const struct = createStructLayout(gpuLayout, {
            pos: {attr: 'a_pos_normal', components: 2, encode: (v) => v << 1},
            round: {attr: 'a_pos_normal', component: 0, bit: 0},
            extrude: {attr: 'a_data', components: [0, 1], encode: (v) => Math.round(EXTRUDE_SCALE * v) + 128},
        });

        const array = createTestArray(gpuLayout);
        const writer = struct.writer(array);

        array.resize(1);
        writer.index = 0;
        writer.pos(10, 20);
        writer.round(true);
        writer.extrude(1.0, -0.5);

        const int16View = new Int16Array(array.arrayBuffer);
        expect(int16View[0]).toBe((10 << 1) | 1); // pos.x with round flag

        const uint8View = new Uint8Array(array.arrayBuffer);
        // a_data starts at offset 4 (after 2 Int16s)
        expect(uint8View[4]).toBe(Math.round(EXTRUDE_SCALE * 1.0) + 128);
        expect(uint8View[5]).toBe(Math.round(EXTRUDE_SCALE * -0.5) + 128);
    });

    test('multiple vertices', () => {
        const gpuLayout = createLayout([
            {name: 'a_pos', components: 2, type: 'Int16'},
        ], 4);

        const struct = createStructLayout(gpuLayout, {
            pos: {attr: 'a_pos', components: 2},
        });

        const array = createTestArray(gpuLayout);
        const writer = struct.writer(array);

        array.resize(3);
        writer.index = 0;
        writer.pos(10, 20);
        writer.index = 1;
        writer.pos(30, 40);
        writer.index = 2;
        writer.pos(50, 60);

        const view = new Int16Array(array.arrayBuffer);
        expect(view[0]).toBe(10);
        expect(view[1]).toBe(20);
        expect(view[2]).toBe(30);
        expect(view[3]).toBe(40);
        expect(view[4]).toBe(50);
        expect(view[5]).toBe(60);
    });

    test('specific component indices', () => {
        const gpuLayout = createLayout([
            {name: 'a_data', components: 4, type: 'Uint8'},
        ], 4);

        const struct = createStructLayout(gpuLayout, {
            // Write only components 2 and 3
            distanceBits: {attr: 'a_data', components: [2, 3]},
        });

        const array = createTestArray(gpuLayout);
        const writer = struct.writer(array);

        array.resize(1);
        writer.index = 0;
        writer.distanceBits(0xAB, 0xCD);

        const view = new Uint8Array(array.arrayBuffer);
        expect(view[0]).toBe(0); // component 0 untouched
        expect(view[1]).toBe(0); // component 1 untouched
        expect(view[2]).toBe(0xAB);
        expect(view[3]).toBe(0xCD);
    });

    test('throws on unknown attribute', () => {
        const gpuLayout = createLayout([
            {name: 'a_pos', components: 2, type: 'Int16'},
        ], 4);

        expect(() => createStructLayout(gpuLayout, {
            pos: {attr: 'a_nonexistent', components: 2},
        })).toThrow('attribute "a_nonexistent" not found');
    });

    test('single component write (no components specified)', () => {
        const gpuLayout = createLayout([
            {name: 'a_data', components: 4, type: 'Uint8'},
        ], 4);

        const struct = createStructLayout(gpuLayout, {
            // Writes to component 0 by default
            firstByte: {attr: 'a_data'},
        });

        const array = createTestArray(gpuLayout);
        const writer = struct.writer(array);

        array.resize(1);
        writer.index = 0;
        writer.firstByte(42);

        const view = new Uint8Array(array.arrayBuffer);
        expect(view[0]).toBe(42);
    });
});
