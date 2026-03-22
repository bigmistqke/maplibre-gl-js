// src/modular/layers/symbol/simple-shaper.test.ts
import { describe, it, expect } from 'vitest'
import { getNeededGlyphs, shapeAndBuildQuads } from '@modular/layers/symbol/simple-shaper.ts'
import type { GlyphMap, GlyphPositions } from '@modular/layers/symbol/types.ts'

describe('getNeededGlyphs', () => {
  it('returns codepoints for ASCII text', () => {
    const result = getNeededGlyphs('Hi', 'Open Sans Regular')
    expect(result['Open Sans Regular']).toContain(72)  // 'H'
    expect(result['Open Sans Regular']).toContain(105) // 'i'
  })

  it('deduplicates repeated characters', () => {
    const result = getNeededGlyphs('aa', 'Open Sans Regular')
    expect(result['Open Sans Regular'].filter(c => c === 97).length).toBe(1)
  })
})

describe('shapeAndBuildQuads', () => {
  // Build a minimal GlyphMap and GlyphPositions for a single character 'A' (65)
  const metrics = { width: 8, height: 10, left: 1, top: 10, advance: 10 }
  const bitmap = { width: 14, height: 16, data: new Uint8Array(14 * 16).fill(128) }  // includes BORDER
  const glyphMap: GlyphMap = {
    'Open Sans Regular': { 65: { id: 65, bitmap, metrics } }
  }
  const glyphPositions: GlyphPositions = {
    'Open Sans Regular': {
      65: { rect: { x: 0, y: 0, w: 14, h: 16 }, metrics }
    }
  }

  it('returns null for empty text', () => {
    const result = shapeAndBuildQuads({
      text: '',
      anchor: { x: 2048, y: 2048 },
      glyphMap,
      glyphPositions,
      fontstack: 'Open Sans Regular',
      fontSize: 16,
    })
    // Empty text → no glyphs → null (or 0 quads, depending on shapeText)
    // MapLibre's shapeText returns false for empty text
    expect(result === null).toBe(true)
  })

  it('handles missing fontstack gracefully', () => {
    const result = shapeAndBuildQuads({
      text: 'A',
      anchor: { x: 2048, y: 2048 },
      glyphMap,
      glyphPositions: {},  // no positions for the fontstack
      fontstack: 'Open Sans Regular',
      fontSize: 16,
    })
    // Without glyph positions, shapeText or getGlyphQuads will fail
    // Result should be null to indicate failure
    expect(result === null).toBe(true)
  })

  it('returns null when glyph map is empty', () => {
    const result = shapeAndBuildQuads({
      text: 'A',
      anchor: { x: 2048, y: 2048 },
      glyphMap: {},
      glyphPositions: {},
      fontstack: 'Open Sans Regular',
      fontSize: 16,
    })
    // No glyphs available
    expect(result === null).toBe(true)
  })
})
