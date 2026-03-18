// src/mini/core/projection.test.ts
import { describe, it, expect } from 'vitest'
import type { Projection } from './projection.ts'

describe('Projection', () => {
  it('Projection interface is satisfied by duck-typed object', () => {
    const proj: Projection = {
      getVisibleTiles: () => [],
      getTileMatrix: () => new Float32Array(16),
    }
    expect(typeof proj.getVisibleTiles).toBe('function')
    expect(typeof proj.getTileMatrix).toBe('function')
  })

  it('getTileMatrix returns a Float32Array of length 16', () => {
    const proj: Projection = {
      getVisibleTiles: () => [],
      getTileMatrix: () => new Float32Array(16),
    }
    const matrix = proj.getTileMatrix(
      { z: 10, x: 512, y: 341, key: '10/512/341' },
      { center: { lng: 4.9, lat: 52.37 }, zoom: 10, bearing: 0, pitch: 0, groundElevation: 0 },
      { width: 512, height: 512 },
    )
    expect(matrix).toBeInstanceOf(Float32Array)
    expect(matrix.length).toBe(16)
  })
})
