// src/mini/core/projection.ts
import type { CameraState, TileID } from './types.ts'

export interface Viewport {
  width: number
  height: number
}

export interface Projection {
  /** Tile IDs visible in the current camera + viewport */
  getVisibleTiles(camera: CameraState, viewport: Viewport): TileID[]
  /** Tile-space [0,1]² → clip-space 4×4 matrix (column-major Float32Array, 16 elements) */
  getTileMatrix(tileID: TileID, camera: CameraState, viewport: Viewport): Float32Array
}
