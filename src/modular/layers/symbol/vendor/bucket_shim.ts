// vendor/bucket_shim.ts
// Temporary shim -- will be removed when worker produces StructArrays (Phase 5)
//
// Wraps LineLabelInfo[] into the StructArray-based SymbolBucketAdapter that the
// vendored updateLineLabels expects.

import { SymbolBucketAdapter } from './symbol_bucket_adapter.ts'
import type { LineLabelInfo } from '../types.ts'
import { WritingMode } from '../../../../symbol/shaping.ts'

/**
 * Populate a SymbolBucketAdapter from our simple LineLabelInfo[] format so that
 * the vendored `updateLineLabels` can consume it.
 *
 * Fills:
 * - lineVertexArray      (x, y, tileUnitDistanceFromAnchor) per line vertex
 * - glyphOffsetArray     (offsetX) per glyph across all labels
 * - text.placedSymbolArray  (anchor, segment, glyph range, line range, size, ...)
 * - text.dynamicLayoutVertexArray  (resized to hold 4 vertices * 3 floats per glyph)
 */
export function buildBucketShim(
  lineLabels: LineLabelInfo[],
  fontSize: number,
): SymbolBucketAdapter {
  const bucket = new SymbolBucketAdapter()

  // Set textSizeData to constant with our fontSize
  bucket.textSizeData = { kind: 'constant', layoutSize: fontSize }

  // Global offset counters
  let glyphStart = 0
  let lineStart = 0

  for (const label of lineLabels) {
    const numGlyphs = label.glyphOffsets.length
    const numLineVerts = label.lineVertices.length / 2

    // -- lineVertexArray: one entry per vertex in the line geometry --
    // The vendored code indexes into this array with symbol.lineStartIndex + i
    const lineStartForThisLabel = lineStart
    for (let i = 0; i < numLineVerts; i++) {
      const x = label.lineVertices[i * 2]
      const y = label.lineVertices[i * 2 + 1]
      // tileUnitDistanceFromAnchor is used by some code paths but not critical
      // for the basic line walking -- set to 0
      bucket.lineVertexArray.emplaceBack(x, y, 0)
    }

    // -- glyphOffsetArray: one entry per glyph --
    const glyphStartForThisLabel = glyphStart
    for (let i = 0; i < numGlyphs; i++) {
      bucket.glyphOffsetArray.emplaceBack(label.glyphOffsets[i])
    }

    // -- text.placedSymbolArray: one entry per label --
    // PlacedSymbolLayout fields (in order):
    //   anchorX, anchorY, glyphStartIndex, numGlyphs, vertexStartIndex,
    //   lineStartIndex, lineLength, segment,
    //   lowerSize, upperSize, lineOffsetX, lineOffsetY,
    //   writingMode, placedOrientation, hidden,
    //   crossTileID, associatedIconIndex
    const SIZE_PACK_FACTOR = 128 // MapLibre packs sizes as size * 128
    const packedSize = Math.round(fontSize * SIZE_PACK_FACTOR)
    bucket.text.placedSymbolArray.emplaceBack(
      label.anchorX,                   // anchorX (int16)
      label.anchorY,                   // anchorY (int16)
      glyphStartForThisLabel,          // glyphStartIndex (uint16)
      numGlyphs,                       // numGlyphs (uint16)
      glyphStartForThisLabel * 4,      // vertexStartIndex (uint32) -- 4 verts per glyph
      lineStartForThisLabel,           // lineStartIndex (uint32)
      numLineVerts,                    // lineLength (uint32)
      label.segment,                   // segment (uint16)
      packedSize,                      // lowerSize (uint16)
      packedSize,                      // upperSize (uint16)
      0,                               // lineOffsetX (float32) -- on the line
      0,                               // lineOffsetY (float32) -- on the line
      WritingMode.horizontal,          // writingMode (uint8)
      0,                               // placedOrientation (uint8)
      0,                               // hidden (uint8)
      0,                               // crossTileID (uint32)
      -1,                              // associatedIconIndex (int16)
    )

    glyphStart += numGlyphs
    lineStart += numLineVerts
  }

  // -- text.dynamicLayoutVertexArray: pre-size for output --
  // 4 vertices per glyph, each with (ax, ay, angle) = 3 floats
  const totalGlyphs = glyphStart
  bucket.text.dynamicLayoutVertexArray.resize(totalGlyphs * 4)

  return bucket
}

/**
 * Extract (x, y, angle) per glyph vertex from the dynamicLayoutVertexArray
 * written by vendored updateLineLabels, and write into our flat Float32Array
 * dynamic buffer for GPU upload.
 *
 * The dynamicLayoutVertexArray has 4 entries per glyph (one per quad vertex),
 * each containing (ax: float32, ay: float32, angle: float32).
 *
 * When pitchWithMap=false, the vendored code stores positions in viewport pixel
 * coordinates. Our shader expects NDC (-1..1), so we convert:
 *   ndcX = (px / width) * 2 - 1
 *   ndcY = 1 - (py / height) * 2
 *
 * Our dynamic buffer stores the same data as contiguous floats:
 *   [x0, y0, angle0, x1, y1, angle1, x2, y2, angle2, x3, y3, angle3, ...]
 */
export function extractDynamicBuffer(
  bucket: SymbolBucketAdapter,
  dynamicBuffer: Float32Array,
  viewportWidth: number,
  viewportHeight: number,
): void {
  const dynArr = bucket.text.dynamicLayoutVertexArray
  const len = dynArr.length // total entries (4 per glyph)

  const invW = 2 / viewportWidth
  const invH = 2 / viewportHeight

  for (let i = 0; i < len; i++) {
    const ax = (dynArr as any).getax(i)
    const ay = (dynArr as any).getay(i)
    const angle = (dynArr as any).getangle(i)

    const off = i * 3
    // Convert viewport pixels to NDC
    dynamicBuffer[off] = ax * invW - 1
    dynamicBuffer[off + 1] = 1 - ay * invH
    dynamicBuffer[off + 2] = angle
  }
}
