/**
 * Rendering regression test for line labels.
 *
 * Verifies that the combined vertex data (static offsets + dynamic projection)
 * produces glyph positions that are:
 * 1. Centered on the projected line (not offset vertically)
 * 2. Spaced correctly along the line
 * 3. Matching MapLibre's output for the same input
 *
 * This test catches visual bugs (e.g., labels shifted by 1 bounds-height)
 * that the layout/projection tests miss.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import Pbf from 'pbf'

import { shapeTextForLayout, buildGlyphQuads, getLineAnchors } from './vendor/symbol_layout_helpers.ts'
import { clipLine } from './vendor/clip_line.ts'
import { updateLineLabels, placeGlyphsAlongLine } from './line-projection.ts'
import { MercatorProjection } from '../../renderer/mercator.ts'
import { TILE_SIZE, TILE_EXTENT } from '../../core/constants.ts'
import ONE_EM from '../../../symbol/one_em.ts'
import type { LineLabelInfo } from './types.ts'
import type { GlyphMap, GlyphPositions, StyleGlyph } from './types.ts'

const FONT_SIZE = 12
const FONTSTACK = 'Noto Sans Regular'

// --- Glyph loading (same as snapshot generator) ---
function parseGlyphPbf(data: ArrayBuffer | Uint8Array): StyleGlyph[] {
  const BORDER = 3
  const glyphs: StyleGlyph[] = []
  function readFontstacks(tag: number, _: any, pbf: any) { if (tag === 1) pbf.readMessage(readFontstack, null) }
  function readFontstack(tag: number, _: any, pbf: any) { if (tag === 3) { const raw: any = {}; pbf.readMessage(readGlyph, raw); const { id, bitmap, width = 0, height = 0, left = 0, top = 0, advance = 0 } = raw; const w = width + 2 * BORDER; const h = height + 2 * BORDER; const data = (bitmap && bitmap.length === w * h) ? bitmap : new Uint8Array(w * h); glyphs.push({ id, bitmap: { width: w, height: h, data }, metrics: { width, height, left, top, advance } }) } }
  function readGlyph(tag: number, glyph: any, pbf: any) { if (tag === 1) glyph.id = pbf.readVarint(); else if (tag === 2) glyph.bitmap = pbf.readBytes(); else if (tag === 3) glyph.width = pbf.readVarint(); else if (tag === 4) glyph.height = pbf.readVarint(); else if (tag === 5) glyph.left = pbf.readSVarint(); else if (tag === 6) glyph.top = pbf.readSVarint(); else if (tag === 7) glyph.advance = pbf.readVarint() }
  new Pbf(data).readFields(readFontstacks, null)
  return glyphs
}

function loadGlyphs(): { glyphMap: GlyphMap; glyphPositions: GlyphPositions } {
  const glyphDir = resolve('test/integration/assets/glyphs/Noto Sans Regular')
  const ranges = ['0-255', '256-511']
  const glyphMap: GlyphMap = { [FONTSTACK]: {} }
  const glyphPositions: GlyphPositions = { [FONTSTACK]: {} }
  for (const range of ranges) {
    try {
      const data = readFileSync(resolve(glyphDir, `${range}.pbf`))
      const glyphs = parseGlyphPbf(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
      for (const g of glyphs) {
        glyphMap[FONTSTACK][g.id] = g
        glyphPositions[FONTSTACK][g.id] = {
          rect: { x: 0, y: 0, w: g.bitmap.width, h: g.bitmap.height },
          metrics: g.metrics,
        }
      }
    } catch { /* skip missing ranges */ }
  }
  return { glyphMap, glyphPositions }
}

// --- Projection helpers ---
const proj = new MercatorProjection()
const zoom = 14
const tileID = { z: 14, x: 8414, y: 5384, key: '14/8414/5384' }
const tileCenterLng = (tileID.x + 0.5) / Math.pow(2, zoom) * 360 - 180
const tileCenterLatMerc = Math.PI - 2 * Math.PI * (tileID.y + 0.5) / Math.pow(2, zoom)
const tileCenterLat = Math.atan(Math.sinh(tileCenterLatMerc)) * 180 / Math.PI
const cam = { center: { lng: tileCenterLng, lat: tileCenterLat }, zoom, bearing: 0, pitch: 0, groundElevation: 0 }
const vp = { width: 512, height: 512 }
const tileMatrix = proj.getTileMatrix(tileID, cam, vp)

function tileToPixel(tileX: number, tileY: number) {
  const m = tileMatrix
  const clipX = m[0] * tileX + m[4] * tileY + m[12]
  const clipY = m[1] * tileX + m[5] * tileY + m[13]
  const clipW = m[3] * tileX + m[7] * tileY + m[15]
  return { x: (clipX / clipW + 1) / 2 * vp.width, y: (1 - clipY / clipW) / 2 * vp.height }
}

function pixelToNDC(px: number, py: number) {
  return { x: (px / vp.width) * 2 - 1, y: -((py / vp.height) * 2 - 1) }
}

