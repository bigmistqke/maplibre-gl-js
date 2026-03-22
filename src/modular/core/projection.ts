import type { CameraState, TileID, TileMesh } from '@modular/core/types.ts'

export interface Viewport {
  width: number
  height: number
}

export interface Projection {
  /**
   * GLSL prepended to every layer vertex shader AND the stencil shader.
   * Must define: vec4 projectTile(vec2 pos)
   */
  readonly vertexShaderPrelude: string

  /** Tile IDs visible in the current camera + viewport */
  getVisibleTiles(camera: CameraState, viewport: Viewport): TileID[]

  /**
   * Set all projection-specific uniforms for a tile on a compiled program.
   * Called by the renderer before each layer.draw() and before writeTileStencil.
   * Mercator: sets u_matrix.
   * Globe: sets u_projection_matrix, u_projection_tile_mercator_coords,
   *        u_projection_clipping_plane, u_projection_transition.
   */
  setTileUniforms(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    program: WebGLProgram,
    tileID: TileID,
    camera: CameraState,
    viewport: Viewport,
  ): void

  /**
   * Returns the 4×4 matrix that transforms tile coordinates [0, EXTENT]
   * to clip space. Same matrix the shader uses via projectTile().
   * Used for CPU-side projection that must match the GPU output exactly
   * (e.g., line label glyph placement).
   */
  getTileMatrix(tileID: TileID, camera: CameraState, viewport: Viewport): Float32Array

  /**
   * Returns the tile mesh for this tile.
   * Mercator: static flat quad [0,4096]² (no allocation per call).
   * Globe: subdivided curved mesh, cached by tileID.key.
   */
  getMeshForTile(tileID: TileID): TileMesh
}
