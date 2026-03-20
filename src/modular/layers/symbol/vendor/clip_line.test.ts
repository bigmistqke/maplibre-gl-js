import { describe, it, expect } from 'vitest'
import { clipLine } from './clip_line.ts'
import Point from '@mapbox/point-geometry'

describe('clipLine', () => {
  it('returns empty array for empty input', () => {
    expect(clipLine([], 0, 0, 100, 100)).toEqual([])
  })

  it('returns segment fully inside the box unchanged (approximately)', () => {
    const line = [new Point(10, 10), new Point(90, 90)]
    const result = clipLine([line], 0, 0, 100, 100)
    expect(result.length).toBe(1)
    expect(result[0].length).toBe(2)
  })

  it('clips segment that starts outside the left edge', () => {
    const line = [new Point(-50, 50), new Point(50, 50)]
    const result = clipLine([line], 0, 0, 100, 100)
    expect(result.length).toBe(1)
    // The clipped line must start at x=0 and end at x=50
    expect(result[0][0].x).toBeCloseTo(0, 3)
    expect(result[0][result[0].length - 1].x).toBeCloseTo(50, 3)
  })

  it('returns empty array for segment entirely outside the box', () => {
    const line = [new Point(-100, 50), new Point(-10, 50)]
    const result = clipLine([line], 0, 0, 100, 100)
    expect(result.length).toBe(0)
  })

  it('splits a line that crosses a box boundary into two segments', () => {
    // Line enters and exits the box through the left and right edges
    const line = [new Point(-10, 50), new Point(50, 50), new Point(110, 50)]
    const result = clipLine([line], 0, 0, 100, 100)
    expect(result.length).toBe(1)  // one clipped segment inside box
  })

  it('handles multiple input lines', () => {
    const line1 = [new Point(10, 10), new Point(90, 10)]
    const line2 = [new Point(10, 90), new Point(90, 90)]
    const result = clipLine([line1, line2], 0, 0, 100, 100)
    expect(result.length).toBe(2)
  })
})
