// src/modular/layers/symbol/line-projection.test.ts
import { describe, it, expect } from 'vitest'
import { placeGlyphAlongLine, placeGlyphsAlongLine, updateLineLabels } from './line-projection.ts'
import type { LineLabelInfo } from './types.ts'

describe('placeGlyphAlongLine', () => {
  it('places a glyph at offset 0 at the anchor vertex', () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]
    const result = placeGlyphAlongLine(line, 1, 0)
    expect(result).not.toBeNull()
    expect(result!.x).toBeCloseTo(100)
    expect(result!.y).toBeCloseTo(0)
  })

  it('places a glyph at positive offset forward along the line', () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]
    const result = placeGlyphAlongLine(line, 1, 50)
    expect(result).not.toBeNull()
    expect(result!.x).toBeCloseTo(150)
    expect(result!.y).toBeCloseTo(0)
  })

  it('places a glyph at negative offset backward along the line', () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]
    const result = placeGlyphAlongLine(line, 1, -30)
    expect(result).not.toBeNull()
    expect(result!.x).toBeCloseTo(70)
    expect(result!.y).toBeCloseTo(0)
  })

  it('computes correct angle on a diagonal segment', () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 100 }]
    const result = placeGlyphAlongLine(line, 0, 10)
    expect(result).not.toBeNull()
    expect(result!.angle).toBeCloseTo(Math.PI / 4)
  })

  it('returns null when offset exceeds line length', () => {
    const line = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    const result = placeGlyphAlongLine(line, 0, 50)
    expect(result).toBeNull()
  })

  it('handles crossing multiple segments', () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]
    const result = placeGlyphAlongLine(line, 0, 150)
    expect(result).not.toBeNull()
    expect(result!.x).toBeCloseTo(100)
    expect(result!.y).toBeCloseTo(50)
    expect(result!.angle).toBeCloseTo(Math.PI / 2)
  })
})

describe('placeGlyphsAlongLine', () => {
  it('places all glyphs for a straight horizontal line', () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]
    const glyphOffsets = [-20, -10, 0, 10, 20]
    const result = placeGlyphsAlongLine(line, 1, glyphOffsets)
    expect(result).toHaveLength(5)
    expect(result[0].x).toBeCloseTo(80)
    expect(result[2].x).toBeCloseTo(100)
    expect(result[4].x).toBeCloseTo(120)
    for (const g of result) expect(g.angle).toBeCloseTo(0)
  })

  it('returns empty array when a glyph falls off the line', () => {
    const line = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    const glyphOffsets = [-100, 0, 100]
    const result = placeGlyphsAlongLine(line, 0, glyphOffsets)
    expect(result).toHaveLength(0)
  })

  it('flips labels that would read right-to-left (keepUpright)', () => {
    // Line goes right-to-left: anchor at (200,0), line from (200,0) to (0,0)
    // Without flipping, glyphs would be placed right-to-left (first.x > last.x)
    const line = [{ x: 200, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }]
    const glyphOffsets = [-20, -10, 0, 10, 20]
    const result = placeGlyphsAlongLine(line, 1, glyphOffsets)
    expect(result).toHaveLength(5)

    // After flipping, first glyph should have lower x than last glyph (reads left-to-right)
    expect(result[0].x).toBeLessThan(result[4].x)

    // On a right-to-left line with negated offsets, the walk goes forward
    // along segments pointing left (angle = π). The shader uses this angle
    // to rotate glyphs so they face the reading direction.
    for (const g of result) {
      expect(Math.abs(g.angle)).toBeCloseTo(Math.PI, 1)
    }
  })

  it('does not flip labels that already read left-to-right', () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]
    const glyphOffsets = [-20, -10, 0, 10, 20]
    const result = placeGlyphsAlongLine(line, 1, glyphOffsets)
    expect(result).toHaveLength(5)
    expect(result[0].x).toBeLessThan(result[4].x)
    // No rotation added
    for (const g of result) expect(g.angle).toBeCloseTo(0)
  })
})

describe('updateLineLabels', () => {
  // Identity projections: tile = pixel = NDC (scale 1:1)
  const identity = (x: number, y: number) => ({ x, y })

  it('fills dynamic buffer with projected positions and angles', () => {
    // Anchor at (100,0), segment 0 of line [0,0]->[200,0]
    // updateLineLabels will inject anchor between vertices 0 and 1
    const labels: LineLabelInfo[] = [{
      anchorX: 100, anchorY: 0,
      segment: 0,
      glyphOffsets: [0],
      lineVertices: [0, 0, 200, 0],
    }]
    const buf = new Float32Array(12)
    updateLineLabels(labels, identity, identity, 1, buf)
    for (let v = 0; v < 4; v++) {
      expect(buf[v * 3 + 0]).toBeCloseTo(100)
      expect(buf[v * 3 + 1]).toBeCloseTo(0)
      expect(buf[v * 3 + 2]).toBeCloseTo(0)
    }
  })

  it('hides label (zeros) when glyph falls off line', () => {
    // Anchor at (5,0), segment 0 of line [0,0]->[10,0] — too short for ±100 offset
    const labels: LineLabelInfo[] = [{
      anchorX: 5, anchorY: 0,
      segment: 0,
      glyphOffsets: [-100, 0, 100],
      lineVertices: [0, 0, 10, 0],
    }]
    const buf = new Float32Array(36)
    buf.fill(999)
    updateLineLabels(labels, identity, identity, 1, buf)
    for (let i = 0; i < 36; i++) {
      expect(buf[i]).toBe(0)
    }
  })
})
