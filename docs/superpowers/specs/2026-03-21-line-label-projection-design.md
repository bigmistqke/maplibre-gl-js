# Line Label Projection — Design Spec

## Overview

Make line text labels follow the curve of their line geometry (roads, rivers) instead of rendering as horizontal text at anchor points. Glyphs are individually rotated to be tangent to the line at their position, recomputed every frame.

**Goals:**
- Glyphs curve along the line geometry, matching MapLibre's visual output
- Per-frame recomputation so labels stay correct as camera changes
- STUB points for future features: pitch correction, globe projection, label flipping, perpendicular offset, projection cache

**Non-goals:**
- Pitch-corrected projection (STUB)
- Globe/terrain occlusion (STUB)
- Label flipping / keepUpright (STUB)
- Perpendicular line offset (STUB)
- Projection caching for performance (STUB)

---

## How MapLibre Does It

MapLibre's approach (from `src/symbol/projection.ts`):

1. **Layout time**: Store line geometry (`lineVertexArray`), per-glyph horizontal offsets (`glyphOffsetArray`), and anchor metadata (`PlacedSymbolArray` with segment index, glyph count, line range).

2. **Per frame**: `updateLineLabels()` iterates all placed line symbols. For each:
   - Project anchor to screen space. If off-screen, hide.
   - Call `placeFirstAndLastGlyph()` to check if label fits on screen.
   - Call `placeGlyphsAlongLine()` for all intermediate glyphs.
   - Each glyph: walk the projected line vertices accumulating distance until reaching the glyph's offset. Interpolate position on the final segment. Compute angle from segment direction.
   - Write `(x, y, angle)` into `dynamicLayoutVertexArray` (3 × float32 per vertex, 4 vertices per glyph quad).

3. **Shader**: `a_projected_pos` provides the pre-computed position and angle. The shader builds a rotation matrix from the angle and applies it to the glyph's corner offsets.

**Why per-frame**: The projected line shape changes with camera movement (pan, zoom, pitch, bearing). Tile-space line geometry is constant, but its screen-space projection is not.

**Why the projection cache**: Multiple glyphs in one label share line vertices. Caching projected vertices avoids redundant matrix multiplications. (We STUB this for now — correctness first, performance later.)

**Why label flipping**: Text should always read left-to-right. When a line runs right-to-left on screen, MapLibre reverses glyph traversal direction and adds 180° to all angles. (STUB for now.)

**Why pitch correction**: At high pitch angles, labels closer to the horizon are smaller. MapLibre adjusts font scale per label based on distance from camera. (STUB for now.)

---

## Architecture

### Data Flow

```
Worker (layout time):
  clipLine() → getLineAnchors() → anchors with segment index
  buildGlyphQuads() with alongLine: true → per-glyph offsets along line
  Pack static vertices (anchor + glyph corner offsets + UV)
  Return: static vertices, indices, LineLabelData[] per tile

Main thread (per frame, before draw):
  For each tile's labels:
    Project line vertices: tile coords → screen coords
    For each label:
      Walk projected line from anchor, place each glyph at its offset
      Write (x, y, angle) into Float32Array dynamic buffer
    Upload dynamic buffer to GPU

Shader:
  attribute vec3 a_projected_pos;  // (x, y, angle)
  When u_is_along_line:
    position = a_projected_pos.xy (screen space)
    rotation = mat2 from a_projected_pos.z
    Apply rotation to glyph corner offsets (a_offset)
```

### Components

#### 1. Worker Changes (`symbol-worker-line.ts`)

**Change**: Set `alongLine: true` in `buildGlyphQuads()` call.

When `alongLine: true`, MapLibre's `getGlyphQuads()` stores glyph offsets differently:
- `quad.tl/tr/bl/br` become corner offsets relative to the glyph center (not the anchor)
- The glyph's position along the line is in `positionedGlyph.x + halfAdvance`

**New output fields** in `SymbolTileData`:

