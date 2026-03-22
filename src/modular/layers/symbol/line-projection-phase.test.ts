/**
 * Projection-phase regression tests.
 *
 * These tests verify that the tile matrix produces correct pixel distances
 * and that line labels survive the projection phase at expected rates.
 * A failure here means labels will be invisible or sparse on screen.
 */
import { describe, it, expect } from 'vitest'
import { updateLineLabels } from './line-projection.ts'
import { MercatorProjection } from '../../renderer/mercator.ts'
import { TILE_SIZE, TILE_EXTENT } from '../../core/constants.ts'
import type { LineLabelInfo } from './types.ts'

function makeTileProjection(tileMatrix: Float32Array, canvasWidth: number, canvasHeight: number) {
  const tileToPixel = (tileX: number, tileY: number) => {
    const m = tileMatrix
    const clipX = m[0] * tileX + m[4] * tileY + m[12]
    const clipY = m[1] * tileX + m[5] * tileY + m[13]
    const clipW = m[3] * tileX + m[7] * tileY + m[15]
    const ndcX = clipX / clipW
    const ndcY = clipY / clipW
    return {
      x: (ndcX + 1) / 2 * canvasWidth,
      y: (1 - ndcY) / 2 * canvasHeight,
    }
  }
  const pixelToNDC = (px: number, py: number) => ({
    x: (px / canvasWidth) * 2 - 1,
    y: -((py / canvasHeight) * 2 - 1),
  })
  return { tileToPixel, pixelToNDC }
}

// Camera centered on test tile 14/8414/5384
const proj = new MercatorProjection()
const zoom = 14
const tileID = { z: 14, x: 8414, y: 5384, key: '14/8414/5384' }
const tileCenterLng = (tileID.x + 0.5) / Math.pow(2, zoom) * 360 - 180
const tileCenterLatMerc = Math.PI - 2 * Math.PI * (tileID.y + 0.5) / Math.pow(2, zoom)
const tileCenterLat = Math.atan(Math.sinh(tileCenterLatMerc)) * 180 / Math.PI
const camera = { center: { lng: tileCenterLng, lat: tileCenterLat }, zoom, bearing: 0, pitch: 0, groundElevation: 0 }
const viewport = { width: 512, height: 512 }

describe('Tile projection scale', () => {
  it('1 tile unit = TILE_SIZE / TILE_EXTENT pixels at the tile center', () => {
    const tileMatrix = proj.getTileMatrix(tileID, camera, viewport)
    const { tileToPixel } = makeTileProjection(tileMatrix, viewport.width, viewport.height)

    const p0 = tileToPixel(2048, 2048)
    const p1 = tileToPixel(2049, 2048)
    const pixelsPerTileUnit = Math.sqrt((p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2)

    const expected = TILE_SIZE / TILE_EXTENT // 0.125 for TILE_SIZE=512
    expect(pixelsPerTileUnit).toBeCloseTo(expected, 3)
  })

  it('tile center projects to canvas center', () => {
    const tileMatrix = proj.getTileMatrix(tileID, camera, viewport)
    const { tileToPixel } = makeTileProjection(tileMatrix, viewport.width, viewport.height)

    const center = tileToPixel(TILE_EXTENT / 2, TILE_EXTENT / 2)
    expect(center.x).toBeCloseTo(viewport.width / 2, 0)
    expect(center.y).toBeCloseTo(viewport.height / 2, 0)
  })

  it('a 400 tile-unit line is long enough for a 7-char label at fontSize 12', () => {
    const tileMatrix = proj.getTileMatrix(tileID, camera, viewport)
    const { tileToPixel } = makeTileProjection(tileMatrix, viewport.width, viewport.height)

    const lineStart = tileToPixel(1848, 2048)
    const lineEnd = tileToPixel(2248, 2048) // 400 tile units
    const lineLengthPx = Math.sqrt((lineEnd.x - lineStart.x) ** 2 + (lineEnd.y - lineStart.y) ** 2)

    // 7-char label: max glyph offset ~36 ONE_EM units * fontScale(0.5) = 18px
    const maxGlyphOffset = 36 * (12 / 24) // 18px
    expect(lineLengthPx).toBeGreaterThan(maxGlyphOffset * 2)
  })
})

describe('Projection phase label survival', () => {
  const fontScale = 12 / 24
  const glyphOffsets7char = [-36, -24, -12, 0, 12, 24, 36]

  function countSurvivors(labels: LineLabelInfo[], tileMatrix: Float32Array): number {
    const { tileToPixel, pixelToNDC } = makeTileProjection(tileMatrix, viewport.width, viewport.height)
    const floatsPerLabel = glyphOffsets7char.length * 4 * 3
    const buf = new Float32Array(labels.length * floatsPerLabel)
    updateLineLabels(labels, tileToPixel, pixelToNDC, fontScale, buf)

    let count = 0
    for (let i = 0; i < labels.length; i++) {
      const start = i * floatsPerLabel
      if (buf.slice(start, start + floatsPerLabel).some(v => v !== 0)) count++
    }
    return count
  }

  it('a label on a long line (3000 tile units) always survives', () => {
    const tileMatrix = proj.getTileMatrix(tileID, camera, viewport)
    const label: LineLabelInfo = {
      anchorX: 2048, anchorY: 2048, segment: 0,
      glyphOffsets: glyphOffsets7char,
      lineVertices: [500, 2048, 3500, 2048],
    }
    expect(countSurvivors([label], tileMatrix)).toBe(1)
  })

  it('a label on a short line (100 tile units) is correctly hidden', () => {
    const tileMatrix = proj.getTileMatrix(tileID, camera, viewport)
    // 100 tile units = 12.5px, label needs 36px — must be hidden
    const label: LineLabelInfo = {
      anchorX: 2048, anchorY: 2048, segment: 0,
      glyphOffsets: glyphOffsets7char,
      lineVertices: [1998, 2048, 2098, 2048],
    }
    expect(countSurvivors([label], tileMatrix)).toBe(0)
  })

  it('100 labels on ample lines (400-1600 tile units) all survive', () => {
    const tileMatrix = proj.getTileMatrix(tileID, camera, viewport)
    const labels: LineLabelInfo[] = []
    // Use deterministic positions (no Math.random)
    for (let i = 0; i < 100; i++) {
      const cx = 800 + (i % 10) * 240
      const cy = 800 + Math.floor(i / 10) * 240
      const halfLen = 400 + (i % 5) * 200 // 800-1600 tile units total
      labels.push({
        anchorX: cx, anchorY: cy, segment: 0,
        glyphOffsets: glyphOffsets7char,
        lineVertices: [cx - halfLen, cy, cx + halfLen, cy],
      })
    }
    const survivors = countSurvivors(labels, tileMatrix)
    expect(survivors).toBe(100)
  })
})
