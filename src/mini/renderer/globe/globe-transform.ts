// Adapted from MapLibre's src/geo/projection/globe_transform.ts
// Extracts only the camera matrix computation needed for globe rendering.
import { mat4, vec3 } from 'gl-matrix'
import type { CameraState } from '../../core/types.ts'
import type { Viewport } from '../../core/projection.ts'

const DEG_TO_RAD = Math.PI / 180

/**
 * Compute the globe projection matrix:
 * transforms 3D unit-sphere coordinates → clip space.
 */
export function computeGlobeMatrix(
  camera: CameraState,
  viewport: Viewport,
): Float32Array {
  const { center, zoom } = camera
  const { width, height } = viewport

  const worldSize = 256 * Math.pow(2, zoom)
  const globeRadius = worldSize / (2 * Math.PI)

  const lngRad = center.lng * DEG_TO_RAD
  const latRad = center.lat * DEG_TO_RAD
  const cosLat = Math.cos(latRad)
  const camDir = vec3.fromValues(
    Math.sin(lngRad) * cosLat,
    Math.sin(latRad),
    Math.cos(lngRad) * cosLat,
  )

  const cameraDist = globeRadius / Math.sin(0.5)
  const cameraPos = vec3.scale(vec3.create(), camDir, cameraDist)

  const up = vec3.fromValues(0, 1, 0)
  if (Math.abs(center.lat) > 85) {
    vec3.set(up, Math.cos(lngRad + Math.PI / 2), 0, Math.sin(lngRad + Math.PI / 2))
  }
  const viewMatrix = mat4.create()
  mat4.lookAt(viewMatrix, cameraPos, vec3.fromValues(0, 0, 0), up)

  const scaleMatrix = mat4.create()
  mat4.scale(scaleMatrix, scaleMatrix, [globeRadius, globeRadius, globeRadius])

  const fov = 0.5
  const aspect = width / height
  const near = globeRadius * 0.01
  const far = cameraDist + globeRadius * 2
  const projMatrix = mat4.create()
  mat4.perspective(projMatrix, fov * 2, aspect, near, far)

  const combined = mat4.create()
  mat4.multiply(combined, projMatrix, viewMatrix)
  mat4.multiply(combined, combined, scaleMatrix)

  return combined as Float32Array
}

/**
 * Compute the clipping plane for a globe — hides the backfacing side.
 * Returns vec4 (nx, ny, nz, d).
 */
export function computeGlobeClippingPlane(camera: CameraState): Float32Array {
  const lngRad = camera.center.lng * DEG_TO_RAD
  const latRad = camera.center.lat * DEG_TO_RAD
  const cosLat = Math.cos(latRad)
  return new Float32Array([
    Math.sin(lngRad) * cosLat,
    Math.sin(latRad),
    Math.cos(lngRad) * cosLat,
    -0.02,
  ])
}

/**
 * Tile mercator coordinates for the globe prelude uniform.
 * Returns vec4: (mercatorX0, mercatorY0, mercatorWidth, mercatorHeight)
 */
export function computeTileMercatorCoords(
  z: number, x: number, y: number,
): Float32Array {
  const scale = 1 / Math.pow(2, z)
  const EXTENT = 4096
  return new Float32Array([
    x * scale,
    y * scale,
    scale / EXTENT,
    scale / EXTENT,
  ])
}
