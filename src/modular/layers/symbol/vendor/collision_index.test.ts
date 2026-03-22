import { describe, it, expect } from 'vitest'
import { CollisionIndex } from './collision_index.ts'
import type { ISymbolTransform } from './types.ts'
import type { mat4 } from 'gl-matrix'

// Minimal ISymbolTransform satisfying the interface
const makeTransform = (w = 800, h = 600): ISymbolTransform => ({
  width: w,
  height: h,
  cameraToCenterDistance: 500,
  pitch: 0,
  angle: 0,
  zoom: 5,
  rollInRadians: 0,
  pitchInRadians: 0,
  bearingInRadians: 0,
  pixelsToClipSpaceMatrix: new Float32Array(16) as unknown as mat4,
  getPitchedTextCorrection: (_x, _y, _tileID) => 1,
  calculatePosMatrix: (_tileID) => new Float32Array(16) as unknown as mat4,
  projectTileCoordinates: (x, y, _tileID, _getElevation) => ({
    point: { x: (x / 4096) * 2 - 1, y: 1 - (y / 4096) * 2 } as any,
    signedDistanceFromCamera: 500,
    isOccluded: false,
  }),
})

// Minimal tile IDs for tests
const tileID = { overscaledZ: 5 }
const unwrappedTileID = { canonical: { z: 5, x: 0, y: 0 }, wrap: 0 }

describe('CollisionIndex', () => {
  it('constructs without error', () => {
    const ci = new CollisionIndex(makeTransform())
    expect(ci).toBeTruthy()
  })

  it('allows placing a non-overlapping box', () => {
    const ci = new CollisionIndex(makeTransform())
    // Box with anchorPoint at (150, 125), offsets spanning -50..50
    const box = { anchorPointX: 150, anchorPointY: 125, x1: -50, y1: -25, x2: 50, y2: 25 }
    const result = ci.placeCollisionBox(
      box,
      'never',
      /*textPixelRatio*/ 1,
      tileID,
      unwrappedTileID,
      /*pitchWithMap*/ false,
      /*rotateWithMap*/ false,
      /*translation*/ [0, 0],
    )
    expect(result.placeable).toBe(true)
  })

  it('detects overlap after insertion', () => {
    const ci = new CollisionIndex(makeTransform())
    const box = { anchorPointX: 150, anchorPointY: 125, x1: -50, y1: -25, x2: 50, y2: 25 }

    // First placement
    const result1 = ci.placeCollisionBox(
      box,
      'never',
      1,
      tileID,
      unwrappedTileID,
      false,
      false,
      [0, 0],
    )
    // Insert it
    ci.insertCollisionBox(result1.box, 'never', /*ignorePlacement*/ false, 0, 0, 0)

    // Second placement at overlapping position
    const result2 = ci.placeCollisionBox(
      { anchorPointX: 160, anchorPointY: 130, x1: -50, y1: -25, x2: 50, y2: 25 },
      'never',
      1,
      tileID,
      unwrappedTileID,
      false,
      false,
      [0, 0],
    )
    expect(result2.placeable).toBe(false)
  })
})
