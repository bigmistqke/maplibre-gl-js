import { describe, it, expect } from 'vitest'
import { PathInterpolator } from '@modular/layers/symbol/vendor/path_interpolator.ts'
import Point from '@mapbox/point-geometry'

describe('PathInterpolator', () => {
  it('constructs with zero-length path and has length 0', () => {
    const pi = new PathInterpolator([], 0)
    expect(pi.length).toBe(0)
  })

  it('computes correct total length for two-point segment', () => {
    const p0 = new Point(0, 0)
    const p1 = new Point(3, 4)
    const pi = new PathInterpolator([p0, p1], 0)
    expect(pi.length).toBeCloseTo(5, 5)  // 3-4-5 right triangle
  })

  it('paddedLength equals length minus 2 * padding', () => {
    const p0 = new Point(0, 0)
    const p1 = new Point(10, 0)
    const pi = new PathInterpolator([p0, p1], 2)
    expect(pi.paddedLength).toBeCloseTo(6, 5)  // 10 - 2 * 2
  })

  it('interpolates midpoint of a horizontal segment', () => {
    const p0 = new Point(0, 0)
    const p1 = new Point(10, 0)
    const pi = new PathInterpolator([p0, p1], 0)
    const mid = pi.lerp(0.5)
    expect(mid.x).toBeCloseTo(5, 5)
    expect(mid.y).toBeCloseTo(0, 5)
  })

  it('reset() updates points and recomputes distances', () => {
    const pi = new PathInterpolator([], 0)
    pi.reset([new Point(0, 0), new Point(6, 0)], 0)
    expect(pi.length).toBeCloseTo(6, 5)
  })
})
