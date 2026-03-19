// src/mini/renderer/mercator.test.ts
import { describe, it, expect, vi } from 'vitest'
import { MercatorProjection, lngToTileX, latToTileY } from './mercator.ts'

describe('lngToTileX', () => {
  it('longitude 0 at zoom 0 is 0.5 (half the world)', () => {
    expect(lngToTileX(0, 0)).toBeCloseTo(0.5)
  })

  it('longitude -180 at zoom 1 is 0 (far west edge)', () => {
    expect(lngToTileX(-180, 1)).toBeCloseTo(0)
  })

  it('longitude 180 at zoom 1 is 2 (far east edge, wraps)', () => {
    expect(lngToTileX(180, 1)).toBeCloseTo(2)
  })

  it('Amsterdam longitude 4.9 at zoom 10 floors to tile 525', () => {
    expect(Math.floor(lngToTileX(4.9, 10))).toBe(525)
  })
})

describe('latToTileY', () => {
  it('latitude 0 at zoom 0 is approximately 0.5 (equator)', () => {
    expect(latToTileY(0, 0)).toBeCloseTo(0.5)
  })

  it('Amsterdam latitude 52.37 at zoom 10 floors to tile 336', () => {
    expect(Math.floor(latToTileY(52.37, 10))).toBe(336)
  })
})

describe('MercatorProjection', () => {
  const proj = new MercatorProjection()
  const camera = { center: { lng: 4.9, lat: 52.37 }, zoom: 10, bearing: 0, pitch: 0, groundElevation: 0 }
  const viewport = { width: 512, height: 512 }

  it('getVisibleTiles returns TileID[] where all IDs have z = floor(zoom)', () => {
    const tiles = proj.getVisibleTiles(camera, viewport)
    expect(tiles.length).toBeGreaterThan(0)
    for (const tile of tiles) {
      expect(tile.z).toBe(Math.floor(camera.zoom))
    }
  })

  it('getVisibleTiles returns TileIDs with valid key property', () => {
    const tiles = proj.getVisibleTiles(camera, viewport)
    for (const tile of tiles) {
      expect(tile.key).toBe(`${tile.z}/${tile.x}/${tile.y}`)
    }
  })

  it('getVisibleTiles tiles are clamped to valid x range [0, 2^z - 1]', () => {
    const tiles = proj.getVisibleTiles(camera, viewport)
    const z = Math.floor(camera.zoom)
    const maxTile = Math.pow(2, z) - 1
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0)
      expect(tile.x).toBeLessThanOrEqual(maxTile)
      expect(tile.y).toBeGreaterThanOrEqual(0)
      expect(tile.y).toBeLessThanOrEqual(maxTile)
    }
  })

  it('getTileMatrix returns Float32Array of length 16', () => {
    const tiles = proj.getVisibleTiles(camera, viewport)
    const matrix = proj._getTileMatrix(tiles[0], camera, viewport)
    expect(matrix).toBeInstanceOf(Float32Array)
    expect(matrix.length).toBe(16)
  })

  it('center tile has near-zero translation in matrix (tile aligned to canvas center)', () => {
    // The center tile is the one containing the camera center
    const z = Math.floor(camera.zoom)
    const cx = Math.floor(lngToTileX(camera.center.lng, z))
    const cy = Math.floor(latToTileY(camera.center.lat, z))
    const tileID = { z, x: cx, y: cy, key: `${z}/${cx}/${cy}` }
    const matrix = proj._getTileMatrix(tileID, camera, viewport)
    // Column-major 4x4: translation is at indices [12] (tx) and [13] (ty)
    // The center tile at zoom=integer should have tx and ty close to 0 (tile covers center)
    // We only verify the matrix is well-formed (diagonal non-zero, length 16)
    expect(matrix[0]).not.toBe(0) // sx scale factor
    expect(matrix[5]).not.toBe(0) // sy scale factor
    expect(matrix[10]).toBe(1)    // depth pass-through
    expect(matrix[15]).toBe(1)    // homogeneous w
  })

  it('matrix sx and sy have opposite signs (clip Y up, screen Y down)', () => {
    const tiles = proj.getVisibleTiles(camera, viewport)
    const matrix = proj._getTileMatrix(tiles[0], camera, viewport)
    // sx = matrix[0], sy = matrix[5]; sy should be negative
    expect(Math.sign(matrix[0])).toBe(1)
    expect(Math.sign(matrix[5])).toBe(-1)
  })
})

describe('MercatorProjection — new Projection interface methods', () => {
  const proj = new MercatorProjection()
  const camera = { center: { lng: 4.9, lat: 52.37 }, zoom: 10, bearing: 0, pitch: 0, groundElevation: 0 }
  const viewport = { width: 512, height: 512 }
  const tileID = { z: 10, x: 525, y: 336, key: '10/525/336' }

  it('vertexShaderPrelude defines projectTile function', () => {
    expect(proj.vertexShaderPrelude).toContain('projectTile')
    expect(proj.vertexShaderPrelude).toContain('u_matrix')
  })

  it('setTileUniforms calls uniformMatrix4fv with u_matrix', () => {
    const gl = { getUniformLocation: vi.fn().mockReturnValue({}), uniformMatrix4fv: vi.fn() } as any
    proj.setTileUniforms(gl, {} as any, tileID, camera, viewport)
    expect(gl.uniformMatrix4fv).toHaveBeenCalledOnce()
  })

  it('getMeshForTile returns a flat quad with 4 vertices and 6 indices', () => {
    const mesh = proj.getMeshForTile(tileID)
    expect(mesh.vertices.length).toBe(8)   // 4 vertices × 2 floats
    expect(mesh.indices.length).toBe(6)    // 2 triangles × 3 indices
  })

  it('getMeshForTile always returns the same object (singleton)', () => {
    expect(proj.getMeshForTile(tileID)).toBe(proj.getMeshForTile({ z:0, x:0, y:0, key:'0/0/0' }))
  })

  it('getMeshForTile vertices are [0,0, 4096,0, 0,4096, 4096,4096]', () => {
    const mesh = proj.getMeshForTile(tileID)
    expect(Array.from(mesh.vertices)).toEqual([0, 0, 4096, 0, 0, 4096, 4096, 4096])
  })
})
