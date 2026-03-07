import {describe, test, expect} from 'vitest';
import {createLayout} from '../util/struct_array';
import {createStructLayout} from './struct_layout';

/**
 * Validates that the struct layout abstraction can reproduce
 * the exact same byte output as line_bucket.ts addHalfVertex().
 */
describe('struct layout: line bucket equivalence', () => {
    const EXTRUDE_SCALE = 63;
    const LINE_DISTANCE_SCALE = 1 / 2;

    const gpuLayout = createLayout([
        {name: 'a_pos_normal', components: 2, type: 'Int16'},
        {name: 'a_data', components: 4, type: 'Uint8'},
    ], 4);

    // The struct layout separates semantic fields from encoding
    const lineVertex = createStructLayout(gpuLayout, {
        pos: {attr: 'a_pos_normal', components: 2, encode: (v) => v << 1},
        round: {attr: 'a_pos_normal', component: 0, bit: 0},
        up: {attr: 'a_pos_normal', component: 1, bit: 0},
        extrude: {attr: 'a_data', components: [0, 1], encode: (v) => Math.round(EXTRUDE_SCALE * v) + 128},
        dirAndDistLow: {
            attr: 'a_data', component: 2,
            pack: (dir: number, linesofarScaled: number) =>
                ((dir === 0 ? 0 : (dir < 0 ? -1 : 1)) + 1) | ((linesofarScaled & 0x3F) << 2),
        },
        distHigh: {
            attr: 'a_data', component: 3,
            pack: (linesofarScaled: number) => linesofarScaled >> 6,
        },
    });

    function createTestArray() {
        let arrayBuffer = new ArrayBuffer(gpuLayout.size * 16);
        const arr = {
            arrayBuffer,
            length: 0,
            _refreshViews() {},
            resize(n: number) {
                if (n * gpuLayout.size > arrayBuffer.byteLength) {
                    const newBuffer = new ArrayBuffer(n * gpuLayout.size * 2);
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

    // Reference: what line_bucket.ts addHalfVertex does
    function referenceEmplaceBack(
        array: Int16Array | Uint8Array,
        int16: Int16Array,
        uint8: Uint8Array,
        x: number, y: number,
        extrudeX: number, extrudeY: number,
        round: boolean, up: boolean,
        dir: number,
        linesofarScaled: number,
    ) {
        int16[0] = (x << 1) + (round ? 1 : 0);
        int16[1] = (y << 1) + (up ? 1 : 0);
        uint8[4] = Math.round(EXTRUDE_SCALE * extrudeX) + 128;
        uint8[5] = Math.round(EXTRUDE_SCALE * extrudeY) + 128;
        uint8[6] = ((dir === 0 ? 0 : (dir < 0 ? -1 : 1)) + 1) | ((linesofarScaled & 0x3F) << 2);
        uint8[7] = linesofarScaled >> 6;
    }

    test('reproduces addHalfVertex output exactly', () => {
        const x = 1234, y = 5678;
        const extrudeX = 0.75, extrudeY = -0.5;
        const round = true, up = false;
        const dir = -1;
        const distance = 42.5;
        const linesofarScaled = distance * LINE_DISTANCE_SCALE;

        // Reference output
        const refBuffer = new ArrayBuffer(8);
        const refInt16 = new Int16Array(refBuffer);
        const refUint8 = new Uint8Array(refBuffer);
        referenceEmplaceBack(refInt16, refInt16, refUint8, x, y, extrudeX, extrudeY, round, up, dir, linesofarScaled);

        // Struct layout output
        const array = createTestArray();
        const writer = lineVertex.writer(array);
        array.resize(1);
        writer.index = 0;
        writer.pos(x, y);
        writer.round(round);
        writer.up(up);
        writer.extrude(extrudeX, extrudeY);

        // dir+distance encoding — pack handles it declaratively
        writer.dirAndDistLow(dir, linesofarScaled);
        writer.distHigh(linesofarScaled);

        const structInt16 = new Int16Array(array.arrayBuffer);
        const structUint8 = new Uint8Array(array.arrayBuffer);

        // Compare byte-for-byte
        expect(structInt16[0]).toBe(refInt16[0]); // a_pos_normal.x
        expect(structInt16[1]).toBe(refInt16[1]); // a_pos_normal.y
        expect(structUint8[4]).toBe(refUint8[4]); // a_data.x (extrude x)
        expect(structUint8[5]).toBe(refUint8[5]); // a_data.y (extrude y)
        expect(structUint8[6]).toBe(refUint8[6]); // a_data.z (dir + dist low)
        expect(structUint8[7]).toBe(refUint8[7]); // a_data.w (dist high)
    });

    test('multiple vertices match reference', () => {
        const testCases = [
            {x: 0, y: 0, ex: 1.0, ey: 0.0, round: false, up: true, dir: 1, dist: 0},
            {x: 100, y: -50, ex: -0.3, ey: 0.7, round: true, up: false, dir: 0, dist: 100},
            {x: -200, y: 300, ex: 0.0, ey: -1.0, round: false, up: false, dir: -1, dist: 500},
        ];

        const array = createTestArray();
        const writer = lineVertex.writer(array);
        array.resize(testCases.length);

        for (let i = 0; i < testCases.length; i++) {
            const tc = testCases[i];
            const linesofarScaled = tc.dist * LINE_DISTANCE_SCALE;

            // Reference
            const refBuffer = new ArrayBuffer(8);
            const refInt16 = new Int16Array(refBuffer);
            const refUint8 = new Uint8Array(refBuffer);
            referenceEmplaceBack(refInt16, refInt16, refUint8, tc.x, tc.y, tc.ex, tc.ey, tc.round, tc.up, tc.dir, linesofarScaled);

            // Struct layout
            writer.index = i;
            writer.pos(tc.x, tc.y);
            writer.round(tc.round);
            writer.up(tc.up);
            writer.extrude(tc.ex, tc.ey);
            writer.dirAndDistLow(tc.dir, linesofarScaled);
            writer.distHigh(linesofarScaled);

            // Verify
            const structInt16 = new Int16Array(array.arrayBuffer);
            const structUint8 = new Uint8Array(array.arrayBuffer);
            const base16 = i * (gpuLayout.size / 2); // Int16 offset
            const base8 = i * gpuLayout.size;         // Uint8 offset

            expect(structInt16[base16 + 0]).toBe(refInt16[0]);
            expect(structInt16[base16 + 1]).toBe(refInt16[1]);
            expect(structUint8[base8 + 4]).toBe(refUint8[4]);
            expect(structUint8[base8 + 5]).toBe(refUint8[5]);
            expect(structUint8[base8 + 6]).toBe(refUint8[6]);
            expect(structUint8[base8 + 7]).toBe(refUint8[7]);
        }
    });
});