```ts
type LineLabelInfo = {
  anchorX: number
  anchorY: number
  /** Index of the line segment the anchor sits on */
  segment: number
  /** Distance along the line for each glyph (in tile units). One per glyph. */
  glyphOffsets: number[]
  /** Flat array of line vertices [x0, y0, x1, y1, ...] in tile coords */
  lineVertices: number[]
}
```

Added to `SymbolTileData`:
```ts
type SymbolTileData = {
  vertices: ArrayBuffer
  indices: ArrayBuffer
  count: number
  labelPositions: { x: number; y: number }[]
  labelSizes?: { w: number; h: number }[]
  indicesPerLabel?: number[]
  /** Line label metadata for per-frame projection. Only for line text. */
  lineLabels?: LineLabelInfo[]
}
```

The static vertex buffer still uses the same 12-byte `GlyphVertexLayout`. The `ax, ay` fields store the anchor position. The `ox, oy` fields store the glyph corner offsets (relative to glyph center, not anchor — because `alongLine: true` changes the offset semantics).

#### 2. Line Projection Module (`line-projection.ts`, ~150 lines)

New file. Pure geometry — no GL, no DOM.

```ts
/**
 * Per-frame line label projection.
 *
 * For each label, walks the screen-projected line geometry and places
 * each glyph at its offset distance from the anchor. Returns (x, y, angle)
 * per glyph for the dynamic vertex buffer.
 *
 * References MapLibre's src/symbol/projection.ts — same algorithm,
 * adapted to our data structures.
 */

type ProjectedGlyph = { x: number; y: number; angle: number }

/**
 * Update dynamic vertex data for all line labels in a tile.
 *
 * @param lineLabels Label metadata from worker
 * @param tileToScreen Function projecting tile coords → screen coords
 * @param dynamicBuffer Output Float32Array (3 floats × 4 verts per glyph)
 *
 * STUB: projection cache — currently re-projects all vertices each frame.
 *       MapLibre caches projected vertices per bucket to avoid redundant work.
 * STUB: pitch correction — MapLibre scales font size based on distance from camera.
 * STUB: globe occlusion — MapLibre checks if projected point is behind the globe.
 */
function updateLineLabels(
  lineLabels: LineLabelInfo[],
  tileToScreen: (x: number, y: number) => { x: number; y: number },
  dynamicBuffer: Float32Array,
): void

/**
 * Place all glyphs for one label along a projected line.
 *
 * STUB: label flipping — MapLibre checks if text reads right-to-left on screen
 *       and reverses glyph order + adds 180° to angles. We always render in
 *       layout order for now.
 * STUB: first/last glyph check — MapLibre places first and last glyph first
 *       to early-exit if label doesn't fit. We place all glyphs unconditionally.
 */
function placeGlyphsAlongLine(
  projectedLine: Array<{ x: number; y: number }>,
  anchorIndex: number,
  glyphOffsets: number[],
): ProjectedGlyph[]

/**
 * Place a single glyph at a given offset distance along a projected line.
 *
 * Algorithm (from MapLibre's placeGlyphAlongLine):
 * 1. Start at anchor vertex
 * 2. Walk forward (or backward for negative offsets) through line vertices
 * 3. Accumulate segment distances
 * 4. When accumulated distance >= glyph offset: interpolate position on segment
 * 5. Compute angle from segment direction: atan2(dy, dx)
 *
 * STUB: perpendicular offset — MapLibre computes offset normals and
 *       intersection points for labels placed parallel-but-offset from the line.
 */
function placeGlyphAlongLine(
  projectedLine: Array<{ x: number; y: number }>,
  startVertex: number,
  offsetDistance: number,
): ProjectedGlyph | null
```

#### 3. Dynamic Vertex Buffer

Per tile, a `Float32Array` sized at `numGlyphs × 4 vertices × 3 floats`. Updated every frame by `updateLineLabels()`, uploaded to GPU before draw.

```ts
// In LineTextLayer, per tile:
type LineTileBucket = GPUBucket & {
  dynamicBuffer: Float32Array       // CPU-side, written each frame
  dynamicGLBuffer: WebGLBuffer      // GPU-side, uploaded each frame
  lineLabels: LineLabelInfo[]       // from worker
  numGlyphs: number                 // total glyph count for sizing
}
```

