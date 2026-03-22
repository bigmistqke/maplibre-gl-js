/**
 * Generates a JSON snapshot of line labels produced by the full layout pipeline
 * (real glyph shaping, real tile data) for use in projection regression tests.
 *
 * Run with: npx vitest run --config vitest.config.modular.ts src/modular/layers/symbol/generate-line-label-snapshot.test.ts
 * Produces: test/unit/assets/line-label-snapshot.json
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'

import { clipLine } from './vendor/clip_line.ts'
import { getLineAnchors, shapeTextForLayout } from './vendor/symbol_layout_helpers.ts'
import { mergeLines } from './vendor/merge_lines.ts'
import ONE_EM from '../../../symbol/one_em.ts'
import type { LineLabelInfo } from './types.ts'
import type { GlyphMap, GlyphPositions, StyleGlyph } from './types.ts'

const TILE_EXTENT = 4096
const SOURCE_LAYER = 'street_labels'
const TEXT_FIELD = '{name}'
const FONT_SIZE = 12
const FONTSTACK = 'Noto Sans Regular'

// Load glyph PBFs — same parser as glyph-loader.ts
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
    const pbfPath = resolve(glyphDir, `${range}.pbf`)
    try {
      const data = readFileSync(pbfPath)
      const glyphs = parseGlyphPbf(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
      for (const g of glyphs) {
        glyphMap[FONTSTACK][g.id] = g
        glyphPositions[FONTSTACK][g.id] = {
          rect: { x: 0, y: 0, w: g.bitmap.width, h: g.bitmap.height },
          metrics: g.metrics,
        }
      }
    } catch {
      // range file not found — skip
    }
  }

  return { glyphMap, glyphPositions }
}

function resolveTextField(template: string, props: Record<string, any>): string | null {
  const text = template.replace(/\{([^}]+)\}/g, (_, k) => String(props[k] ?? '')).trim()
  return text.length > 0 ? text : null
}

describe('Generate line label snapshot from real tile + real glyphs', () => {
  it('produces snapshot with real glyph offsets', () => {
    const tilePath = resolve('test/unit/assets/versatiles-14-8414-5384.pbf')
    const tileBytes = readFileSync(tilePath)
    const tile = new VectorTile(new Pbf(new Uint8Array(tileBytes.buffer, tileBytes.byteOffset, tileBytes.byteLength)))
    const layer = tile.layers[SOURCE_LAYER]
    expect(layer).toBeDefined()

    const { glyphMap, glyphPositions } = loadGlyphs()
    const glyphCount = Object.keys(glyphMap[FONTSTACK]).length
    console.log(`Loaded ${glyphCount} glyphs for ${FONTSTACK}`)
    expect(glyphCount).toBeGreaterThan(50)

    // Collect features
    const features: Array<{ geometry: any; text: string }> = []
    for (let i = 0; i < layer.length; i++) {
      const feat = layer.feature(i)
      if (feat.type !== 2) continue
      const text = resolveTextField(TEXT_FIELD, feat.properties)
      if (!text) continue
      features.push({ geometry: feat.loadGeometry(), text })
    }

    const mergedFeatures = mergeLines(features as any) as any[]
    const lineLabels: LineLabelInfo[] = []
    let shapingFailures = 0

    for (const mergedFeat of mergedFeatures) {
      const geom = mergedFeat.geometry
      if (!geom || geom.length === 0) continue

      const shaping = shapeTextForLayout({
        text: mergedFeat.text,
        glyphMap,
        glyphPositions,
        fontstack: FONTSTACK,
        fontSize: FONT_SIZE,
        alongLine: true,
      })
      if (!shaping) { shapingFailures++; continue }

      for (const ring of geom) {
        if (ring.length < 2) continue
        const clipped = clipLine([ring], 0, 0, TILE_EXTENT, TILE_EXTENT)

        for (const line of clipped) {
          if (line.length < 2) continue

          const textPixelRatio = TILE_EXTENT / 512
          const labelWidth = (shaping.right - shaping.left) * (FONT_SIZE / ONE_EM) * textPixelRatio
          const symbolSpacing = Math.max(labelWidth * 2, 250 * textPixelRatio)

          const anchors = getLineAnchors({
            line,
            symbolMinDistance: symbolSpacing,
            textMaxAngle: Math.PI / 4,
            shaping,
            fontSize: FONT_SIZE,
            extent: TILE_EXTENT,
          })

          for (const anchor of anchors) {
            // Extract glyph offsets exactly as the worker does
            const glyphOffsets: number[] = []
            for (const posLine of shaping.positionedLines) {
              for (const pg of posLine.positionedGlyphs) {
                const halfAdvance = pg.metrics.advance * pg.scale / 2
                glyphOffsets.push(pg.x + halfAdvance)
              }
            }

            lineLabels.push({
              anchorX: anchor.x,
              anchorY: anchor.y,
              segment: anchor.segment,
              glyphOffsets,
              lineVertices: line.flatMap((p: any) => [p.x, p.y]),
            })
          }
        }
      }
    }

    console.log(`Features: ${features.length}, merged: ${mergedFeatures.length}, shaping failures: ${shapingFailures}`)
    console.log(`Line labels produced: ${lineLabels.length}`)
    expect(lineLabels.length).toBeGreaterThan(0)

    // Log offset ranges for sanity check
    const allMaxOffsets = lineLabels.map(l => Math.max(...l.glyphOffsets.map(Math.abs)))
    const avgMaxOffset = allMaxOffsets.reduce((a, b) => a + b, 0) / allMaxOffsets.length
    console.log(`Average max glyph offset: ${avgMaxOffset.toFixed(1)} ONE_EM units (= ${(avgMaxOffset * FONT_SIZE / 24).toFixed(1)}px)`)

    // Save snapshot
    const snapshotPath = resolve('test/unit/assets/line-label-snapshot.json')
    writeFileSync(snapshotPath, JSON.stringify({
      tile: '14/8414/5384',
      sourceLayer: SOURCE_LAYER,
      fontstack: FONTSTACK,
      fontSize: FONT_SIZE,
      labelCount: lineLabels.length,
      labels: lineLabels,
    }, null, 2))
    console.log(`Snapshot written to ${snapshotPath}`)
  })
})
