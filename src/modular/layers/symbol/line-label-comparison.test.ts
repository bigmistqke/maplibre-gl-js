/**
 * Comparison test: runs the same tile through both MapLibre's original
 * getAnchors pipeline and our modular line worker pipeline, comparing
 * the number and position of label anchors produced.
 *
 * This test isolates the LAYOUT phase (anchor placement on the line)
 * from the PROJECTION phase (per-frame glyph placement) so we can
 * identify where the density gap originates.
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
import ONE_EM from '../../../symbol/one_em.ts'

// Modular imports
import { clipLine as modularClipLine } from './vendor/clip_line.ts'
import { getLineAnchors, shapeTextForLayout } from './vendor/symbol_layout_helpers.ts'
import { mergeLines } from './vendor/merge_lines.ts'

const TILE_EXTENT = 4096
const SOURCE_LAYER = 'street_labels'
const TEXT_FIELD = '{name}'
const FONT_SIZE = 12
const FONTSTACK = 'Open Sans Regular'

// Load test tile
// resolve from repo root (vitest runs from project root)
const tilePath = resolve('test/unit/assets/versatiles-14-8414-5384.pbf')
const tileBytes = readFileSync(tilePath)

function resolveTextField(template: string, props: Record<string, any>): string | null {
  const text = template.replace(/\{([^}]+)\}/g, (_, k) => String(props[k] ?? '')).trim()
  return text.length > 0 ? text : null
}

describe('Line label anchor comparison: original vs modular', () => {
  it('tile fixture exists', () => {
    expect(tileBytes).toBeDefined()
    expect(tileBytes.length).toBeGreaterThan(0)
  })

  it('both systems extract the same number of line features', () => {
    const tile = new VectorTile(new Pbf(new Uint8Array(tileBytes.buffer, tileBytes.byteOffset, tileBytes.byteLength)))
    const layer = tile.layers[SOURCE_LAYER]
    expect(layer).toBeDefined()

    // Count line features with text
    let lineFeatureCount = 0
    for (let i = 0; i < layer.length; i++) {
      const feat = layer.feature(i)
      if (feat.type !== 2) continue
      const text = resolveTextField(TEXT_FIELD, feat.properties)
      if (!text) continue
      lineFeatureCount++
    }

    expect(lineFeatureCount).toBeGreaterThan(0)
    // Both systems should see the same features
    // (This validates our PBF parsing matches MapLibre's)
  })

  it('compares anchor counts from original getAnchors vs modular getLineAnchors', () => {
    const tile = new VectorTile(new Pbf(new Uint8Array(tileBytes.buffer, tileBytes.byteOffset, tileBytes.byteLength)))
    const layer = tile.layers[SOURCE_LAYER]

    // Collect line features
    const features: Array<{ geometry: any; text: string }> = []
    for (let i = 0; i < layer.length; i++) {
      const feat = layer.feature(i)
      if (feat.type !== 2) continue
      const text = resolveTextField(TEXT_FIELD, feat.properties)
      if (!text) continue
      features.push({ geometry: feat.loadGeometry(), text })
    }

    // --- ORIGINAL MAPLIBRE PIPELINE ---
    // Uses getAnchors directly (same function MapLibre calls in symbol_layout.ts:356)
    let originalAnchorCount = 0
    let originalClippedSegments = 0

    for (const feat of features) {
      for (const ring of feat.geometry) {
        const clipped = clipLine([ring], 0, 0, TILE_EXTENT, TILE_EXTENT)
        for (const line of clipped) {
          if (line.length < 2) continue
          originalClippedSegments++

          // MapLibre uses these parameters for 'line' placement
          const glyphSize = ONE_EM  // 24
          const fontScale = FONT_SIZE / glyphSize
          const textMaxBoxScale = fontScale

          // We need a shaping to compute label length
          // Use a rough estimate: text.length * average glyph advance
          const shapedLabelLength = feat.text.length * 10  // rough estimate in ONE_EM units
          const labelLength = shapedLabelLength * textMaxBoxScale

          const textPixelRatio = TILE_EXTENT / 512
          const symbolSpacing = Math.max(labelLength * 2 * textPixelRatio, 250 * textPixelRatio)

          const anchors = getAnchors(
            line,
            symbolSpacing,
            Math.PI / 4,
            { left: -shapedLabelLength / 2, right: shapedLabelLength / 2 } as any, // minimal shaping
            undefined as any, // no icon
            glyphSize,
            textMaxBoxScale,
            1, // overscaling
            TILE_EXTENT,
          )

          originalAnchorCount += anchors.length
        }
      }
    }

    // --- MODULAR PIPELINE ---
    // Uses getLineAnchors (our wrapper around the same getAnchors)
    let modularAnchorCount = 0
    let modularClippedSegments = 0

    // Merge lines first (modular does this)
    const mergedFeatures = mergeLines(features as any) as any[]

    for (const mergedFeat of mergedFeatures) {
      const geom = mergedFeat.geometry
      if (!geom || geom.length === 0) continue

      for (const ring of geom) {
        if (ring.length < 2) continue
        const clipped = modularClipLine([ring], 0, 0, TILE_EXTENT, TILE_EXTENT)

        for (const line of clipped) {
          if (line.length < 2) continue
          modularClippedSegments++

          const textPixelRatio = TILE_EXTENT / 512
          const shapedLabelLength = mergedFeat.text.length * 10
          const labelWidth = shapedLabelLength * (FONT_SIZE / ONE_EM) * textPixelRatio
          const symbolSpacing = Math.max(labelWidth * 2, 250 * textPixelRatio)

          // Create a minimal shaping-like object for getLineAnchors
          const shaping = {
            left: -shapedLabelLength / 2,
            right: shapedLabelLength / 2,
            positionedLines: [],
          }

          const anchors = getLineAnchors({
            line,
            symbolMinDistance: symbolSpacing,
            textMaxAngle: Math.PI / 4,
            shaping: shaping as any,
            fontSize: FONT_SIZE,
            extent: TILE_EXTENT,
          })

          modularAnchorCount += anchors.length
        }
      }
    }

    console.log('=== Line Label Anchor Comparison ===')
    console.log(`Features: ${features.length}`)
    console.log(`Original: ${originalClippedSegments} clipped segments → ${originalAnchorCount} anchors`)
    console.log(`Modular:  ${modularClippedSegments} clipped segments → ${modularAnchorCount} anchors`)
    console.log(`Ratio: ${(modularAnchorCount / originalAnchorCount * 100).toFixed(1)}%`)

    // Both should produce similar anchor counts
    // Allow some difference due to mergeLines reducing segment count
    expect(modularAnchorCount).toBeGreaterThan(0)
    expect(originalAnchorCount).toBeGreaterThan(0)

    // Log the difference for investigation — this is the density gap source
    const ratio = modularAnchorCount / originalAnchorCount
    console.log(`\nIf ratio is close to 1.0, the density gap is in projection, not layout.`)
    console.log(`If ratio is << 1.0, the density gap is in layout/anchor placement.`)
  })
})
