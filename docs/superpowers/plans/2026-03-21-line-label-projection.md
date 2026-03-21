# Line Label Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make line text labels curve along their line geometry (roads, rivers) with per-frame glyph placement, matching MapLibre's approach.

**Architecture:** Worker sends back line geometry + per-glyph offsets alongside static vertices. Main thread projects line vertices to screen each frame, walks the projected line to place each glyph, writes `(x, y, angle)` into a dynamic vertex buffer. Shader reads the dynamic buffer and applies per-glyph rotation.

**Tech Stack:** TypeScript strict, Vitest (`npx vitest run --config vitest.config.unit.ts <path>`), WebGL

**Spec:** `docs/superpowers/specs/2026-03-21-line-label-projection-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/modular/layers/symbol/types.ts` | Modify | Add `LineLabelInfo` type, extend `SymbolTileData` |
| `src/modular/layers/symbol/line-projection.ts` | Create | Per-frame glyph placement along projected lines |
| `src/modular/layers/symbol/line-projection.test.ts` | Create | Unit tests for projection math |
| `src/modular/layers/symbol/workers/symbol-worker-line.ts` | Modify | Set `alongLine: true`, return `LineLabelInfo[]` |
| `src/modular/layers/symbol/line-text-layer.ts` | Modify | Dynamic buffer, per-frame update, shader changes |

---

### Task 1: Add LineLabelInfo Type

**Files:**
- Modify: `src/modular/layers/symbol/types.ts`

- [ ] **Step 1: Add the LineLabelInfo type and extend SymbolTileData**

Add to `src/modular/layers/symbol/types.ts`:

```ts
/** Metadata for a single line label, used for per-frame projection on the main thread. */
export type LineLabelInfo = {
  /** Anchor position X in tile coords */
  anchorX: number
  /** Anchor position Y in tile coords */
  anchorY: number
  /** Index of the line segment the anchor sits on */
  segment: number
  /**
   * Distance along the line for each glyph center (in tile units, relative to anchor).
   * Negative = before anchor, positive = after anchor. One entry per glyph.
   * Derived from MapLibre's positionedGlyph.x + halfAdvance in getGlyphQuads.
   */
  glyphOffsets: number[]
  /** Flat array of line vertices [x0, y0, x1, y1, ...] in tile coords */
  lineVertices: number[]
}
```

Add the optional field to `SymbolTileData`:

```ts
export type SymbolTileData = {
  vertices: ArrayBuffer
  indices: ArrayBuffer
  count: number
  labelPositions: { x: number; y: number }[]
  labelSizes?: { w: number; h: number }[]
  indicesPerLabel?: number[]
  /** Line label metadata for per-frame projection. Only present for line text. */
  lineLabels?: LineLabelInfo[]
}
```

- [ ] **Step 2: Type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "types.ts" || echo "No errors"
```

- [ ] **Step 3: Commit**

```bash
git add src/modular/layers/symbol/types.ts
git commit -m "feat(symbol): add LineLabelInfo type for line label projection

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Line Projection Module

The core geometry algorithm. Pure math — no GL, no DOM dependencies.

