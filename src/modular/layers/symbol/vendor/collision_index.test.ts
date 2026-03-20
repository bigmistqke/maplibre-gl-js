import { describe, it, expect } from 'vitest'
import { CollisionIndex } from './collision_index.ts'

// Minimal transform satisfying SimpleTransform
const makeTransform = (w = 800, h = 600) => ({
  width: w,
  height: h,
  cameraToCenterDistance: 500,
  pitch: 0,
  zoom: 5,
})

describe('CollisionIndex', () => {
  it('constructs without error', () => {
    const ci = new CollisionIndex(makeTransform())
    expect(ci).toBeTruthy()
  })

  it('allows placing a non-overlapping box', () => {
    const ci = new CollisionIndex(makeTransform())
    const box = { x1: 100, y1: 100, x2: 200, y2: 150, padding: 0 }
    const result = ci.placeCollisionBox(box, 'never', 1)
    expect(result.placeable).toBe(true)
  })

  it('detects overlap after insertion', () => {
    const ci = new CollisionIndex(makeTransform())
    const box = { x1: 100, y1: 100, x2: 200, y2: 150, padding: 0 }
    const key = { bucketInstanceId: 0, featureIndex: 0, collisionGroupID: 0, overlapMode: 'never' as const }
    ci.insertCollisionBox([100, 100, 200, 150], 'never', key)
    const result2 = ci.placeCollisionBox(
      { x1: 120, y1: 110, x2: 180, y2: 140, padding: 0 },
      'never', 1,
    )
    expect(result2.placeable).toBe(false)
  })
})
