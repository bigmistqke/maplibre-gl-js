// src/modular/layers/terrain/terrain-mesh.ts

const GRID_SIZE = 32;  // number of quads per side; 32×32 = 1024 quads, 1089 vertices

/** Build a shared 32×32 grid mesh in [0,1]×[0,1] tile space. */
export function buildTerrainMesh(): { vertices: Float32Array; indices: Uint32Array } {
    const n = GRID_SIZE + 1;  // vertices per side
    const vertices = new Float32Array(n * n * 2);
    let vi = 0;
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            vertices[vi++] = x / GRID_SIZE;
            vertices[vi++] = y / GRID_SIZE;
        }
    }

    const indices = new Uint32Array(GRID_SIZE * GRID_SIZE * 6);
    let ii = 0;
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const tl = y * n + x;
            const tr = tl + 1;
            const bl = tl + n;
            const br = bl + 1;
            // CCW winding (front face) matching MapLibre's terrain.ts getTerrainMesh()
            indices[ii++] = tl; indices[ii++] = bl; indices[ii++] = br;
            indices[ii++] = tl; indices[ii++] = br; indices[ii++] = tr;
        }
    }

    return {vertices, indices};
}