**Files:**
- Create: `src/modular/layers/symbol/line-projection.ts`
- Create: `src/modular/layers/symbol/line-projection.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/modular/layers/symbol/line-projection.test.ts
import { describe, it, expect } from 'vitest'
import { placeGlyphAlongLine, placeGlyphsAlongLine, updateLineLabels } from './line-projection.ts'
import type { LineLabelInfo } from './types.ts'

describe('placeGlyphAlongLine', () => {
  it('places a glyph at offset 0 at the anchor vertex', () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]
    const result = placeGlyphAlongLine(line, 1, 0)
    expect(result).not.toBeNull()
    expect(result!.x).toBeCloseTo(100)
    expect(result!.y).toBeCloseTo(0)
  })

  it('places a glyph at positive offset forward along the line', () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]
    const result = placeGlyphAlongLine(line, 1, 50)
    expect(result).not.toBeNull()
    expect(result!.x).toBeCloseTo(150)
    expect(result!.y).toBeCloseTo(0)
  })

  it('places a glyph at negative offset backward along the line', () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]
    const result = placeGlyphAlongLine(line, 1, -30)
    expect(result).not.toBeNull()
    expect(result!.x).toBeCloseTo(70)
    expect(result!.y).toBeCloseTo(0)
  })

  it('computes correct angle on a diagonal segment', () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 100 }]
    const result = placeGlyphAlongLine(line, 0, 10)
    expect(result).not.toBeNull()
    expect(result!.angle).toBeCloseTo(Math.PI / 4) // 45 degrees
  })

  it('returns null when offset exceeds line length', () => {
    const line = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    const result = placeGlyphAlongLine(line, 0, 50)
    expect(result).toBeNull()
  })

  it('handles crossing multiple segments', () => {
    // L-shaped line: right then up
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]
    const result = placeGlyphAlongLine(line, 0, 150)
    expect(result).not.toBeNull()
    expect(result!.x).toBeCloseTo(100)
    expect(result!.y).toBeCloseTo(50)
    // Angle should be 90 degrees (going up)
    expect(result!.angle).toBeCloseTo(Math.PI / 2)
  })
})

describe('placeGlyphsAlongLine', () => {
  it('places all glyphs for a straight horizontal line', () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]
    const glyphOffsets = [-20, -10, 0, 10, 20]  // 5 glyphs centered on anchor
    const result = placeGlyphsAlongLine(line, 1, glyphOffsets)
    expect(result).toHaveLength(5)
    expect(result[0].x).toBeCloseTo(80)
    expect(result[2].x).toBeCloseTo(100)  // center glyph at anchor
    expect(result[4].x).toBeCloseTo(120)
    // All angles should be 0 (horizontal)
    for (const g of result) expect(g.angle).toBeCloseTo(0)
  })

  it('returns empty array when a glyph falls off the line', () => {
    const line = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    const glyphOffsets = [-100, 0, 100]  // too wide for a 10px line
    const result = placeGlyphsAlongLine(line, 0, glyphOffsets)
    expect(result).toHaveLength(0)
  })
})

describe('updateLineLabels', () => {
  it('fills dynamic buffer with projected positions and angles', () => {
    const labels: LineLabelInfo[] = [{
      anchorX: 100, anchorY: 0,
      segment: 0,
      glyphOffsets: [0],  // 1 glyph at anchor
      lineVertices: [0, 0, 100, 0, 200, 0],
    }]
    // Identity projection: tile coords = screen coords
    const tileToScreen = (x: number, y: number) => ({ x, y })
    // 1 glyph × 4 verts × 3 floats = 12
    const buf = new Float32Array(12)

    updateLineLabels(labels, tileToScreen, buf)

    // All 4 vertices should have the same (x, y, angle)
    for (let v = 0; v < 4; v++) {
      expect(buf[v * 3 + 0]).toBeCloseTo(100)  // x
      expect(buf[v * 3 + 1]).toBeCloseTo(0)    // y
      expect(buf[v * 3 + 2]).toBeCloseTo(0)    // angle (horizontal)
    }
  })

  it('hides label (zeros) when glyph falls off line', () => {
    const labels: LineLabelInfo[] = [{
      anchorX: 5, anchorY: 0,
      segment: 0,
      glyphOffsets: [-100, 0, 100],  // too wide
      lineVertices: [0, 0, 10, 0],
    }]
    const tileToScreen = (x: number, y: number) => ({ x, y })
    // 3 glyphs × 4 verts × 3 floats = 36
    const buf = new Float32Array(36)
    buf.fill(999)  // fill with non-zero to detect zeroing

    updateLineLabels(labels, tileToScreen, buf)

    // All entries should be 0 (hidden)
    for (let i = 0; i < 36; i++) {
      expect(buf[i]).toBe(0)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/line-projection.test.ts
```

Expected: FAIL with `Cannot find module`

- [ ] **Step 3: Implement the line projection module**

