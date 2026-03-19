import Point from '@mapbox/point-geometry'
import type { CameraState, TileID, TileMesh } from '../../core/types.ts'
import type { Projection, Viewport } from '../../core/projection.ts'
import { GLOBE_PRELUDE } from './globe-prelude.glsl.ts'
import { SubdivisionGranularityExpression, SubdivisionGranularitySetting } from './subdivision_granularity_settings.ts'
import { subdividePolygon } from './subdivision.ts'
import { computeGlobeMatrix, computeGlobeClippingPlane, computeTileMercatorCoords } from './globe-transform.ts'
// Copied from MapLibre's vertical_perspective_projection.ts (granularitySettingsGlobe)
const GLOBE_GRANULARITY = new SubdivisionGranularitySetting({
  fill:    new SubdivisionGranularityExpression(128, 2),
  line:    new SubdivisionGranularityExpression(512, 0),
  tile:    new SubdivisionGranularityExpression(128, 32),
  stencil: new SubdivisionGranularityExpression(128, 1),
  circle:  3,
})

const IDENTITY_MATRIX = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1])

export class GlobeProjection implements Projection {
  readonly vertexShaderPrelude = GLOBE_PRELUDE

  private _meshCache = new globalThis.Map<string, TileMesh>()

  getVisibleTiles(camera: CameraState, _viewport: Viewport): TileID[] {
    const { center, zoom } = camera
    const z = Math.floor(zoom)
    const n = Math.pow(2, z)  // tiles per axis

    // At very low zoom all tiles fit easily — skip the hemisphere test
    if (n <= 8) {
      const tiles: TileID[] = []
      for (let x = 0; x < n; x++)
        for (let y = 0; y < n; y++)
          tiles.push({ z, x, y, key: `${z}/${x}/${y}` })
      return tiles
    }

    // Camera direction as unit vector on the unit sphere
    const DEG = Math.PI / 180
    const cLng = center.lng * DEG
    const cLat = center.lat * DEG
    const cx = Math.cos(cLat) * Math.cos(cLng)
    const cy = Math.cos(cLat) * Math.sin(cLng)
    const cz = Math.sin(cLat)

    // Include any tile whose center dot-product with camera direction > -0.2
    // (covers the full visible hemisphere + a small buffer for edge tiles).
    const tiles: TileID[] = []
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        const tLng = ((x + 0.5) / n * 360 - 180) * DEG
        const tLat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n)))
        const dot = Math.cos(tLat) * Math.cos(tLng) * cx +
                    Math.cos(tLat) * Math.sin(tLng) * cy +
                    Math.sin(tLat) * cz
        if (dot > -0.2) tiles.push({ z, x, y, key: `${z}/${x}/${y}` })
      }
    }
    return tiles
  }

  setTileUniforms(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    tileID: TileID,
    camera: CameraState,
    viewport: Viewport,
  ): void {
    const matrix = computeGlobeMatrix(camera, viewport)
    const clippingPlane = computeGlobeClippingPlane(camera, viewport)
    const mercatorCoords = computeTileMercatorCoords(tileID.z, tileID.x, tileID.y)

    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_projection_matrix'), false, matrix)
    gl.uniform4fv(gl.getUniformLocation(program, 'u_projection_clipping_plane'), clippingPlane)
    gl.uniform4fv(gl.getUniformLocation(program, 'u_projection_tile_mercator_coords'), mercatorCoords)
    gl.uniform1f(gl.getUniformLocation(program, 'u_projection_transition'), 1.0)
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_projection_fallback_matrix'), false, IDENTITY_MATRIX)
  }

  getMeshForTile(tileID: TileID): TileMesh {
    const cached = this._meshCache.get(tileID.key)
    if (cached) return cached

    const granularity = GLOBE_GRANULARITY.tile.getGranularityForZoomLevel(tileID.z)
    const EXTENT = 4096
    const ring = [
      new Point(0, 0),
      new Point(EXTENT, 0),
      new Point(EXTENT, EXTENT),
      new Point(0, EXTENT),
    ]
    const canonical = { z: tileID.z, x: tileID.x, y: tileID.y }
    const result = subdividePolygon([ring], canonical, granularity, false)
    const mesh: TileMesh = {
      vertices: new Float32Array(result.verticesFlattened),
      indices: new Uint16Array(result.indicesTriangles),
    }
    this._meshCache.set(tileID.key, mesh)
    return mesh
  }
}
