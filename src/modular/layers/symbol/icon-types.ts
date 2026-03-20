// src/modular/layers/symbol/icon-types.ts
import { defineStruct } from '../../core/struct-array'

export type SpriteEntry = {
  x: number
  y: number
  width: number
  height: number
  pixelRatio?: number
}

export type SpriteData = { [name: string]: SpriteEntry }

export type IconTileData = {
  vertices: ArrayBuffer  // packed per IconVertexLayout, 4 verts per icon quad
  indices: ArrayBuffer   // Uint16Array, 6 indices per icon quad (two triangles)
  count: number          // number of draw indices
  /** Anchor positions in tile coords [0..8192] for collision detection */
  anchorPositions: { x: number; y: number }[]
}

// Per-vertex layout: anchor (int16 x2) + offset (int16 x2) + tex UV (uint16 x2) = 12 bytes stride
export const IconVertexLayout = defineStruct({
  ax: 'int16',   // anchor x in tile coords (0..8192)
  ay: 'int16',   // anchor y in tile coords (0..8192)
  ox: 'int16',   // pixel offset x, stored as value * 32
  oy: 'int16',   // pixel offset y, stored as value * 32
  u:  'uint16',  // atlas UV x in atlas pixels
  v:  'uint16',  // atlas UV y in atlas pixels
})