```ts
// src/modular/layers/symbol/line-projection.ts
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
 * Adapted from MapLibre's placeGlyphAlongLine (projection.ts:783).
 *
 * STUB: perpendicular offset (lineOffsetY) — MapLibre computes offset normals
 *       and intersection points for labels placed parallel-but-offset from the
 *       line. We only support lineOffsetY=0 (on the line itself).
 * STUB: label flipping — MapLibre reverses direction and adds π to angle when
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

  // Walk line vertices, accumulating distance until we reach the glyph offset.
  // This is the core of MapLibre's placeGlyphAlongLine (projection.ts:838-885).
  while (distanceFromAnchor + currentSegmentDistance <= absOffset) {
    currentIndex += direction

    // Offset doesn't fit on the line — glyph falls off the end
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

  // Interpolate exact position on the final segment.
  // MapLibre projection.ts:888-889
  const segmentInterpolationT = currentSegmentDistance === 0
    ? 0
    : (absOffset - distanceFromAnchor) / currentSegmentDistance
  const dx = currentVertex.x - previousVertex.x
  const dy = currentVertex.y - previousVertex.y
  const x = previousVertex.x + dx * segmentInterpolationT
  const y = previousVertex.y + dy * segmentInterpolationT

  // Angle from segment direction.
  // MapLibre projection.ts:891
  const angle = Math.atan2(currentVertex.y - previousVertex.y, currentVertex.x - previousVertex.x)

  return { x, y, angle }
}

/**
 * Place all glyphs for one label along a projected line.
 *
 * Each glyph has an offset (distance from anchor along the line, in projected
 * units). Returns an array of {x, y, angle} for each glyph, or an empty array
 * if any glyph falls off the line (the entire label is hidden).
 *
 * Adapted from MapLibre's placeGlyphsAlongLine (projection.ts:425).
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
      // Any glyph failing hides the entire label (MapLibre behavior)
      return []
    }
    results.push(placed)
  }

  return results
}

/**
 * Update dynamic vertex data for all line labels in a tile.
 *
 * For each label:
 * 1. Project the line vertices from tile coords to screen coords
 * 2. Find the anchor vertex index in the projected line
 * 3. Place each glyph along the projected line
 * 4. Write (x, y, angle) × 4 vertices into the dynamic buffer
 *
 * If a label can't be placed (glyphs fall off line), its buffer entries are
 * zeroed (hidden).
 *
 * Adapted from MapLibre's updateLineLabels (projection.ts:208).
 *
 * STUB: projection cache — currently re-projects all line vertices each frame.
 *       MapLibre caches projected vertices per bucket to avoid redundant work
 *       when multiple glyphs share line vertices.
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
    const numFloats = numGlyphs * 4 * 3  // 4 verts per glyph, 3 floats per vert

    // Project line vertices to screen space
    const numVertices = label.lineVertices.length / 2
    const projectedLine: Array<{ x: number; y: number }> = []
    for (let i = 0; i < numVertices; i++) {
      const tileX = label.lineVertices[i * 2]
      const tileY = label.lineVertices[i * 2 + 1]
      projectedLine.push(tileToScreen(tileX, tileY))
    }

    // Place glyphs along the projected line
    const placements = placeGlyphsAlongLine(
      projectedLine,
      label.segment,
      label.glyphOffsets,
    )

    if (placements.length === 0) {
      // Label doesn't fit — zero out buffer (hidden)
      for (let i = 0; i < numFloats; i++) {
        dynamicBuffer[bufferOffset + i] = 0
      }
    } else {
      // Write (x, y, angle) for each glyph, 4 times per glyph (one per quad corner)
      // MapLibre's addDynamicAttributes (symbol_bucket.ts:145-149)
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
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/line-projection.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/line-projection.ts src/modular/layers/symbol/line-projection.test.ts
git commit -m "feat(symbol): add line-projection module — per-frame glyph placement along lines

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Worker Changes — alongLine + LineLabelInfo

**Files:**
- Modify: `src/modular/layers/symbol/workers/symbol-worker-line.ts`

- [ ] **Step 1: Read the full worker file first**

Read `src/modular/layers/symbol/workers/symbol-worker-line.ts` to understand the current layout.

- [ ] **Step 2: Modify the worker**

Three changes needed in `_runLayout()`:

**Change 1**: Switch `alongLine: false` to `alongLine: true` in the `buildGlyphQuads()` call (line ~153).

**Change 2**: After building quads for each anchor, extract the glyph offsets. When `alongLine: true`, MapLibre's `getGlyphQuads()` stores the glyph's position along the line in the quad's positional data. The glyph offset is `positionedGlyph.x + halfAdvance` (in em units). We need to collect these from the shaping data.

The glyph offsets come from the `shaping.positionedGlyphs` array. Each `positionedGlyph` has an `x` field (in em units) and we need the half-advance to compute the center. Since `getGlyphQuads` already uses this internally, we extract it ourselves:

```ts
// Extract per-glyph offsets along the line (distance from anchor in tile units)
const glyphOffsets: number[] = []
for (const section of shaping.positionedGlyphs) {
  // section.x is the glyph's left edge in em units
  // Add halfAdvance to get the center position
  const metrics = this._glyphPositions[fontstack]?.[section.glyph]?.metrics
  const advance = metrics?.advance ?? 0
  const halfAdvance = advance / 2
  // Convert from em units to tile units: multiply by (fontSize / ONE_EM) * textPixelRatio
  glyphOffsets.push((section.x + halfAdvance) * scale * textPixelRatio)
}
```

Note: The actual implementation needs to handle the shaping data structure carefully. Read MapLibre's `getGlyphQuads` in `src/symbol/quads.ts` to see how `positionedGlyph.x + halfAdvance` is used. In the shaping, `positionedGlyphs` is a flat array — iterate it directly.

**Change 3**: Store the line vertices and anchor segment for each label. Add to the result:

```ts
const lineLabels: LineLabelInfo[] = []