#### 4. Shader Changes

The vertex shader gains a new attribute and uniform:

```glsl
attribute vec3 a_projected_pos;  // (x, y, angle) — from dynamic buffer
uniform bool u_is_along_line;

void main() {
  if (u_is_along_line) {
    // Line label: use pre-computed screen position + rotation
    float angle = -a_projected_pos.z;
    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 offset = rot * (a_offset / 32.0) * vec2(2.0, -2.0) / u_resolution;
    vec2 screen = a_projected_pos.xy + offset;
    // STUB: pitch correction — MapLibre adjusts position based on camera distance
    gl_Position = vec4(screen, 0.0, 1.0);
  } else {
    // Point label: existing behavior (unchanged)
    vec4 proj = projectTile(a_anchor);
    vec2 screen = proj.xy / proj.w;
    screen += (a_offset / 32.0) * vec2(2.0, -2.0) / u_resolution;
    gl_Position = vec4(screen * proj.w, proj.z, proj.w);
  }
  v_uv = a_tex / u_texsize;
}
```

Note: the `a_projected_pos.xy` values need to be in clip space or NDC, matching how `projectTile` outputs. The exact coordinate space depends on how `tileToScreen` is implemented — it should output the same space as `projectTile(a_anchor).xy / projectTile(a_anchor).w`.

#### 5. LineTextLayer Changes

**`onAdd()`**: unchanged.

**`uploadBucket()`**:
- Also store `lineLabels` and allocate the dynamic Float32Array + GL buffer.
- Size dynamic buffer based on total glyph count from worker.

**`drawTile()` override**:
- Before drawing: call `updateLineLabels()` to fill dynamic buffer.
- Upload dynamic buffer to GPU (`gl.bufferSubData`).
- Bind both static and dynamic vertex attributes.
- Set `u_is_along_line = true`.
- Draw as before.

**`tileToScreen()`**:
- Needs camera + tile position to project tile coords → screen/clip coords.
- Reuses the same math as `_projectToScreen()` from the base class, but returns screen coords in the coordinate space the shader expects.

---

## What Gets Changed

| File | Change |
|------|--------|
| `src/modular/layers/symbol/workers/symbol-worker-line.ts` | Set `alongLine: true`, return `LineLabelInfo[]` |
| `src/modular/layers/symbol/types.ts` | Add `LineLabelInfo` type, extend `SymbolTileData` |
| `src/modular/layers/symbol/line-text-layer.ts` | Store line data, dynamic buffer, per-frame update |
| `src/modular/layers/symbol/line-projection.ts` | **NEW**: per-frame glyph placement along projected lines |
| `src/modular/layers/symbol/line-projection.test.ts` | **NEW**: unit tests for projection math |

Shaders are inline in `line-text-layer.ts` — modified in place.

---

## STUB Registry

These are explicitly deferred features. Each STUB is commented in the code with what MapLibre does and why.

| STUB | Where | What MapLibre does | Why it matters |
|------|-------|--------------------|----------------|
| Projection cache | `updateLineLabels` | Caches projected vertices per bucket | Performance: avoids redundant projections for shared line vertices |
| Label flipping | `placeGlyphsAlongLine` | Reverses glyph order when text reads R→L | Readability: text always reads left-to-right |
| First/last check | `placeGlyphsAlongLine` | Early-exit if first or last glyph falls off screen | Performance: skip labels that won't fit |
| Pitch correction | shader + `updateLineLabels` | Adjusts size based on camera distance | Visual: labels near horizon are smaller |
| Globe occlusion | `updateLineLabels` | Hides labels behind the globe | Correctness: globe mode only |
| Perpendicular offset | `placeGlyphAlongLine` | Computes offset normals for parallel placement | Feature: `text-offset` property support |
| Variable anchor | shader | Tests multiple anchor positions | Feature: collision avoidance |
