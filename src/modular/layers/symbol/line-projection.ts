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
 * STUB: first/last glyph check — MapLibre places first and last glyph first
 *       to early-exit if label doesn't fit on screen. We place all glyphs
 *       unconditionally and hide the label only if a glyph falls off the line.
 * STUB: label flipping — MapLibre checks if first glyph x > last glyph x
 *       (text reads right-to-left on screen) and reverses traversal.
 */
export function placeGlyphsAlongLine(
  projectedLine: Array<{ x: number; y: number }>,
  anchorVertex: number,
  glyphOffsets: number[],
): ProjectedGlyph[] {
  const results: ProjectedGlyph[] = []

  for (const offset of glyphOffsets) {
    const placed = placeGlyphAlongLine(projectedLine, anchorVertex, offset)
    if (!placed) {
      return []
    }
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
export function updateLineLabels(
  lineLabels: LineLabelInfo[],
  tileToScreen: (x: number, y: number) => { x: number; y: number },
  dynamicBuffer: Float32Array,
): void {
  let bufferOffset = 0

  for (const label of lineLabels) {
    const numGlyphs = label.glyphOffsets.length
    const numFloats = numGlyphs * 4 * 3

    const numVertices = label.lineVertices.length / 2
    const projectedLine: Array<{ x: number; y: number }> = []
    for (let i = 0; i < numVertices; i++) {
      projectedLine.push(tileToScreen(label.lineVertices[i * 2], label.lineVertices[i * 2 + 1]))
    }

    // Inject the projected anchor into the line array at position label.segment+1.
    // This way we can call placeGlyphAlongLine with anchorVertex = label.segment+1
    // and the anchor coordinates are honoured exactly (MapLibre uses the actual
    // projected anchor as the walk start point, not the nearest line vertex).
    const anchorScreenPoint = tileToScreen(label.anchorX, label.anchorY)
    const lineWithAnchor = [
      ...projectedLine.slice(0, label.segment + 1),
      anchorScreenPoint,
      ...projectedLine.slice(label.segment + 1),
    ]
    const anchorVertexIndex = label.segment + 1

    const placements = placeGlyphsAlongLine(lineWithAnchor, anchorVertexIndex, label.glyphOffsets)

    if (placements.length === 0) {
      for (let i = 0; i < numFloats; i++) {
        dynamicBuffer[bufferOffset + i] = 0
      }
    } else {
      let writeIdx = 0
      for (const glyph of placements) {
        for (let v = 0; v < 4; v++) {
          dynamicBuffer[bufferOffset + writeIdx++] = glyph.x
          dynamicBuffer[bufferOffset + writeIdx++] = glyph.y
          dynamicBuffer[bufferOffset + writeIdx++] = glyph.angle
        }
      }
    }

    bufferOffset += numFloats
  }
}
