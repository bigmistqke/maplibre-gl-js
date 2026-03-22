import {describe, it, expect, vi} from 'vitest';
import {GlobeProjection} from '@modular/renderer/globe/globe-projection.ts';

const camera = {center: {lng: 4.9, lat: 52.37}, zoom: 3, bearing: 0, pitch: 0, groundElevation: 0};
const viewport = {width: 512, height: 512};
const tileID = {z: 3, x: 4, y: 2, key: '3/4/2'};

describe('GlobeProjection', () => {
    it('vertexShaderPrelude contains projectTile function', () => {
        const proj = new GlobeProjection();
        expect(proj.vertexShaderPrelude).toContain('projectTile');
        expect(proj.vertexShaderPrelude).toContain('u_projection_matrix');
    });

    it('getVisibleTiles returns non-empty array', () => {
        const proj = new GlobeProjection();
        const tiles = proj.getVisibleTiles(camera, viewport);
        expect(tiles.length).toBeGreaterThan(0);
    });

    it('getVisibleTiles returns TileIDs with valid keys', () => {
        const proj = new GlobeProjection();
        for (const tile of proj.getVisibleTiles(camera, viewport)) {
            expect(tile.key).toBe(`${tile.z}/${tile.x}/${tile.y}`);
        }
    });

    it('getMeshForTile returns a mesh with more than 4 vertices (subdivided)', () => {
        const proj = new GlobeProjection();
        const mesh = proj.getMeshForTile(tileID);
        expect(mesh.vertices.length).toBeGreaterThan(8);
        expect(mesh.indices.length).toBeGreaterThan(6);
    });

    it('getMeshForTile caches by tileID.key (same object returned)', () => {
        const proj = new GlobeProjection();
        const a = proj.getMeshForTile(tileID);
        const b = proj.getMeshForTile(tileID);
        expect(a).toBe(b);
    });

    it('setTileUniforms sets u_projection_matrix', () => {
        const proj = new GlobeProjection();
        const gl = {
            getUniformLocation: vi.fn().mockReturnValue({}),
            uniformMatrix4fv: vi.fn(),
            uniform4fv: vi.fn(),
            uniform1f: vi.fn(),
        } as any;
        proj.setTileUniforms(gl, {} as any, tileID, camera, viewport);
        const locations = (gl.getUniformLocation as any).mock.calls.map((c: any[]) => c[1]);
        expect(locations).toContain('u_projection_matrix');
        expect(locations).toContain('u_projection_tile_mercator_coords');
        expect(locations).toContain('u_projection_clipping_plane');
        expect(locations).toContain('u_projection_transition');
    });
});
