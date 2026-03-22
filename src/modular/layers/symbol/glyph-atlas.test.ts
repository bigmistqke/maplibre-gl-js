// src/modular/layers/symbol/glyph-atlas.test.ts
import { describe, it, expect } from 'vitest'
import { GlyphAtlas } from '@modular/layers/symbol/glyph-atlas.ts'
import type { GlyphMap } from '@modular/layers/symbol/types.ts'

function makeGlyph(id: number, w: number, h: number): import('./types.ts').StyleGlyph {
  // Fill with a solid value (e.g. 200) for easy testing
  const data = new Uint8Array(w * h).fill(200)
  return { id, bitmap: { width: w, height: h, data }, metrics: { width: w, height: h, left: 0, top: 0, advance: w } }
}

describe('GlyphAtlas', () => {
  it('produces non-empty image for non-empty glyph map', () => {
    const map: GlyphMap = { 'Open Sans Regular': { 65: makeGlyph(65, 10, 12) } }
    const atlas = new GlyphAtlas(map)
    expect(atlas.image.width).toBeGreaterThan(0)
    expect(atlas.image.height).toBeGreaterThan(0)
    expect(atlas.image.data.length).toBe(atlas.image.width * atlas.image.height)
  })

  it('sets position rect for each glyph', () => {
    const map: GlyphMap = { 'Open Sans Regular': { 65: makeGlyph(65, 10, 12) } }
    const atlas = new GlyphAtlas(map)
    const pos = atlas.positions['Open Sans Regular'][65]
    expect(pos).toBeDefined()
    expect(pos.rect.w).toBe(10 + 2)  // glyph width + 2 * PADDING
    expect(pos.rect.h).toBe(12 + 2)
  })

  it('copies glyph bitmap data into atlas image', () => {
    const map: GlyphMap = { 'Open Sans Regular': { 65: makeGlyph(65, 4, 4) } }
    const atlas = new GlyphAtlas(map)
    const pos = atlas.positions['Open Sans Regular'][65]
    // The top-left pixel of the glyph (at PADDING offset) should equal 200
    const px = (pos.rect.y + 1) * atlas.image.width + (pos.rect.x + 1)
    expect(atlas.image.data[px]).toBe(200)
  })

  it('handles empty GlyphMap gracefully (1×1 image)', () => {
    const atlas = new GlyphAtlas({})
    expect(atlas.image.width).toBe(1)
    expect(atlas.image.height).toBe(1)
  })

  it('handles glyphs with zero-size bitmap (skipped)', () => {
    const map: GlyphMap = { 'Open Sans Regular': { 32: { id: 32, bitmap: { width: 0, height: 0, data: new Uint8Array(0) }, metrics: { width: 0, height: 0, left: 0, top: 0, advance: 6 } } } }
    const atlas = new GlyphAtlas(map)
    expect(atlas.positions['Open Sans Regular'][32]).toBeUndefined()
  })

  it('packs multiple glyphs without overlap', () => {
    const map: GlyphMap = {
      'Open Sans Regular': {
        65: makeGlyph(65, 8, 8),
        66: makeGlyph(66, 8, 8),
        67: makeGlyph(67, 8, 8),
      }
    }
    const atlas = new GlyphAtlas(map)
    // Each position rect should be distinct (potpack guarantees non-overlap)
    const rects = Object.values(atlas.positions['Open Sans Regular']).map(p => p.rect)
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j]
        const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
        expect(overlap).toBe(false)
      }
    }
  })
})
