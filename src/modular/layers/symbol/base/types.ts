// src/modular/layers/symbol/base/types.ts

/** Screen-space collision data for one tile, passed from layer to LayoutEngine */
export type CollisionData = {
  /** Tile cache key */
  tileKey: string
  /** Label anchor centres in screen pixels, one per placed label */
  anchors: Array<{ x: number; y: number }>
  /**
   * Screen-pixel AABBs [x1, y1, x2, y2] per label — parallel with anchors.
   * Invariant: the i-th element of the opacity Float32Array returned by
   * LayoutEngine corresponds to the i-th anchor/box in this array.
   */
  boxes: Array<[number, number, number, number]>
}

/** GPU-uploaded vertex/index buffers for one tile */
export type GPUBucket = {
  verts: WebGLBuffer
  idx: WebGLBuffer
  count: number
  /** Number of index-buffer indices per label (for per-label draw calls) */
  indicesPerLabel?: number[]
}
