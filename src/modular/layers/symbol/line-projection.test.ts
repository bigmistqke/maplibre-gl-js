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
})

describe('updateLineLabels', () => {
  it('fills dynamic buffer with projected positions and angles', () => {
    const labels: LineLabelInfo[] = [{
      anchorX: 100, anchorY: 0,
      segment: 0,
      glyphOffsets: [0],
      lineVertices: [0, 0, 100, 0, 200, 0],
    }]
    const tileToScreen = (x: number, y: number) => ({ x, y })
    const buf = new Float32Array(12)
    updateLineLabels(labels, tileToScreen, buf)
    for (let v = 0; v < 4; v++) {
      expect(buf[v * 3 + 0]).toBeCloseTo(100)
      expect(buf[v * 3 + 1]).toBeCloseTo(0)
      expect(buf[v * 3 + 2]).toBeCloseTo(0)
    }
  })

  it('hides label (zeros) when glyph falls off line', () => {
    const labels: LineLabelInfo[] = [{
      anchorX: 5, anchorY: 0,
      segment: 0,
      glyphOffsets: [-100, 0, 100],
      lineVertices: [0, 0, 10, 0],
    }]
    const tileToScreen = (x: number, y: number) => ({ x, y })
    const buf = new Float32Array(36)
    buf.fill(999)
    updateLineLabels(labels, tileToScreen, buf)
    for (let i = 0; i < 36; i++) {
      expect(buf[i]).toBe(0)
    }
  })
})
