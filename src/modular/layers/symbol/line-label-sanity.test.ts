/**
 * Sanity check: runs the snapshot labels through a pure-geometry availability
 * check AND through MapLibre's original placeGlyphAlongLine to verify whether
 * the labels SHOULD survive projection.
 *
 * If MapLibre's original code also rejects most labels, the issue is in layout
 * (producing anchors on lines too short for the label). If MapLibre accepts
 * them but our code rejects them, the issue is in our projection walk.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { MercatorProjection } from '../../renderer/mercator.ts'
import { placeGlyphsAlongLine } from './line-projection.ts'
import type { LineLabelInfo } from './types.ts'

// MapLibre original — our code is adapted from this
import { placeGlyphAlongLine as maplibrePlaceGlyph } from '../../../symbol/projection.ts'

const snapshotPath = resolve('test/unit/assets/line-label-snapshot.json')
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'))
const snapshotLabels: LineLabelInfo[] = snapshot.labels

const FONT_SIZE = 12
const fontScale = FONT_SIZE / 24

// Set up projection (same as comparison test)
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
  return {
    x: (clipX / clipW + 1) / 2 * vp.width,
    y: (1 - clipY / clipW) / 2 * vp.height,
  }
}

describe('Geometry availability check (no walk algorithm)', () => {
  it('reports how many labels have enough projected line for their offsets', () => {
    let fits = 0
    let bwdFail = 0
    let fwdFail = 0

    for (const label of snapshotLabels) {
      const numVerts = label.lineVertices.length / 2
      const projLine: Array<{ x: number; y: number }> = []
      for (let i = 0; i < numVerts; i++) {
        projLine.push(tileToPixel(label.lineVertices[i * 2], label.lineVertices[i * 2 + 1]))
      }
      const anchorPx = tileToPixel(label.anchorX, label.anchorY)

      // Backward distance: anchor → vertex[segment] → vertex[0]
      let bwd = Math.sqrt((anchorPx.x - projLine[label.segment].x) ** 2 + (anchorPx.y - projLine[label.segment].y) ** 2)
      for (let i = label.segment - 1; i >= 0; i--) {
        bwd += Math.sqrt((projLine[i + 1].x - projLine[i].x) ** 2 + (projLine[i + 1].y - projLine[i].y) ** 2)
      }

      // Forward distance: anchor → vertex[segment+1] → vertex[last]
      let fwd = Math.sqrt((anchorPx.x - projLine[label.segment + 1].x) ** 2 + (anchorPx.y - projLine[label.segment + 1].y) ** 2)
      for (let i = label.segment + 2; i < projLine.length; i++) {
        fwd += Math.sqrt((projLine[i].x - projLine[i - 1].x) ** 2 + (projLine[i].y - projLine[i - 1].y) ** 2)
      }

      const minOff = Math.min(...label.glyphOffsets) * fontScale
      const maxOff = Math.max(...label.glyphOffsets) * fontScale
      const needBwd = Math.abs(minOff)
      const needFwd = maxOff

      if (bwd >= needBwd && fwd >= needFwd) {
        fits++
      } else if (bwd < needBwd) {
        bwdFail++
      } else {
        fwdFail++
      }
    }

    console.log(`Geometry check: ${fits}/${snapshotLabels.length} labels have enough line (${(fits / snapshotLabels.length * 100).toFixed(1)}%)`)
    console.log(`  backward too short: ${bwdFail}`)
    console.log(`  forward too short: ${fwdFail}`)

    // This tells us whether the problem is geometry or walk algorithm
    expect(fits).toBeGreaterThan(0)
  })
})

describe('Modular walk vs geometry check', () => {
  it('modular placeGlyphsAlongLine matches geometry availability', () => {
    let geomFits = 0
    let walkFits = 0
    let geomYesWalkNo = 0

    for (const label of snapshotLabels) {
      const numVerts = label.lineVertices.length / 2
      const projLine: Array<{ x: number; y: number }> = []
      for (let i = 0; i < numVerts; i++) {
        projLine.push(tileToPixel(label.lineVertices[i * 2], label.lineVertices[i * 2 + 1]))
      }
      const anchorPx = tileToPixel(label.anchorX, label.anchorY)

      // Geometry check
      let bwd = Math.sqrt((anchorPx.x - projLine[label.segment].x) ** 2 + (anchorPx.y - projLine[label.segment].y) ** 2)
      for (let i = label.segment - 1; i >= 0; i--) {
        bwd += Math.sqrt((projLine[i + 1].x - projLine[i].x) ** 2 + (projLine[i].y - projLine[i].y) ** 2)
      }
      let fwd = Math.sqrt((anchorPx.x - projLine[label.segment + 1].x) ** 2 + (anchorPx.y - projLine[label.segment + 1].y) ** 2)
      for (let i = label.segment + 2; i < projLine.length; i++) {
        fwd += Math.sqrt((projLine[i].x - projLine[i - 1].x) ** 2 + (projLine[i].y - projLine[i - 1].y) ** 2)
      }
      const minOff = Math.min(...label.glyphOffsets) * fontScale
      const maxOff = Math.max(...label.glyphOffsets) * fontScale
      const geomOk = bwd >= Math.abs(minOff) && fwd >= maxOff
      if (geomOk) geomFits++

      // Walk check — insert anchor into projected line (same as updateLineLabels)
      const lineWithAnchor = [
        ...projLine.slice(0, label.segment + 1),
        anchorPx,
        ...projLine.slice(label.segment + 1),
      ]
      const anchorVertexIndex = label.segment + 1
      const pixelOffsets = label.glyphOffsets.map(o => o * fontScale)
      const placed = placeGlyphsAlongLine(lineWithAnchor, anchorVertexIndex, pixelOffsets)
      if (placed.length > 0) walkFits++

      if (geomOk && placed.length === 0) {
        geomYesWalkNo++
        if (geomYesWalkNo <= 3) {
          console.log(`Mismatch: geom says fits (bwd=${bwd.toFixed(1)} fwd=${fwd.toFixed(1)}) but walk failed. seg=${label.segment}/${numVerts}v offsets=[${minOff.toFixed(1)}..${maxOff.toFixed(1)}]`)
        }
      }
    }

    console.log(`Geometry fits: ${geomFits}/${snapshotLabels.length}`)
    console.log(`Walk fits: ${walkFits}/${snapshotLabels.length}`)
    console.log(`Geometry yes but walk no: ${geomYesWalkNo}`)

    // Walk should match geometry — if not, the walk algorithm has a bug
    expect(geomYesWalkNo).toBe(0)
  })
})
