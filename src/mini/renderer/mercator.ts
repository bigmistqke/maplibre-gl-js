// src/mini/renderer/mercator.ts
import type { CameraState, TileID } from '../core/types.ts'
import type { Projection, Viewport } from '../core/projection.ts'

export function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom)
}

export function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
}

export class MercatorProjection implements Projection {
  getVisibleTiles(camera: CameraState, viewport: Viewport): TileID[] {
    const { center, zoom } = camera
    const { width, height } = viewport
    const z = Math.floor(zoom)
    const tileW = 256 * Math.pow(2, zoom - z)

    // Center in world pixels at fractional zoom
    const cx = lngToTileX(center.lng, zoom) * 256
    const cy = latToTileY(center.lat, zoom) * 256

    const maxTile = Math.pow(2, z) - 1

    const xMin = Math.max(0, Math.floor((cx - width / 2) / tileW))
    const xMax = Math.min(maxTile, Math.floor((cx + width / 2) / tileW))
    const yMin = Math.max(0, Math.floor((cy - height / 2) / tileW))
    const yMax = Math.min(maxTile, Math.floor((cy + height / 2) / tileW))

    const tiles: TileID[] = []
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tiles.push({ z, x, y, key: `${z}/${x}/${y}` })
      }
    }
    return tiles
  }

  getTileMatrix(tileID: TileID, camera: CameraState, viewport: Viewport): Float32Array {
    const { center, zoom } = camera
    const { width, height } = viewport
    const z = tileID.z
    const tileW = 256 * Math.pow(2, zoom - z)

    const cx = lngToTileX(center.lng, zoom) * 256
    const cy = latToTileY(center.lat, zoom) * 256

    // Bake 1/4096 into the matrix so shaders can use raw MVT coords [0,4096]
    // without a per-vertex division. All scaling is done here in float64.
    const MVT = 4096
    const sx = (2 * tileW) / (width * MVT)
    const sy = -(2 * tileW) / (height * MVT)  // negative: clip Y up, screen Y down
    const tx = (2 * (tileID.x * tileW - cx)) / width
    const ty = (2 * (cy - tileID.y * tileW)) / height

    // Column-major 4×4 matrix
    // col0=[sx,0,0,0], col1=[0,sy,0,0], col2=[0,0,1,0], col3=[tx,ty,0,1]
    return new Float32Array([
      sx,  0,  0, 0,
       0, sy,  0, 0,
       0,  0,  1, 0,
      tx, ty,  0, 1,
    ])
  }
}