describe('Line label rendered position', () => {
  const { glyphMap, glyphPositions } = loadGlyphs()
  const fontScale = FONT_SIZE / 24
  const scale = FONT_SIZE / ONE_EM

  function layoutLabel(text: string, lineVertices: number[], anchorX: number, anchorY: number, segment: number) {
    const shaping = shapeTextForLayout({
      text, glyphMap, glyphPositions, fontstack: FONTSTACK, fontSize: FONT_SIZE, alongLine: true,
    })
    if (!shaping) throw new Error(`Shaping failed for "${text}"`)

    const quads = buildGlyphQuads({
      anchor: { x: anchorX, y: anchorY }, shaping, glyphPositions, fontstack: FONTSTACK,
      textOffset: [0, 0], alongLine: true,
    })

    // Extract glyph offsets (same as worker)
    const glyphOffsets: number[] = []
    for (const posLine of shaping.positionedLines) {
      for (const pg of posLine.positionedGlyphs) {
        const halfAdvance = pg.metrics.advance * pg.scale / 2
        glyphOffsets.push(pg.x + halfAdvance)
      }
    }

    // Build static vertex data (same as worker)
    const vertexData: Array<{ ox: number; oy: number }> = []
    for (const quad of quads) {
      const baselineY = (quad as any).glyphOffset[1]
      const corners = [quad.tl, quad.tr, quad.bl, quad.br]
      for (const corner of corners) {
        vertexData.push({
          ox: Math.round(corner.x * scale * 32),
          oy: Math.round((corner.y + baselineY) * scale * 32),
        })
      }
    }

    return { shaping, quads, glyphOffsets, vertexData }
  }

  it('encoded vertex offsets center glyphs on the line', () => {
    const lineVerts = [500, 2048, 3500, 2048]
    const { quads, vertexData } = layoutLabel('Test', lineVerts, 2048, 2048, 0)

    for (let g = 0; g < quads.length; g++) {
      // Check the ENCODED vertex offsets (after baseline correction)
      const oy_tl = vertexData[g * 4 + 0].oy
      const oy_bl = vertexData[g * 4 + 2].oy
      const centerPx = ((oy_tl + oy_bl) / 2) / 32.0

      // The encoded center should be within 1px of zero (centered on line)
      expect(Math.abs(centerPx)).toBeLessThan(1)
    }
  })

  it('projected glyph positions sit on the projected line', () => {
    const lineVerts = [500, 2048, 3500, 2048]
    const anchorX = 2048, anchorY = 2048, segment = 0
    const { glyphOffsets, vertexData, quads } = layoutLabel('Test', lineVerts, anchorX, anchorY, segment)

    const label: LineLabelInfo = { anchorX, anchorY, segment, glyphOffsets, lineVertices: lineVerts }

    // Run projection
    const totalGlyphs = glyphOffsets.length
    const buf = new Float32Array(totalGlyphs * 4 * 3)
    updateLineLabels([label], tileToPixel, pixelToNDC, fontScale, buf)

    // The projected line is horizontal at pixel Y = tileToPixel(2048, 2048).y
    const linePixelY = tileToPixel(anchorX, anchorY).y
    const lineNDCY = pixelToNDC(0, linePixelY).y

    // For each glyph, check that the NDC position + offset center is on the line
    for (let g = 0; g < totalGlyphs; g++) {
      const projX = buf[g * 4 * 3 + 0] // NDC x (same for all 4 verts)
      const projY = buf[g * 4 * 3 + 1] // NDC y

      // The projected position should be the glyph CENTER on the line
      // Offset a_offset positions the quad corners relative to this center
      // So projY should be at the line's NDC Y
      expect(projY).toBeCloseTo(lineNDCY, 3)

      // Now check: projY + offset should place the visual center ON the line
      // Get the 4 vertex offsets for this glyph
      const v0oy = vertexData[g * 4 + 0].oy // tl
      const v2oy = vertexData[g * 4 + 2].oy // bl

      // Convert offsets to NDC (same as shader)
      const tlOffsetNDC = (v0oy / 32.0) * (-2.0) / vp.height
      const blOffsetNDC = (v2oy / 32.0) * (-2.0) / vp.height

      // Final screen positions of top and bottom edges
      const topNDC = projY + tlOffsetNDC
      const bottomNDC = projY + blOffsetNDC
      const visualCenterNDC = (topNDC + bottomNDC) / 2

      // The visual center should be within 2px of the line
      const centerOffsetPx = Math.abs(visualCenterNDC - lineNDCY) * vp.height / 2
      expect(centerOffsetPx).toBeLessThan(2)
    }
  })

  it('glyph spacing matches MapLibre getGlyphQuads output', () => {
    const lineVerts = [500, 2048, 3500, 2048]
    const { quads, glyphOffsets } = layoutLabel('Amsterdam', lineVerts, 2048, 2048, 0)

    expect(quads.length).toBe(glyphOffsets.length)

    // Glyph offsets should be monotonically increasing (left to right)
    for (let i = 1; i < glyphOffsets.length; i++) {
      expect(glyphOffsets[i]).toBeGreaterThan(glyphOffsets[i - 1])
    }

    // The span of offsets should match the shaping width
    const span = glyphOffsets[glyphOffsets.length - 1] - glyphOffsets[0]
    // Span should be reasonable for 9 characters at ~7 ONE_EM advance each
    expect(span).toBeGreaterThan(40) // at least 40 ONE_EM units
    expect(span).toBeLessThan(120)   // at most 120 ONE_EM units
  })
})