// ... inside the anchor loop, after building quads:
lineLabels.push({
  anchorX: anchor.x,
  anchorY: anchor.y,
  segment: anchor.segment ?? 0,
  glyphOffsets,
  lineVertices: line.flatMap(p => [p.x, p.y]),
})
```

Add `lineLabels` to the returned `SymbolTileData`.

- [ ] **Step 3: Run existing tests to make sure nothing broke**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/
```

- [ ] **Step 4: Commit**

```bash
git add src/modular/layers/symbol/workers/symbol-worker-line.ts
git commit -m "feat(symbol): worker returns LineLabelInfo with line geometry and glyph offsets

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: LineTextLayer — Dynamic Buffer + Shader + Per-Frame Update

This is the integration task. Read the full `line-text-layer.ts` first.

**Files:**
- Modify: `src/modular/layers/symbol/line-text-layer.ts`

- [ ] **Step 1: Read the full current file**

Read `src/modular/layers/symbol/line-text-layer.ts` completely.

- [ ] **Step 2: Update the shader**

Replace the vertex shader (`sdfVert`) with one that supports both point and line-along modes:

```glsl
precision mediump float;
attribute vec2 a_anchor;
attribute vec2 a_offset;
attribute vec2 a_tex;
attribute vec3 a_projected_pos;  // (x, y, angle) from dynamic buffer
uniform vec2 u_texsize;
uniform vec2 u_resolution;
uniform float u_is_along_line;   // 1.0 = line label, 0.0 = point label
varying vec2 v_uv;

