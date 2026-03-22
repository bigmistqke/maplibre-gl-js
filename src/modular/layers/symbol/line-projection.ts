/**
 * Per-frame line label projection.
 *
 * For each label, walks the screen-projected line geometry and places
 * each glyph at its offset distance from the anchor. Returns (x, y, angle)
 * per glyph for the dynamic vertex buffer.
 *
 * Algorithm adapted from MapLibre's src/symbol/projection.ts:
 * - placeGlyphAlongLine (line 783-899): core line-walking + interpolation
 * - placeGlyphsAlongLine (line 425-512): orchestrate all glyphs for one label
 * - updateLineLabels (line 208-322): per-frame entry point
 */

import type { LineLabelInfo } from './types.ts'
import { createDebug } from '../../debug.ts'

const debug = createDebug?.('LineProjection', false)

export type ProjectedGlyph = { x: number; y: number; angle: number }

/**
 * Place a single glyph at a given offset distance along a projected line.
 *
 * Walks from the anchor vertex forward (positive offset) or backward (negative)
 * through line segments, accumulating distance. When the accumulated distance
 * reaches the target offset, interpolates the exact position on the segment
 * and computes the angle from the segment direction.
 *
 * Angle is always returned in the label-reading direction: for backward traversal
 * the segment vector is negated so the angle faces forward (text always readable).
 *
 * Adapted from MapLibre's placeGlyphAlongLine (projection.ts:783).
 *
 * STUB: perpendicular offset (lineOffsetY) — MapLibre computes offset normals
 *       and intersection points for labels placed parallel-but-offset from the
 *       line. We only support lineOffsetY=0 (on the line itself).
 * STUB: label flipping — MapLibre reverses direction and adds pi to angle when
 *       text reads right-to-left. We always place in forward order.
 */
export function placeGlyphAlongLine(
  projectedLine: Array<{ x: number; y: number }>,
  anchorVertex: number,
  offsetDistance: number,
): ProjectedGlyph | null {
  const direction = offsetDistance >= 0 ? 1 : -1
  const absOffset = Math.abs(offsetDistance)

  let currentIndex = anchorVertex
  let currentVertex = projectedLine[currentIndex]
  let previousVertex = currentVertex
  let distanceFromAnchor = 0
  let currentSegmentDistance = 0

  while (distanceFromAnchor + currentSegmentDistance <= absOffset) {
    currentIndex += direction

    if (currentIndex < 0 || currentIndex >= projectedLine.length) {
      return null
    }

    distanceFromAnchor += currentSegmentDistance
    previousVertex = currentVertex
    currentVertex = projectedLine[currentIndex]

    const dx = currentVertex.x - previousVertex.x
    const dy = currentVertex.y - previousVertex.y
    currentSegmentDistance = Math.sqrt(dx * dx + dy * dy)
  }

  const segmentInterpolationT = currentSegmentDistance === 0
    ? 0
    : (absOffset - distanceFromAnchor) / currentSegmentDistance
  const dx = currentVertex.x - previousVertex.x
  const dy = currentVertex.y - previousVertex.y
  const x = previousVertex.x + dx * segmentInterpolationT
  const y = previousVertex.y + dy * segmentInterpolationT

  // For backward traversal negate the segment vector so the angle faces in the
  // natural label-reading direction (MapLibre adds PI for direction < 0 which
  // is equivalent to negating the direction vector).
  const angle = direction > 0
    ? Math.atan2(dy, dx)
    : Math.atan2(-dy, -dx)

  return { x, y, angle }
}

/**
 * Place all glyphs for one label along a projected line.
 *
 * Matches MapLibre's placeGlyphsAlongLine (projection.ts:425):
 * - Places first and last glyph first to check orientation
 * - If text reads right-to-left on screen (first.x > last.x), flips
 *   by negating offsets and adding π to angles (keepUpright)
 */
export function placeGlyphsAlongLine(
  projectedLine: Array<{ x: number; y: number }>,
  anchorVertex: number,
  glyphOffsets: number[],
): ProjectedGlyph[] {
  if (glyphOffsets.length === 0) return []

  // Place all glyphs in forward direction first
  const results = placeAllGlyphs(projectedLine, anchorVertex, glyphOffsets)
  if (results.length === 0) return []

  // Check if text reads right-to-left on screen — if so, flip
  const first = results[0]
  const last = results[results.length - 1]
  if (first.x > last.x) {
    // Flip: negate offsets and re-place.
    // placeGlyphAlongLine already computes correct angles for the reversed direction.
    const flipped = placeAllGlyphs(projectedLine, anchorVertex, glyphOffsets.map(o => -o))
    if (flipped.length === 0) return []
    return flipped
  }

  return results
}

function placeAllGlyphs(
  projectedLine: Array<{ x: number; y: number }>,
  anchorVertex: number,
  glyphOffsets: number[],
): ProjectedGlyph[] {
  const results: ProjectedGlyph[] = []
  for (const offset of glyphOffsets) {
    const placed = placeGlyphAlongLine(projectedLine, anchorVertex, offset)
    if (!placed) return []
    results.push(placed)
  }
  return results
}

