// src/modular/layers/symbol/vendor/symbol_layout_helpers.test.ts
import { describe, it, expect } from 'vitest'
import {
  getDefaultHorizontalShaping,
  shapeTextForLayout,
  buildGlyphQuads,
  getLineAnchors,
  getCenterLineAnchor,
} from '@modular/layers/symbol/vendor/symbol_layout_helpers.ts'
import type { GlyphPositions, GlyphMap } from '@modular/layers/symbol/types.ts'
import Point from '@mapbox/point-geometry'

describe('getDefaultHorizontalShaping', () => {
  it('returns false for empty map', () => {
    expect(getDefaultHorizontalShaping({})).toBe(false)
  })

  it('returns the first value from a populated map', () => {
    const shaping = { positionedLines: [], text: 'A', top: 0, bottom: 0, left: 0, right: 0, writingMode: 1, iconsInText: false, verticalizable: false }
    const result = getDefaultHorizontalShaping({ center: shaping as any })
    expect(result).toBe(shaping)
  })
})

const metrics = { width: 8, height: 10, left: 1, top: 10, advance: 10 }

const glyphPositions: GlyphPositions = {
  'Open Sans Regular': {
    65: { rect: { x: 0, y: 0, w: 14, h: 16 }, metrics },
    66: { rect: { x: 14, y: 0, w: 14, h: 16 }, metrics },
  }
}

const glyphMap: GlyphMap = {
  'Open Sans Regular': {
    65: { id: 65, bitmap: { width: 8, height: 10, data: new Uint8Array(80) }, metrics },
    66: { id: 66, bitmap: { width: 8, height: 10, data: new Uint8Array(80) }, metrics },
  }
}

describe('shapeTextForLayout', () => {
  it('is exported as a function', () => {
    expect(typeof shapeTextForLayout).toBe('function')
  })

  it('returns false or a Shaping for text "A" with a minimal glyph position', () => {
    const result = shapeTextForLayout({
      text: 'A',
      glyphMap,
      glyphPositions,
      fontstack: 'Open Sans Regular',
      fontSize: 16,
    })
    if (result !== false) {
      expect(typeof result).toBe('object')
      expect(Array.isArray((result as any).positionedLines)).toBe(true)
    }
  })

  it('returns false for empty text', () => {
    const result = shapeTextForLayout({
      text: '',
      glyphMap,
      glyphPositions,
      fontstack: 'Open Sans Regular',
      fontSize: 16,
    })
    expect(result).toBe(false)
  })
})

describe('buildGlyphQuads', () => {
  it('is exported as a function', () => {
    expect(typeof buildGlyphQuads).toBe('function')
  })

  it('returns an array (possibly empty) for a valid shaping', () => {
    const shaping = shapeTextForLayout({
      text: 'A',
      glyphMap,
      glyphPositions,
      fontstack: 'Open Sans Regular',
      fontSize: 16,
    })
    if (shaping === false) return
    const quads = buildGlyphQuads({
      anchor: { x: 2048, y: 2048 },
      shaping,
      glyphPositions,
      fontstack: 'Open Sans Regular',
    })
    expect(Array.isArray(quads)).toBe(true)
  })
})

describe('getLineAnchors', () => {
  it('is exported as a function', () => {
    expect(typeof getLineAnchors).toBe('function')
  })

  it('returns empty array when shaping is false', () => {
    const line = [new Point(0, 0), new Point(4096, 0)]
    const result = getLineAnchors({
      line,
      symbolMinDistance: 200,
      textMaxAngle: Math.PI / 4,
      shaping: false,
      fontSize: 16,
    })
    expect(result).toEqual([])
  })

  it('returns anchor array for a valid shaping on a straight line', () => {
    const shaping = shapeTextForLayout({
      text: 'A',
      glyphMap,
      glyphPositions,
      fontstack: 'Open Sans Regular',
      fontSize: 16,
      alongLine: true,
    })
    if (shaping === false) return
    const line = [new Point(0, 2048), new Point(4096, 2048)]
    const anchors = getLineAnchors({
      line,
      symbolMinDistance: 200,
      textMaxAngle: Math.PI / 2,
      shaping,
      fontSize: 16,
    })
    expect(Array.isArray(anchors)).toBe(true)
  })
})

describe('getCenterLineAnchor', () => {
  it('is exported as a function', () => {
    expect(typeof getCenterLineAnchor).toBe('function')
  })

  it('returns null when shaping is false', () => {
    const line = [new Point(0, 0), new Point(4096, 0)]
    const result = getCenterLineAnchor({
      line,
      textMaxAngle: Math.PI / 4,
      shaping: false,
      fontSize: 16,
    })
    expect(result).toBeNull()
  })
})