void main() {
  if (u_is_along_line > 0.5) {
    // Line label: use pre-computed screen position + rotation
    // MapLibre symbol_sdf.vertex.glsl: segment_angle = -a_projected_pos[2]
    float angle = -a_projected_pos.z;
    float cos_a = cos(angle);
    float sin_a = sin(angle);
    mat2 rot = mat2(cos_a, -sin_a, sin_a, cos_a);
    vec2 rotated_offset = rot * (a_offset / 32.0);
    // a_projected_pos.xy is in NDC (-1..1), offset is in pixels
    vec2 pixel_offset = rotated_offset * vec2(2.0, -2.0) / u_resolution;
    gl_Position = vec4(a_projected_pos.xy + pixel_offset, 0.0, 1.0);
    // STUB: pitch correction — MapLibre adjusts z/w for depth based on camera distance
  } else {
    // Point label: existing tile projection
    vec4 proj = projectTile(a_anchor);
    vec2 screen = proj.xy / proj.w;
    screen += (a_offset / 32.0) * vec2(2.0, -2.0) / u_resolution;
    gl_Position = vec4(screen * proj.w, proj.z, proj.w);
  }
  v_uv = a_tex / u_texsize;
}
```

Note: use `float` for `u_is_along_line` instead of `bool` — WebGL 1 `bool` uniforms can be quirky. Compare with `> 0.5`.

- [ ] **Step 3: Extend the bucket type and uploadBucket()**

Add storage for line label data and dynamic buffer. The `uploadBucket()` method needs to:
1. Store `lineLabels` from the worker result
2. Count total glyphs (sum of all `glyphOffsets.length`)
3. Allocate `Float32Array` of size `totalGlyphs * 4 * 3`
4. Create a GL buffer for the dynamic data (`gl.ARRAY_BUFFER`, `gl.DYNAMIC_DRAW`)

- [ ] **Step 4: Update drawTile() for per-frame projection**

Before drawing:
1. Call `updateLineLabels()` to fill the CPU-side dynamic buffer
2. Upload to GPU via `gl.bufferSubData()` (or `gl.bufferData()` with `DYNAMIC_DRAW`)
3. Bind the dynamic buffer as `a_projected_pos` attribute (3 × float32, stride 12, offset 0)
4. Set `u_is_along_line = 1.0`

The `tileToScreen` function needs to project tile coords to NDC (the coordinate space the shader expects for `a_projected_pos.xy`). This should match what `projectTile(a_anchor).xy / projectTile(a_anchor).w` produces. Use the same projection math as `_projectToScreen()` from the base class, but output NDC (-1..1) instead of pixel coords:

```ts
// Tile coord → NDC, matching what projectTile() does in the vertex shader
function makeTileToNDC(tileID: TileID, camera: CameraState, canvasWidth: number, canvasHeight: number) {
  const { zoom } = camera
  const TILE_SIZE = 256
  const worldSize = TILE_SIZE * Math.pow(2, zoom)
  const cx = lngToTileX(camera.center.lng, zoom) * TILE_SIZE
  const cy = latToTileY(camera.center.lat, zoom) * TILE_SIZE
  const w = canvasWidth
  const h = canvasHeight

  const parts = tileID.key.split('/')
  const tz = parseInt(parts[0], 10)
  const tx = parseInt(parts[1], 10)
  const ty = parseInt(parts[2], 10)
  const tileScale = worldSize / Math.pow(2, tz)
  const tileOriginX = tx * tileScale
  const tileOriginY = ty * tileScale
  const extent = 4096  // TILE_EXTENT for line text

  return (tileX: number, tileY: number) => {
    const worldX = tileOriginX + (tileX / extent) * tileScale
    const worldY = tileOriginY + (tileY / extent) * tileScale
    // Pixel coords
    const px = (worldX - cx) + w / 2
    const py = (worldY - cy) + h / 2
    // NDC: -1..1
    return {
      x: (px / w) * 2 - 1,
      y: -((py / h) * 2 - 1),  // flip Y for GL
    }
  }
}
```

Important: verify this NDC output matches what the existing `projectTile()` shader function produces. The safest approach is to render a test label and compare positions.

- [ ] **Step 5: Test with the demo**

```bash
node scripts/demo.ts open phase10
node scripts/demo.ts zoom 3 5 -d 1000 -s
```

Visually verify that line labels curve along roads instead of rendering horizontally.

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/
```

- [ ] **Step 7: Commit**

```bash
git add src/modular/layers/symbol/line-text-layer.ts
git commit -m "feat(line-text): per-frame glyph projection along line geometry

Glyphs are now individually rotated to follow the line curve.
Dynamic vertex buffer updated each frame with (x, y, angle) per glyph.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Visual Verification + Edge Cases

**Files:** None (testing only)

- [ ] **Step 1: Test various zoom levels**

```bash
node scripts/demo.ts open phase10
node scripts/demo.ts zoom 2 6 -d 2000 -s
node scripts/demo.ts zoom 6 2 -d 2000 -s
```

Check that:
- Labels curve along roads
- Labels survive zoom transitions (no disappearing)
- Labels don't render garbled or upside-down at extreme angles

- [ ] **Step 2: Take comparison screenshots**

```bash
node scripts/demo.ts zoom 4 -s
node scripts/demo.ts zoom 5 -s
node scripts/demo.ts zoom 6 -s
```

Review the screenshots for visual correctness.

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/
```

Ensure no regressions.
