// src/modular/layers/raster.test.ts
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {RasterLayer, RasterTileService} from '@modular/layers/raster.ts';
import type {DrawContext} from '@modular/core/render-extension.ts';
import type {TileID} from '@modular/core/types.ts';

// — RasterTileService tests —

describe('RasterTileService', () => {
    const FAKE_TILE: TileID = {z: 10, x: 1, y: 2, key: '10/1/2'};
    const FAKE_URL = 'https://tile.example.com/10/1/2.png';
    const FAKE_BITMAP = {} as ImageBitmap;

    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        }));
        vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(FAKE_BITMAP));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('request() returns [ImageBitmap] on success', async () => {
        const service = new RasterTileService();
        const result = await service.request(FAKE_TILE, FAKE_URL);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(FAKE_BITMAP);
    });

    it('request() returns [] when fetch is aborted', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), {name: 'AbortError'})));
        const service = new RasterTileService();
        const result = await service.request(FAKE_TILE, FAKE_URL);
        expect(result).toHaveLength(0);
    });

    it('cancel() causes request() to return []', async () => {
        let resolve!: (v: Response) => void;
        vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(r => { resolve = r; })));
        const service = new RasterTileService();
        const promise = service.request(FAKE_TILE, FAKE_URL);
        service.cancel(FAKE_TILE.key);
        resolve({arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))} as any);
        const result = await promise;
        expect(result).toHaveLength(0);
    });

    it('destroy() aborts all in-flight requests and they return []', async () => {
        let resolve!: (v: Response) => void;
        vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(r => { resolve = r; })));
        const service = new RasterTileService();
        const promise = service.request(FAKE_TILE, FAKE_URL);
        service.destroy();
        resolve({arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))} as any);
        const result = await promise;
        expect(result).toHaveLength(0);
    });
});

// — RasterLayer tests —

function makeGL() {
    return {
        createBuffer: vi.fn().mockReturnValue({}),
        bindBuffer: vi.fn(),
        bufferData: vi.fn(),
        getAttribLocation: vi.fn().mockReturnValue(0),
        enableVertexAttribArray: vi.fn(),
        vertexAttribPointer: vi.fn(),
        useProgram: vi.fn(),
        getUniformLocation: vi.fn().mockReturnValue({}),
        uniform1i: vi.fn(),
        uniform1f: vi.fn(),
        activeTexture: vi.fn(),
        bindTexture: vi.fn(),
        drawElements: vi.fn(),
        ARRAY_BUFFER: 34962,
        ELEMENT_ARRAY_BUFFER: 34963,
        STATIC_DRAW: 35044,
        FLOAT: 5126,
        TRIANGLES: 4,
        UNSIGNED_SHORT: 5123,
        TEXTURE_2D: 3553,
        TEXTURE0: 33984,
    } as unknown as WebGLRenderingContext;
}

function makeDrawContext(gl: WebGLRenderingContext, overrides: Partial<DrawContext & { tileTexture: WebGLTexture }> = {}) {
    const fakeProgram = {} as WebGLProgram;
    return {
        gl,
        programs: {
            get: vi.fn().mockReturnValue(fakeProgram),
        },
        tileID: {z: 10, x: 528, y: 341, key: '10/528/341'},
        meshBuffers: {
            vert: {} as WebGLBuffer,
            idx: {} as WebGLBuffer,
            indexCount: 6,
        },
        zoom: 10,
        paint: {opacity: 1},
        frameIndex: 0,
        imageAtlas: {},
        lineDashAtlas: {},
        tileTexture: {} as WebGLTexture,
        ...overrides,
    };
}

describe('RasterLayer', () => {
    it('has type "raster"', () => {
        const layer = new RasterLayer({source: 'osm'});
        expect(layer.type).toBe('raster');
    });

    it('has static programs array with a "raster" program definition', () => {
        expect(RasterLayer.programs).toBeInstanceOf(Array);
        expect(RasterLayer.programs.length).toBeGreaterThan(0);
        expect(RasterLayer.programs[0].name).toBe('raster');
        expect(typeof RasterLayer.programs[0].vertex).toBe('string');
        expect(typeof RasterLayer.programs[0].fragment).toBe('string');
    });

    it('has static TileService pointing to RasterTileService', () => {
        expect(RasterLayer.TileService).toBe(RasterTileService);
    });

    it('draw() calls gl.useProgram', () => {
        const gl = makeGL();
        const layer = new RasterLayer({source: 'osm'});
        const ctx = makeDrawContext(gl);
        layer.draw(ctx as any);
        expect(gl.useProgram).toHaveBeenCalled();
    });

    it('draw() calls gl.drawElements', () => {
        const gl = makeGL();
        const layer = new RasterLayer({source: 'osm'});
        const ctx = makeDrawContext(gl);
        layer.draw(ctx as any);
        expect(gl.drawElements).toHaveBeenCalledWith(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    });

    it('draw() calls gl.uniform1f for opacity', () => {
        const gl = makeGL();
        const layer = new RasterLayer({source: 'osm', opacity: 0.7});
        const ctx = makeDrawContext(gl, {paint: {opacity: 0.7}});
        layer.draw(ctx as any);
        expect(gl.uniform1f).toHaveBeenCalled();
    });

    it('opacity defaults to 1', () => {
        const layer = new RasterLayer({source: 'osm'});
        expect(layer.opacity).toBe(1);
    });
});