/**
 * Update dynamic vertex data for all line labels in a tile.
 *
 * Uses the label's anchorX/anchorY as the projected anchor position and
 * label.segment as the index of the line segment the anchor sits on (0-based).
 * The anchor vertex for placeGlyphAlongLine is derived as segment (forward) or
 * segment+1 (backward) — matching MapLibre's projection.ts:810-812.
 *
 * STUB: projection cache — currently re-projects all line vertices each frame.
 *       MapLibre caches projected vertices per bucket to avoid redundant work.
 * STUB: pitch correction — MapLibre adjusts font scale per label based on
 *       distance from camera at high pitch angles.
 * STUB: globe occlusion — MapLibre checks if projected points are behind the
 *       globe and hides them.
 */
/**
 * @param tileToPixel Projects tile coords → pixel coords (distances are in pixels)
 * @param pixelToNDC Converts pixel position → NDC for the shader
 * @param fontScale fontSize / 24 — scales glyph offsets (ONE_EM units) to pixel distances.
 *        MapLibre applies this at placement time (projection.ts:439), not at layout time.
 */
export function updateLineLabels(
  lineLabels: LineLabelInfo[],
  tileToPixel: (x: number, y: number) => { x: number; y: number },
  pixelToNDC: (x: number, y: number) => { x: number; y: number },
  fontScale: number,
  dynamicBuffer: Float32Array,
): void {
  let bufferOffset = 0

  for (const label of lineLabels) {
    const numGlyphs = label.glyphOffsets.length
    const numFloats = numGlyphs * 4 * 3

    // Project line vertices to pixel space (where distances are meaningful)
    const numVertices = label.lineVertices.length / 2
    const projectedLine: Array<{ x: number; y: number }> = []
    for (let i = 0; i < numVertices; i++) {
      projectedLine.push(tileToPixel(label.lineVertices[i * 2], label.lineVertices[i * 2 + 1]))
    }

    // Project the anchor point separately — it sits between vertices
    // label.segment and label.segment+1 on the clipped line.
    // MapLibre starts the walk at the projected anchor (not at a vertex),
    // using anchorSegment to index into the line array (projection.ts:810-824).
    const anchorPixel = tileToPixel(label.anchorX, label.anchorY)

    // Insert anchor into projected line between segment and segment+1.
    // This gives the walk the correct start position with full line on both sides.
    const lineWithAnchor = [
      ...projectedLine.slice(0, label.segment + 1),
      anchorPixel,
      ...projectedLine.slice(label.segment + 1),
    ]
    const anchorVertexIndex = label.segment + 1

    // Log anchor position in both tile and pixel space
    if (debug) {
      const anchorPxPos = lineWithAnchor[anchorVertexIndex]
      const firstPx = lineWithAnchor[0]
      if (anchorPxPos && firstPx) {
        // Compute along-line backward distance (not straight-line)
        let bwdDist = 0
        for (let i = anchorVertexIndex; i > 0; i--) {
          const dx = lineWithAnchor[i].x - lineWithAnchor[i - 1].x
          const dy = lineWithAnchor[i].y - lineWithAnchor[i - 1].y
          bwdDist += Math.sqrt(dx * dx + dy * dy)
        }
        debug?.(`anchor seg=${label.segment} injAt=${anchorVertexIndex}/${lineWithAnchor.length}v bwdPx=${Math.round(bwdDist)}`)
      }
    }

    // Scale glyph offsets from ONE_EM units to pixel units.
    // MapLibre: fontScale = fontSize / 24, applied at placement time (projection.ts:439)
    const pixelOffsets = label.glyphOffsets.map(o => o * fontScale)

    const placements = placeGlyphsAlongLine(lineWithAnchor, anchorVertexIndex, pixelOffsets)

    if (placements.length === 0) {
      // Compute why it failed — distance available forward/backward from anchor
      let distForward = 0, distBackward = 0
      for (let i = anchorVertexIndex + 1; i < lineWithAnchor.length; i++) {
        const dx = lineWithAnchor[i].x - lineWithAnchor[i - 1].x
        const dy = lineWithAnchor[i].y - lineWithAnchor[i - 1].y
        distForward += Math.sqrt(dx * dx + dy * dy)
      }
      for (let i = anchorVertexIndex - 1; i >= 0; i--) {
        const dx = lineWithAnchor[i + 1].x - lineWithAnchor[i].x
        const dy = lineWithAnchor[i + 1].y - lineWithAnchor[i].y
        distBackward += Math.sqrt(dx * dx + dy * dy)
      }
      const minOff = Math.min(...pixelOffsets)
      const maxOff = Math.max(...pixelOffsets)
      const reason = Math.abs(minOff) > distBackward ? 'bwd' :
                     maxOff > distForward ? 'fwd' : '?'
      debug?.(`HIDDEN ${reason} anchor=${anchorVertexIndex}/${projectedLine.length}v fwd=${Math.round(distForward)}px(need ${Math.round(maxOff)}) bwd=${Math.round(distBackward)}px(need ${Math.round(Math.abs(minOff))})`)

      for (let i = 0; i < numFloats; i++) {
        dynamicBuffer[bufferOffset + i] = 0
      }
    } else {
      let writeIdx = 0
      for (const glyph of placements) {
        // Convert pixel position to NDC for the shader
        const ndc = pixelToNDC(glyph.x, glyph.y)
        for (let v = 0; v < 4; v++) {
          dynamicBuffer[bufferOffset + writeIdx++] = ndc.x
          dynamicBuffer[bufferOffset + writeIdx++] = ndc.y
          dynamicBuffer[bufferOffset + writeIdx++] = glyph.angle
        }
      }
    }

    bufferOffset += numFloats
  }
}
