/**
 * Line label parity test: MapLibre original vs modular.
 *
 * Runs BOTH pipelines on the same tile with real glyph shaping
 * and compares anchor counts and projection survival rates.
 *
 * This test uses the EXACT same parameters MapLibre uses internally
 * (real shaping, tilePixelRatio, textMaxBoxScale) to ensure the
 * comparison is apples-to-apples.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'

// Original MapLibre imports
import { getAnchors } from '../../../symbol/get_anchors.ts'
import { clipLine } from '../../../symbol/clip_line.ts'
import { shapeText, WritingMode } from '../../../symbol/shaping.ts'
import { Formatted, FormattedSection } from '@maplibre/maplibre-gl-style-spec'
import ONE_EM from '../../../symbol/one_em.ts'

// Modular imports
import { clipLine as modularClipLine } from './vendor/clip_line.ts'
import { getLineAnchors, shapeTextForLayout } from './vendor/symbol_layout_helpers.ts'
import { mergeLines } from './vendor/merge_lines.ts'

// Projection imports
import { updateLineLabels } from './line-projection.ts'
import { MercatorProjection } from '../../renderer/mercator.ts'
import { TILE_SIZE, TILE_EXTENT } from '../../core/constants.ts'
import type { LineLabelInfo } from './types.ts'
import type { GlyphMap, GlyphPositions, StyleGlyph } from './types.ts'

const SOURCE_LAYER = 'street_labels'
const TEXT_FIELD = '{name}'
const FONT_SIZE = 12
const FONTSTACK = 'Noto Sans Regular'

// --- Glyph loading ---
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

function resolveTextField(template: string, props: Record<string, any>): string | null {
  const text = template.replace(/\{([^}]+)\}/g, (_, k) => String(props[k] ?? '')).trim()
  return text.length > 0 ? text : null
}

// Shape text using MapLibre's original shapeText (same function both pipelines use)
function shapeOriginal(text: string, glyphMap: GlyphMap, glyphPositions: GlyphPositions) {
  const formatted = new Formatted([new FormattedSection(text, null, null, null, null, null)])
  return shapeText(
    formatted,
    glyphMap as any,
    glyphPositions,
    {},
    FONTSTACK,
    Infinity,       // maxWidth — Infinity for along-line
    24,             // lineHeight
    'center',       // textAnchor
    'center',       // textJustify
    0,              // spacing
    [0, 0],         // textOffset
    WritingMode.horizontal,
    false,          // allowVerticalPlacement
    ONE_EM,         // layoutTextSize
    ONE_EM,         // layoutTextSizeThisZoom
  )
}

// --- Test data ---
const tilePath = resolve('test/unit/assets/versatiles-14-8414-5384.pbf')
const tileBytes = readFileSync(tilePath)

describe('MapLibre original pipeline (sanity check)', () => {
  const { glyphMap, glyphPositions } = loadGlyphs()

  it('original pipeline with real shaping produces anchors', () => {
    const tile = new VectorTile(new Pbf(new Uint8Array(tileBytes.buffer, tileBytes.byteOffset, tileBytes.byteLength)))
    const layer = tile.layers[SOURCE_LAYER]
    const features: Array<{ geometry: any; text: string }> = []
    for (let i = 0; i < layer.length; i++) {
      const feat = layer.feature(i)
      if (feat.type !== 2) continue
      const text = resolveTextField(TEXT_FIELD, feat.properties)
      if (!text) continue
      features.push({ geometry: feat.loadGeometry(), text })
    }

    // MapLibre merges lines in symbol_bucket.ts:545
    const mergedFeatures = mergeLines(features as any) as any[]

    // MapLibre's exact parameters (symbol_layout.ts:300-312)
    const glyphSize = ONE_EM // 24
    const layoutTextSize = FONT_SIZE // 12 for constant text-size
    const textMaxSize = FONT_SIZE // same for constant text-size (zoom 18 eval = same)
    const overscaling = 1
    const tilePixelRatio = TILE_EXTENT / (512 * overscaling) // 8
    const fontScale = layoutTextSize / glyphSize // 0.5
    const textMaxBoxScale = tilePixelRatio * textMaxSize / glyphSize // 8 * 12 / 24 = 4
    const symbolSpacingValue = 250 // default symbol-spacing
    const symbolMinDistance = tilePixelRatio * symbolSpacingValue // 2000
    const textMaxAngle = 45 * Math.PI / 180

    let totalAnchors = 0
    let totalFeatures = 0
    let shapingFailures = 0

    for (const feat of mergedFeatures) {
      const geom = feat.geometry
      if (!geom || geom.length === 0) continue

      const shaping = shapeOriginal(feat.text, glyphMap, glyphPositions)
      if (!shaping) { shapingFailures++; continue }
      totalFeatures++

      for (const ring of geom) {
        if (ring.length < 2) continue
        const clipped = clipLine([ring], 0, 0, TILE_EXTENT, TILE_EXTENT)
        for (const line of clipped) {
          if (line.length < 2) continue
          const anchors = getAnchors(
            line, symbolMinDistance, textMaxAngle,
            shaping, undefined as any, glyphSize, textMaxBoxScale,
            overscaling, TILE_EXTENT,
          )
          totalAnchors += anchors.length
        }
      }
    }

    console.log(`Original pipeline: ${totalFeatures} features → ${totalAnchors} anchors (${shapingFailures} shaping failures)`)
    expect(totalAnchors).toBeGreaterThan(0)
  })
})

describe('Layout parity: original vs modular with real shaping', () => {
  const { glyphMap, glyphPositions } = loadGlyphs()

  it('modular produces identical anchor count to original', () => {
    const tile = new VectorTile(new Pbf(new Uint8Array(tileBytes.buffer, tileBytes.byteOffset, tileBytes.byteLength)))
    const layer = tile.layers[SOURCE_LAYER]
    const features: Array<{ geometry: any; text: string }> = []
    for (let i = 0; i < layer.length; i++) {
      const feat = layer.feature(i)
      if (feat.type !== 2) continue
      const text = resolveTextField(TEXT_FIELD, feat.properties)
      if (!text) continue
      features.push({ geometry: feat.loadGeometry(), text })
    }

    // Both pipelines merge lines (MapLibre does this in symbol_bucket.ts:545)
    const mergedFeatures = mergeLines(features as any) as any[]

    // Shared parameters — MapLibre's exact values
    const glyphSize = ONE_EM
    const textMaxSize = FONT_SIZE
    const overscaling = 1
    const tilePixelRatio = TILE_EXTENT / (512 * overscaling)
    const textMaxBoxScale = tilePixelRatio * textMaxSize / glyphSize
    const symbolMinDistance = tilePixelRatio * 250
    const textMaxAngle = 45 * Math.PI / 180

    let originalAnchors = 0
    let modularAnchors = 0

    for (const feat of mergedFeatures) {
      const geom = feat.geometry
      if (!geom || geom.length === 0) continue

      // Use MapLibre's shapeText for the original branch
      const origShaping = shapeOriginal(feat.text, glyphMap, glyphPositions)
      // Use our shapeTextForLayout for the modular branch
      const modShaping = shapeTextForLayout({
        text: feat.text, glyphMap, glyphPositions, fontstack: FONTSTACK,
        fontSize: FONT_SIZE, alongLine: true,
      })

      if (!origShaping && !modShaping) continue

      for (const ring of geom) {
        if (ring.length < 2) continue

        // Original: uses MapLibre's clipLine + getAnchors
        if (origShaping) {
          const clipped = clipLine([ring], 0, 0, TILE_EXTENT, TILE_EXTENT)
          for (const line of clipped) {
            if (line.length < 2) continue
            const anchors = getAnchors(
              line, symbolMinDistance, textMaxAngle,
              origShaping, undefined as any, glyphSize, textMaxBoxScale,
              overscaling, TILE_EXTENT,
            )
            originalAnchors += anchors.length
          }
        }

        // Modular: uses our clipLine + getLineAnchors
        if (modShaping) {
          const clipped = modularClipLine([ring], 0, 0, TILE_EXTENT, TILE_EXTENT)
          for (const line of clipped) {
            if (line.length < 2) continue
            const anchors = getLineAnchors({
              line, symbolMinDistance: symbolMinDistance,
              textMaxAngle, shaping: modShaping, fontSize: FONT_SIZE,
              extent: TILE_EXTENT,
            })
            modularAnchors += anchors.length
          }
        }
      }
    }

    console.log(`Original: ${originalAnchors} anchors`)
    console.log(`Modular:  ${modularAnchors} anchors`)

    expect(originalAnchors).toBeGreaterThan(0)
    expect(modularAnchors).toBe(originalAnchors)
  })
})

describe('Projection parity with real snapshot data', () => {
  it('at least 80% of snapshot labels survive projection', () => {
    const snapshotPath = resolve('test/unit/assets/line-label-snapshot.json')
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'))
    const snapshotLabels: LineLabelInfo[] = snapshot.labels

    expect(snapshotLabels.length).toBeGreaterThan(30)

    const proj = new MercatorProjection()
    const zoom = 14
    const tileID = { z: 14, x: 8414, y: 5384, key: '14/8414/5384' }
    const tileCenterLng = (tileID.x + 0.5) / Math.pow(2, zoom) * 360 - 180
    const tileCenterLatMerc = Math.PI - 2 * Math.PI * (tileID.y + 0.5) / Math.pow(2, zoom)
    const tileCenterLat = Math.atan(Math.sinh(tileCenterLatMerc)) * 180 / Math.PI
    const cam = { center: { lng: tileCenterLng, lat: tileCenterLat }, zoom, bearing: 0, pitch: 0, groundElevation: 0 }
    const vp = { width: 512, height: 512 }
    const tileMatrix = proj.getTileMatrix(tileID, cam, vp)
    const tileToPixel = (tileX: number, tileY: number) => {
      const m = tileMatrix
      const clipX = m[0] * tileX + m[4] * tileY + m[12]
      const clipY = m[1] * tileX + m[5] * tileY + m[13]
      const clipW = m[3] * tileX + m[7] * tileY + m[15]
      return { x: (clipX / clipW + 1) / 2 * vp.width, y: (1 - clipY / clipW) / 2 * vp.height }
    }
    const pixelToNDC = (px: number, py: number) => ({
      x: (px / vp.width) * 2 - 1, y: -((py / vp.height) * 2 - 1),
    })
    const fontScale = FONT_SIZE / 24

    let totalGlyphs = 0
    for (const l of snapshotLabels) totalGlyphs += l.glyphOffsets.length
    const buf = new Float32Array(totalGlyphs * 4 * 3)
    updateLineLabels(snapshotLabels, tileToPixel, pixelToNDC, fontScale, buf)

    let survivors = 0
    let offset = 0
    for (const label of snapshotLabels) {
      const numFloats = label.glyphOffsets.length * 4 * 3
      if (buf.slice(offset, offset + numFloats).some(v => v !== 0)) survivors++
      offset += numFloats
    }

    const rate = survivors / snapshotLabels.length
    console.log(`Projection: ${survivors}/${snapshotLabels.length} survived (${(rate * 100).toFixed(1)}%)`)
    expect(rate).toBeGreaterThanOrEqual(0.8)
  })
})
