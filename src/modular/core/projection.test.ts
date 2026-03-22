// src/modular/core/projection.test.ts
import {describe, it, expect, vi} from 'vitest';
import type {Projection} from '@modular/core/projection.ts';

describe('Projection', () => {
    it('Projection interface is satisfied by duck-typed object', () => {
        const proj: Projection = {
            vertexShaderPrelude: 'vec4 projectTile(vec2 p){return vec4(p,0.0,1.0);}',
            getVisibleTiles: () => [],
            setTileUniforms: vi.fn(),
            getMeshForTile: vi.fn().mockReturnValue({
                vertices: new Float32Array([0, 0, 4096, 0, 0, 4096, 4096, 4096]),
                indices: new Uint16Array([0, 1, 2, 1, 3, 2]),
            }),
            getTileMatrix: vi.fn().mockReturnValue(new Float32Array(16)),
        };
        expect(typeof proj.vertexShaderPrelude).toBe('string');
        expect(typeof proj.getVisibleTiles).toBe('function');
        expect(typeof proj.setTileUniforms).toBe('function');
        expect(typeof proj.getMeshForTile).toBe('function');
    });

    it('getMeshForTile returns a valid tile mesh', () => {
        const mockMesh = {
            vertices: new Float32Array([0, 0, 4096, 0, 0, 4096, 4096, 4096]),
            indices: new Uint16Array([0, 1, 2, 1, 3, 2]),
        };
        const proj: Projection = {
            vertexShaderPrelude: 'vec4 projectTile(vec2 p){return vec4(p,0.0,1.0);}',
            getVisibleTiles: () => [],
            setTileUniforms: vi.fn(),
            getMeshForTile: vi.fn().mockReturnValue(mockMesh),
            getTileMatrix: vi.fn().mockReturnValue(new Float32Array(16)),
        };
        const mesh = proj.getMeshForTile({z: 10, x: 512, y: 341, key: '10/512/341'});
        expect(mesh.vertices).toBeInstanceOf(Float32Array);
        expect(mesh.indices).toBeInstanceOf(Uint16Array);
        expect(vi.mocked(proj.getMeshForTile)).toHaveBeenCalledWith({
            z: 10,
            x: 512,
            y: 341,
            key: '10/512/341',
        });
    });
});
