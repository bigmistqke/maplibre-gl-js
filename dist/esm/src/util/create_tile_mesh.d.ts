import { type Context } from '../gl/context';
import { Mesh } from '../render/mesh';
export type CreateTileMeshOptions = {
    granularity?: number;
    generateBorders?: boolean;
    extendToNorthPole?: boolean;
    extendToSouthPole?: boolean;
};
export type TileMesh = {
    vertices: ArrayBuffer;
    indices: ArrayBuffer;
    uses32bitIndices: boolean;
};
export type IndicesType = '32bit' | '16bit' | undefined;
export declare function createTileMeshWithBuffers(context: Context, options: CreateTileMeshOptions): Mesh;
export declare function createTileMesh(options: CreateTileMeshOptions, forceIndicesSize?: IndicesType): TileMesh;
//# sourceMappingURL=create_tile_mesh.d.ts.map