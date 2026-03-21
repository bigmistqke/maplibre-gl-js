// src/modular/renderer/mercator.ts
import { mat4, type mat4 as Mat4Type } from 'gl-matrix'
import type { CameraState, TileID, TileMesh } from '../core/types.ts'
import type { Projection, Viewport } from '../core/projection.ts'

export function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom)
}

export function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
}

// Static flat quad mesh [0,4096]² — shared across all tiles, no allocation per call
const FLAT_QUAD_MESH: TileMesh = {
  vertices: new Float32Array([0, 0, 4096, 0, 0, 4096, 4096, 4096]),
  indices: new Uint16Array([0, 1, 2, 1, 3, 2]),
}

const DEG = Math.PI / 180
const EXTENT = 4096
const TILE_SIZE = 256
// Same FOV as globe / MapLibre default
const FOV = 0.6435011087932844  // Math.atan(1) * 2 ≈ 36.87°
// Earth circumference in metres (equatorial)
const EARTH_CIRC = 2 * Math.PI * 6371008.8

export class MercatorProjection implements Projection {
  readonly vertexShaderPrelude = /* glsl */`
    uniform mat4 u_matrix;
    vec4 projectTile(vec2 pos) { return u_matrix * vec4(pos, 0.0, 1.0); }
  `

  getVisibleTiles(camera: CameraState, viewport: Viewport): TileID[] {
    const { center, zoom } = camera
    const { width, height } = viewport
    const z = Math.floor(zoom)
    const tileW = 256 * Math.pow(2, zoom - z)

    // Center in world pixels at fractional zoom
    const cx = lngToTileX(center.lng, zoom) * 256
    const cy = latToTileY(center.lat, zoom) * 256

    const maxTile = Math.pow(2, z) - 1

    // Expand the bounding box when pitched so the visible frustum is covered
    const pitch = camera.pitch ?? 0
    const extraY = Math.round(pitch / 10)  // ~1 extra tile row per 10° of pitch

    const xMin = Math.max(0, Math.floor((cx - width / 2) / tileW))
    const xMax = Math.min(maxTile, Math.floor((cx + width / 2) / tileW))
    const yMin = Math.max(0, Math.floor((cy - height / 2) / tileW) - extraY)
    const yMax = Math.min(maxTile, Math.floor((cy + height / 2) / tileW))

    const tiles: TileID[] = []
    for (let x = xMin; x <= xMax; x++)
      for (let y = yMin; y <= yMax; y++)
        tiles.push({ z, x, y, key: `${z}/${x}/${y}` })
    return tiles
  }

  setTileUniforms(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    program: WebGLProgram,
    tileID: TileID,
    camera: CameraState,
    viewport: Viewport,
  ): void {
    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'u_matrix'),
      false,
      this._getTileMatrix(tileID, camera, viewport),
    )
  }

  getMeshForTile(_tileID: TileID): TileMesh {
    return FLAT_QUAD_MESH
  }

  /** @internal Used by setTileUniforms */
  _getTileMatrix(tileID: TileID, camera: CameraState, viewport: Viewport): Float32Array {
    const { center, zoom } = camera
    const pitch   = camera.pitch   ?? 0
    const bearing = camera.bearing ?? 0
    const { width, height } = viewport

    const worldSize = TILE_SIZE * Math.pow(2, zoom)

    // Camera-to-centre distance — same formula as globe/MapLibre
    const cameraToCenterDistance = (height / 2) / Math.tan(FOV / 2)

    // Centre in world pixels
    const cx = lngToTileX(center.lng, zoom) * TILE_SIZE
    const cy = latToTileY(center.lat, zoom) * TILE_SIZE

    // pixelsPerMeter: scale elevation (in metres) to the same world-pixel units
    // used for X/Y.  At latitude `lat` the horizontal world spans
    // EARTH_CIRC * cos(lat) metres over `worldSize` pixels.
    const latRad = center.lat * DEG
    const pixelsPerMeter = worldSize / (EARTH_CIRC * Math.cos(latRad))

    const nearZ = 0.5
    const farZ  = cameraToCenterDistance * 10

    // ── Perspective × view matrix (MapLibre mercator order) ──────────────────
    // 1. Perspective projection
    // 2. Flip Y  (world Y increases south; clip Y increases up)
    // 3. Translate camera back from the centre point
    // 4. Pitch  — rotate around X to tilt the camera down
    // 5. Bearing — rotate around Z for compass heading
    // 6. Translate so the map centre lands at the world origin
    // 7. Scale Z so elevation in metres maps to world-pixel units
    const m = mat4.create() as unknown as Mat4Type
    mat4.perspective(m, FOV, width / height, nearZ, farZ)
    mat4.scale    (m, m, [1, -1, 1])
    mat4.translate(m, m, [0, 0, -cameraToCenterDistance])
    mat4.rotateX  (m, m,  pitch   * DEG)
    mat4.rotateZ  (m, m, -bearing * DEG)
    mat4.translate(m, m, [-cx, -cy, 0])
    mat4.scale    (m, m, [1, 1, pixelsPerMeter])

    // ── Tile matrix: place tile [0,EXTENT]² in world space ───────────────────
    const tileScale = worldSize / Math.pow(2, tileID.z)
    const t = mat4.create() as unknown as Mat4Type
    mat4.translate(t, t, [tileID.x * tileScale, tileID.y * tileScale, 0])
    mat4.scale    (t, t, [tileScale / EXTENT, tileScale / EXTENT, 1])

    mat4.multiply(m, m, t)
    return m as unknown as Float32Array
  }
}
