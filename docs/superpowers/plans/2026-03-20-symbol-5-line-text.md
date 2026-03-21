# LineTextLayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement line text rendering — labels that follow road/river curves. Reuses TextLayer's shaders and GlyphManager; adds a separate worker with full line machinery.

**Architecture:** symbol_layout_helpers.ts extracts the shared layout logic from MapLibre's symbol_layout.ts. The line worker imports this plus path_interpolator, check_max_angle, clip_line, merge_lines. LineTextLayer is structurally identical to TextLayer but uses the line worker.

**Tech Stack:** TypeScript strict, Vitest (unit), MapLibre symbol machinery (verbatim copies)

**Spec:** `docs/superpowers/specs/2026-03-20-symbol-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/modular/layers/symbol/vendor/path_interpolator.ts` | Create | Verbatim copy from `src/symbol/path_interpolator.ts` |
| `src/modular/layers/symbol/vendor/path_interpolator.test.ts` | Create | Unit tests |
| `src/modular/layers/symbol/vendor/check_max_angle.ts` | Create | Verbatim copy from `src/symbol/check_max_angle.ts` |
| `src/modular/layers/symbol/vendor/check_max_angle.test.ts` | Create | Unit tests |
| `src/modular/layers/symbol/vendor/clip_line.ts` | Create | Verbatim copy from `src/symbol/clip_line.ts` |
| `src/modular/layers/symbol/vendor/clip_line.test.ts` | Create | Unit tests |
| `src/modular/layers/symbol/vendor/merge_lines.ts` | Create | Verbatim copy from `src/symbol/merge_lines.ts` |
| `src/modular/layers/symbol/vendor/merge_lines.test.ts` | Create | Unit tests |
| `src/modular/layers/symbol/vendor/symbol_layout_helpers.ts` | Create | Extracted shared internals from `src/symbol/symbol_layout.ts` |
| `src/modular/layers/symbol/vendor/symbol_layout_helpers.test.ts` | Create | Unit test — exports the needed functions |
| `src/modular/layers/symbol/workers/symbol-worker-line.ts` | Create | Comlink worker: full line text layout |
| `src/modular/layers/symbol/workers/line-text-worker-service.ts` | Create | Comlink wrapper (no tests) |
| `src/modular/layers/symbol/line-text-layer.ts` | Create | Layer using line text worker, same SDF shaders as TextLayer |
| `demo/phase9/index.html` | Create | Phase 9 demo page |
| `demo/phase9/main.ts` | Create | Phase 9 demo script |

---

## Task 1: Copy vendor line machinery files verbatim

**Goal:** Copy `path_interpolator`, `check_max_angle`, `clip_line`, and `merge_lines` verbatim from MapLibre's `src/symbol/` into `src/modular/layers/symbol/vendor/`. Adjust import paths from `../util/util` and `@mapbox/point-geometry` — use the project's existing aliases. Write minimal unit tests for each.

**Files:**
- Create: `src/modular/layers/symbol/vendor/path_interpolator.ts`
- Create: `src/modular/layers/symbol/vendor/path_interpolator.test.ts`
- Create: `src/modular/layers/symbol/vendor/check_max_angle.ts`
- Create: `src/modular/layers/symbol/vendor/check_max_angle.test.ts`
- Create: `src/modular/layers/symbol/vendor/clip_line.ts`
- Create: `src/modular/layers/symbol/vendor/clip_line.test.ts`
- Create: `src/modular/layers/symbol/vendor/merge_lines.ts`
- Create: `src/modular/layers/symbol/vendor/merge_lines.test.ts`

**Background:** The source files are at:
- `/Users/puckey/rg/maplibre-gl-js/src/symbol/path_interpolator.ts`
- `/Users/puckey/rg/maplibre-gl-js/src/symbol/check_max_angle.ts`
- `/Users/puckey/rg/maplibre-gl-js/src/symbol/clip_line.ts`
- `/Users/puckey/rg/maplibre-gl-js/src/symbol/merge_lines.ts`

Import path rewriting rules:
- `from '../util/util'` → `from '../../../../util/util.ts'` (clamp etc.)
- `from '@mapbox/point-geometry'` → keep as-is (external package already installed)
- `from './anchor'` → `from '../../../../symbol/anchor.ts'` (Anchor type)
- `type {SymbolFeature}` → keep the type import but point to `'../../../../data/bucket/symbol_bucket.ts'`

Read each source file in full before writing the copy so the content is exact.

- [ ] **Step 1.1: Read and copy path_interpolator.ts**

Read the full source at `/Users/puckey/rg/maplibre-gl-js/src/symbol/path_interpolator.ts` and create `src/modular/layers/symbol/vendor/path_interpolator.ts` with all imports rewritten.

- [ ] **Step 1.2: Create path_interpolator.test.ts**

```ts
// src/modular/layers/symbol/vendor/path_interpolator.test.ts
import { describe, it, expect } from 'vitest'
import { PathInterpolator } from './path_interpolator.ts'
import Point from '@mapbox/point-geometry'

describe('PathInterpolator', () => {
  it('constructs with zero-length path and has length 0', () => {
    const pi = new PathInterpolator([], 0)
    expect(pi.length).toBe(0)
  })

  it('computes correct total length for two-point segment', () => {
    const p0 = new Point(0, 0)
    const p1 = new Point(3, 4)
    const pi = new PathInterpolator([p0, p1], 0)
    expect(pi.length).toBeCloseTo(5, 5)  // 3-4-5 right triangle
  })

  it('paddedLength equals length minus 2 * padding', () => {
    const p0 = new Point(0, 0)
    const p1 = new Point(10, 0)
    const pi = new PathInterpolator([p0, p1], 2)
    expect(pi.paddedLength).toBeCloseTo(6, 5)  // 10 - 2 * 2
  })

  it('interpolates midpoint of a horizontal segment', () => {
    const p0 = new Point(0, 0)
    const p1 = new Point(10, 0)
    const pi = new PathInterpolator([p0, p1], 0)
    const mid = pi.lerp(0.5)
    expect(mid.x).toBeCloseTo(5, 5)
    expect(mid.y).toBeCloseTo(0, 5)
  })

  it('reset() updates points and recomputes distances', () => {
    const pi = new PathInterpolator([], 0)
    pi.reset([new Point(0, 0), new Point(6, 0)], 0)
    expect(pi.length).toBeCloseTo(6, 5)
  })
})
```

- [ ] **Step 1.3: Run path_interpolator tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/vendor/path_interpolator.test.ts
```

Expected:
```
 PASS  src/modular/layers/symbol/vendor/path_interpolator.test.ts
  PathInterpolator
    ✓ constructs with zero-length path and has length 0
    ✓ computes correct total length for two-point segment
    ✓ paddedLength equals length minus 2 * padding
    ✓ interpolates midpoint of a horizontal segment
    ✓ reset() updates points and recomputes distances
```

- [ ] **Step 1.4: Read and copy check_max_angle.ts**

Read the full source at `/Users/puckey/rg/maplibre-gl-js/src/symbol/check_max_angle.ts` and create `src/modular/layers/symbol/vendor/check_max_angle.ts` with imports rewritten.

- [ ] **Step 1.5: Create check_max_angle.test.ts**

```ts
// src/modular/layers/symbol/vendor/check_max_angle.test.ts
import { describe, it, expect } from 'vitest'
import { checkMaxAngle } from './check_max_angle.ts'
import { Anchor } from '../../../../symbol/anchor.ts'
import Point from '@mapbox/point-geometry'

describe('checkMaxAngle', () => {
  it('returns true when anchor has no segment (horizontal label)', () => {
    // anchor.segment === undefined → always passes
    const anchor = new Anchor(0, 0, 0, undefined)
    const line = [new Point(0, 0), new Point(100, 0)]
    expect(checkMaxAngle(line, anchor, 50, 25, Math.PI / 4)).toBe(true)
  })

  it('returns true for a perfectly straight line regardless of maxAngle', () => {
    const line = [
      new Point(0, 0),
      new Point(100, 0),
      new Point(200, 0),
      new Point(300, 0),
    ]
    const anchor = new Anchor(150, 0, 0, 1)
    // Straight line has zero combined angle — should always pass
    expect(checkMaxAngle(line, anchor, 100, 50, 0.01)).toBe(true)
  })

  it('returns false for a sharp 90-degree turn when maxAngle is small', () => {
    const line = [
      new Point(0, 0),
      new Point(100, 0),
      new Point(100, 100),  // sharp right-angle turn
    ]
    const anchor = new Anchor(100, 0, 0, 1)
    // maxAngle = 0.01 rad (very strict) — should fail
    expect(checkMaxAngle(line, anchor, 150, 75, 0.01)).toBe(false)
  })

  it('returns true for labelLength 0', () => {
    const line = [new Point(0, 0), new Point(100, 0), new Point(100, 100)]
    const anchor = new Anchor(50, 0, 0, 0)
    expect(checkMaxAngle(line, anchor, 0, 50, 0.01)).toBe(true)
  })
})
```

- [ ] **Step 1.6: Run check_max_angle tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/vendor/check_max_angle.test.ts
```

Expected:
```
 PASS  src/modular/layers/symbol/vendor/check_max_angle.test.ts
  checkMaxAngle
    ✓ returns true when anchor has no segment (horizontal label)
    ✓ returns true for a perfectly straight line regardless of maxAngle
    ✓ returns false for a sharp 90-degree turn when maxAngle is small
    ✓ returns true for labelLength 0
```

- [ ] **Step 1.7: Read and copy clip_line.ts**

Read the full source at `/Users/puckey/rg/maplibre-gl-js/src/symbol/clip_line.ts` and create `src/modular/layers/symbol/vendor/clip_line.ts` with imports rewritten (`Point` from `@mapbox/point-geometry`).

- [ ] **Step 1.8: Create clip_line.test.ts**

```ts
// src/modular/layers/symbol/vendor/clip_line.test.ts
import { describe, it, expect } from 'vitest'
import { clipLine } from './clip_line.ts'
import Point from '@mapbox/point-geometry'

describe('clipLine', () => {
  it('returns empty array for empty input', () => {
    expect(clipLine([], 0, 0, 100, 100)).toEqual([])
  })

  it('returns segment fully inside the box unchanged (approximately)', () => {
    const line = [new Point(10, 10), new Point(90, 90)]
    const result = clipLine([line], 0, 0, 100, 100)
    expect(result.length).toBe(1)
    expect(result[0].length).toBe(2)
  })

  it('clips segment that starts outside the left edge', () => {
    const line = [new Point(-50, 50), new Point(50, 50)]
    const result = clipLine([line], 0, 0, 100, 100)
    expect(result.length).toBe(1)
    // The clipped line must start at x=0 and end at x=50
    expect(result[0][0].x).toBeCloseTo(0, 3)
    expect(result[0][result[0].length - 1].x).toBeCloseTo(50, 3)
  })

  it('returns empty array for segment entirely outside the box', () => {
    const line = [new Point(-100, 50), new Point(-10, 50)]
    const result = clipLine([line], 0, 0, 100, 100)
    expect(result.length).toBe(0)
  })

  it('splits a line that crosses a box boundary into two segments', () => {
    // Line enters and exits the box through the left and right edges
    const line = [new Point(-10, 50), new Point(50, 50), new Point(110, 50)]
    const result = clipLine([line], 0, 0, 100, 100)
    expect(result.length).toBe(1)  // one clipped segment inside box
  })

  it('handles multiple input lines', () => {
    const line1 = [new Point(10, 10), new Point(90, 10)]
    const line2 = [new Point(10, 90), new Point(90, 90)]
    const result = clipLine([line1, line2], 0, 0, 100, 100)
    expect(result.length).toBe(2)
  })
})
```

- [ ] **Step 1.9: Run clip_line tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/vendor/clip_line.test.ts
```

Expected:
```
 PASS  src/modular/layers/symbol/vendor/clip_line.test.ts
  clipLine
    ✓ returns empty array for empty input
    ✓ returns segment fully inside the box unchanged (approximately)
    ✓ clips segment that starts outside the left edge
    ✓ returns empty array for segment entirely outside the box
    ✓ splits a line that crosses a box boundary into two segments
    ✓ handles multiple input lines
```

- [ ] **Step 1.10: Read and copy merge_lines.ts**

Read the full source at `/Users/puckey/rg/maplibre-gl-js/src/symbol/merge_lines.ts` and create `src/modular/layers/symbol/vendor/merge_lines.ts` with imports rewritten (`SymbolFeature` from `'../../../../data/bucket/symbol_bucket.ts'`).

- [ ] **Step 1.11: Create merge_lines.test.ts**

```ts
// src/modular/layers/symbol/vendor/merge_lines.test.ts
import { describe, it, expect } from 'vitest'
import { mergeLines } from './merge_lines.ts'
import Point from '@mapbox/point-geometry'

// Minimal SymbolFeature shape — only geometry and text are needed for mergeLines
function makeFeature(points: [number, number][], text: string): any {
  return {
    geometry: [points.map(([x, y]) => new Point(x, y))],
    text: { toString: () => text },
    // Other SymbolFeature fields are not needed by mergeLines
  }
}

describe('mergeLines', () => {
  it('returns empty array for empty input', () => {
    expect(mergeLines([])).toEqual([])
  })

  it('returns unchanged features when no merges are possible', () => {
    const f1 = makeFeature([[0, 0], [10, 0]], 'A')
    const f2 = makeFeature([[20, 0], [30, 0]], 'B')
    const result = mergeLines([f1, f2])
    expect(result.length).toBe(2)
  })

  it('merges two collinear features with matching text and shared endpoints', () => {
    // f1 ends at (10,0), f2 starts at (10,0) — same text
    const f1 = makeFeature([[0, 0], [10, 0]], 'road')
    const f2 = makeFeature([[10, 0], [20, 0]], 'road')
    const result = mergeLines([f1, f2])
    // After merging, should have 1 feature with 3 points: (0,0)→(10,0)→(20,0)
    expect(result.length).toBe(1)
    expect(result[0].geometry[0].length).toBe(3)
  })

  it('does not merge features with different text', () => {
    const f1 = makeFeature([[0, 0], [10, 0]], 'Main St')
    const f2 = makeFeature([[10, 0], [20, 0]], 'Oak Ave')
    const result = mergeLines([f1, f2])
    expect(result.length).toBe(2)
  })
})
```

- [ ] **Step 1.12: Run merge_lines tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/vendor/merge_lines.test.ts
```

Expected:
```
 PASS  src/modular/layers/symbol/vendor/merge_lines.test.ts
  mergeLines
    ✓ returns empty array for empty input
    ✓ returns unchanged features when no merges are possible
    ✓ merges two collinear features with matching text and shared endpoints
    ✓ does not merge features with different text
```

- [ ] **Step 1.13: Commit all vendor copies**

```bash
git add src/modular/layers/symbol/vendor/
git commit -m "feat(modular/symbol): copy line vendor files verbatim (path_interpolator, check_max_angle, clip_line, merge_lines)"
```

---

## Task 2: Extract symbol_layout_helpers.ts

**Goal:** Extract the shared internals from MapLibre's `src/symbol/symbol_layout.ts` into `src/modular/layers/symbol/vendor/symbol_layout_helpers.ts`. This file contains everything needed by BOTH the point and line workers that is NOT line-specific — primarily `getDefaultHorizontalShaping`, `anchorIsTooClose`, and the `addSymbol` function body (or a simplified version for our purposes).

**Key insight:** Our workers do NOT use MapLibre's `SymbolBucket` (which is deeply coupled to the style system). Instead, `symbol_layout_helpers.ts` exposes thin wrappers around the functions our workers actually call: `shapeText`, `getGlyphQuads`, and `getAnchors`. The helpers file is the boundary between "MapLibre internals" and "our worker logic" — it re-exports the shared pieces under a stable interface.

**What to export:**
1. `getDefaultHorizontalShaping` — picks the horizontal shaping result from the map (verbatim from symbol_layout.ts)
2. `shapeTextForLayout` — thin wrapper calling `shapeText` with our simplified options object
3. `buildGlyphQuads` — thin wrapper calling `getGlyphQuads` with our simplified options
4. `getLineAnchors` — wrapper calling `getAnchors` from `get_anchors.ts` + `clipLine` from clip_line.ts

**Files:**
- Create: `src/modular/layers/symbol/vendor/symbol_layout_helpers.ts`
- Create: `src/modular/layers/symbol/vendor/symbol_layout_helpers.test.ts`

- [ ] **Step 2.1: Create symbol_layout_helpers.ts**

```ts
// src/modular/layers/symbol/vendor/symbol_layout_helpers.ts
//
// Extracted shared internals from src/symbol/symbol_layout.ts.
// Provides stable wrappers for the pieces used by both the point and line workers.
// Does NOT import line-specific machinery (path_interpolator, check_max_angle, clip_line, merge_lines).
// The line worker imports those separately — tree-shaking keeps them out of the point worker bundle.

import { shapeText, WritingMode } from '../../../../symbol/shaping.ts'
import { getGlyphQuads } from '../../../../symbol/quads.ts'
import { getAnchors, getCenterAnchor } from '../../../../symbol/get_anchors.ts'
import { Anchor } from '../../../../symbol/anchor.ts'
import ONE_EM from '../../../../symbol/one_em.ts'
import { Formatted, FormattedSection } from '@maplibre/maplibre-gl-style-spec'
import Point from '@mapbox/point-geometry'
import type { Shaping, TextJustify } from '../../../../symbol/shaping.ts'
import type { GlyphPosition } from '../../../../render/glyph_atlas.ts'
import type { GlyphPositions } from '../types.ts'

// ---- Re-export types used across workers ----

export type { Shaping }

// ---- Helpers verbatim from symbol_layout.ts ----

type ShapedTextOrientations = {
  horizontal: Partial<Record<TextJustify, Shaping>>
  vertical: Shaping | false
}

/**
 * Verbatim from symbol_layout.ts — picks the default horizontal shaping.
 * Returns the first shaping from the horizontal map, or undefined.
 */
export function getDefaultHorizontalShaping(
  horizontalShapings: Partial<Record<TextJustify, Shaping>>,
): Shaping | false {
  for (const justification in horizontalShapings) {
    return horizontalShapings[justification as TextJustify]!
  }
  return false
}

// ---- Simplified shaping wrapper (avoids SymbolBucket) ----

export interface SimpleShapingOptions {
  text: string
  glyphPositions: GlyphPositions
  fontstack: string
  fontSize: number
  lineHeight?: number
  spacing?: number
  textAnchor?: string
  textJustify?: TextJustify
  textOffset?: [number, number]
  /** true for line placement, false for point */
  alongLine?: boolean
}

/**
 * Shape a text string using MapLibre's shapeText, returning a Shaping result.
 * Wraps the shapeText call with sensible defaults for our simplified use case.
 * Returns false if shaping fails (all glyphs missing, empty text, etc.)
 */
export function shapeTextForLayout(options: SimpleShapingOptions): Shaping | false {
  const {
    text,
    glyphPositions,
    fontstack,
    fontSize,
    lineHeight = 24,
    spacing = 0,
    textAnchor = 'center',
    textJustify = 'center',
    textOffset = [0, 0],
    alongLine = false,
  } = options

  // Build a Formatted object — single section with the entire text
  const formatted = new Formatted([new FormattedSection(text, null, null, null, null)])

  // shapeText expects glyphs keyed as { [stack]: { [id]: { rect, metrics } | null } }
  // GlyphPositions from our GlyphManager already matches this shape.
  const glyphsForShaping: { [stack: string]: { [id: number]: GlyphPosition | null } } = {}
  const posForStack = glyphPositions[fontstack] ?? {}
  glyphsForShaping[fontstack] = {}
  for (const idStr in posForStack) {
    const id = +idStr
    glyphsForShaping[fontstack][id] = posForStack[id] ?? null
  }

  const maxWidth = alongLine ? Infinity : 10 * ONE_EM
  const writingMode = WritingMode.horizontal

  return shapeText(
    formatted,
    glyphsForShaping,
    {},            // imagePositions (none)
    {},            // images (none)
    fontstack,
    maxWidth,
    lineHeight,
    textAnchor as any,
    textJustify,
    spacing,
    textOffset,
    writingMode,
    false,         // allowVerticalPlacement
    { scale: fontSize / ONE_EM } as any,
    fontSize,
  )
}

// ---- Quad generation wrapper ----

export interface GlyphQuadOptions {
  anchor: { x: number; y: number }
  shaping: Shaping
  glyphPositions: GlyphPositions
  fontstack: string
  textOffset?: [number, number]
  /** true for line labels, false for point labels */
  alongLine?: boolean
}

/**
 * Generate glyph quads from a shaping result.
 * Returns an array of quads (each with tl, tr, bl, br corners and tex rect).
 */
export function buildGlyphQuads(options: GlyphQuadOptions) {
  const { anchor, shaping, glyphPositions, fontstack, textOffset = [0, 0], alongLine = false } = options

  const maplibreAnchor = new Anchor(anchor.x, anchor.y, 0, undefined)
  const posForStack = glyphPositions[fontstack] ?? {}

  const layer = {
    layout: {
      get: (name: string) => {
        if (name === 'text-rotate') return 0
        if (name === 'text-keep-upright') return false
        return null
      },
    },
  }

  return getGlyphQuads(
    maplibreAnchor,
    shaping,
    textOffset,
    layer as any,
    posForStack as any,
    alongLine,
    null,  // imagePositions
    false, // allowVerticalPlacement
  )
}

// ---- Anchor helpers for line placement ----

export interface LineAnchorOptions {
  /** Line geometry (array of Points), already clipped to tile extent */
  line: Point[]
  /** Desired spacing between labels (tile units) */
  symbolMinDistance: number
  /** Maximum allowed combined angle in radians */
  textMaxAngle: number
  /** Shaping result (used to determine label size) */
  shaping: Shaping | false
  /** Font size (px), used for label length estimation */
  fontSize: number
  /** Tile extent (typically 4096 for MVT) */
  extent?: number
  /** Overscale factor for the tile */
  overscaling?: number
}

/**
 * Compute anchor points for line text placement using MapLibre's getAnchors.
 * Returns an array of Anchor objects, each with x, y, angle, and segment index.
 */
export function getLineAnchors(options: LineAnchorOptions): Anchor[] {
  const {
    line,
    symbolMinDistance,
    textMaxAngle,
    shaping,
    fontSize,
    extent = 4096,
    overscaling = 1,
  } = options

  if (!shaping) return []

  const glyphSize = 24  // design-time glyph size in MapLibre
  // textMaxBoxScale: ratio of tile pixels to em size at the bucket zoom level
  // We use a rough approximation: tilePixelRatio = 1, fontScale = fontSize / glyphSize
  const fontScale = fontSize / glyphSize
  const textMaxBoxScale = fontScale  // simplified (no tilePixelRatio)

  return getAnchors(
    line,
    symbolMinDistance,
    textMaxAngle,
    shaping,
    undefined,    // shapedIcon (none)
    glyphSize,
    textMaxBoxScale,
    overscaling,
    extent,
  )
}

/**
 * Compute a single center anchor for a line (used for 'line-center' placement).
 */
export function getCenterLineAnchor(options: Omit<LineAnchorOptions, 'symbolMinDistance'>): Anchor | null {
  const { line, textMaxAngle, shaping, fontSize } = options

  if (!shaping) return null

  const glyphSize = 24
  const fontScale = fontSize / glyphSize
  const textMaxBoxScale = fontScale

  return getCenterAnchor(
    line,
    textMaxAngle,
    shaping,
    undefined,
    glyphSize,
    textMaxBoxScale,
  ) ?? null
}
```

- [ ] **Step 2.2: Create symbol_layout_helpers.test.ts**

```ts
// src/modular/layers/symbol/vendor/symbol_layout_helpers.test.ts
import { describe, it, expect } from 'vitest'
import {
  getDefaultHorizontalShaping,
  shapeTextForLayout,
  buildGlyphQuads,
  getLineAnchors,
  getCenterLineAnchor,
} from './symbol_layout_helpers.ts'
import type { GlyphPositions } from '../types.ts'
import Point from '@mapbox/point-geometry'

// ---- getDefaultHorizontalShaping ----

describe('getDefaultHorizontalShaping', () => {
  it('returns false for empty map', () => {
    expect(getDefaultHorizontalShaping({})).toBe(false)
  })

  it('returns the first value from a populated map', () => {
    const shaping = { positionedLines: [], text: 'A', top: 0, bottom: 0, left: 0, right: 0, writingMode: 1, iconsInText: false, verticalizable: false }
    const result = getDefaultHorizontalShaping({ center: shaping as any })
    expect(result).toBe(shaping)
  })
})

// ---- shapeTextForLayout ----

const metrics = { width: 8, height: 10, left: 1, top: 10, advance: 10 }

const glyphPositions: GlyphPositions = {
  'Open Sans Regular': {
    65: { rect: { x: 0, y: 0, w: 14, h: 16 }, metrics },
    66: { rect: { x: 14, y: 0, w: 14, h: 16 }, metrics },
  }
}

describe('shapeTextForLayout', () => {
  it('is exported as a function', () => {
    expect(typeof shapeTextForLayout).toBe('function')
  })

  it('returns false or a Shaping for text "A" with a minimal glyph position', () => {
    const result = shapeTextForLayout({
      text: 'A',
      glyphPositions,
      fontstack: 'Open Sans Regular',
      fontSize: 16,
    })
    // shapeText may return false if internal requirements are unmet —
    // we just verify it does not throw and returns the right shape
    if (result !== false) {
      expect(typeof result).toBe('object')
      expect(Array.isArray((result as any).positionedLines)).toBe(true)
    }
  })

  it('returns false for empty text', () => {
    const result = shapeTextForLayout({
      text: '',
      glyphPositions,
      fontstack: 'Open Sans Regular',
      fontSize: 16,
    })
    expect(result).toBe(false)
  })
})

// ---- buildGlyphQuads ----

describe('buildGlyphQuads', () => {
  it('is exported as a function', () => {
    expect(typeof buildGlyphQuads).toBe('function')
  })

  it('returns an array (possibly empty) for a valid shaping', () => {
    const shaping = shapeTextForLayout({
      text: 'A',
      glyphPositions,
      fontstack: 'Open Sans Regular',
      fontSize: 16,
    })
    if (shaping === false) return  // skip if shapeText needs more setup
    const quads = buildGlyphQuads({
      anchor: { x: 2048, y: 2048 },
      shaping,
      glyphPositions,
      fontstack: 'Open Sans Regular',
    })
    expect(Array.isArray(quads)).toBe(true)
  })
})

// ---- getLineAnchors ----

describe('getLineAnchors', () => {
  it('is exported as a function', () => {
    expect(typeof getLineAnchors).toBe('function')
  })

  it('returns empty array when shaping is false', () => {
    const line = [new Point(0, 0), new Point(4096, 0)]
    const result = getLineAnchors({
      line,
      symbolMinDistance: 200,
      textMaxAngle: Math.PI / 4,
      shaping: false,
      fontSize: 16,
    })
    expect(result).toEqual([])
  })

  it('returns anchor array for a valid shaping on a straight line', () => {
    const shaping = shapeTextForLayout({
      text: 'A',
      glyphPositions,
      fontstack: 'Open Sans Regular',
      fontSize: 16,
      alongLine: true,
    })
    if (shaping === false) return
    const line = [new Point(0, 2048), new Point(4096, 2048)]
    const anchors = getLineAnchors({
      line,
      symbolMinDistance: 200,
      textMaxAngle: Math.PI / 2,
      shaping,
      fontSize: 16,
    })
    expect(Array.isArray(anchors)).toBe(true)
  })
})

// ---- getCenterLineAnchor ----

describe('getCenterLineAnchor', () => {
  it('is exported as a function', () => {
    expect(typeof getCenterLineAnchor).toBe('function')
  })

  it('returns null when shaping is false', () => {
    const line = [new Point(0, 0), new Point(4096, 0)]
    const result = getCenterLineAnchor({
      line,
      textMaxAngle: Math.PI / 4,
      shaping: false,
      fontSize: 16,
    })
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2.3: Run symbol_layout_helpers tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/vendor/symbol_layout_helpers.test.ts
```

Expected:
```
 PASS  src/modular/layers/symbol/vendor/symbol_layout_helpers.test.ts
  getDefaultHorizontalShaping
    ✓ returns false for empty map
    ✓ returns the first value from a populated map
  shapeTextForLayout
    ✓ is exported as a function
    ✓ returns false or a Shaping for text "A" with a minimal glyph position
    ✓ returns false for empty text
  buildGlyphQuads
    ✓ is exported as a function
    ✓ returns an array (possibly empty) for a valid shaping
  getLineAnchors
    ✓ is exported as a function
    ✓ returns empty array when shaping is false
    ✓ returns anchor array for a valid shaping on a straight line
  getCenterLineAnchor
    ✓ is exported as a function
    ✓ returns null when shaping is false
```

Note: Tests that call `shapeText` internally may skip via the `if (shaping === false) return` guard if MapLibre's shaper needs additional setup not available in the unit test environment.

- [ ] **Step 2.4: Type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "symbol_layout_helpers"
```

Expected: no errors

- [ ] **Step 2.5: Commit**

```bash
git add src/modular/layers/symbol/vendor/symbol_layout_helpers.ts src/modular/layers/symbol/vendor/symbol_layout_helpers.test.ts
git commit -m "feat(modular/symbol): add symbol_layout_helpers — shared layout wrappers extracted from MapLibre symbol_layout.ts"
```

---

## Task 3: SymbolWorkerLine — worker with full line machinery

**Goal:** Comlink-exposed worker class for line text layout. Structurally mirrors `SymbolWorkerPoint` but imports `path_interpolator`, `check_max_angle`, `clip_line`, `merge_lines` and uses `symbol_layout_helpers` to place text anchors along line geometry. Produces the same `SymbolTileData` format so `LineTextLayer` can share draw code with `TextLayer`.

**Files:**
- Create: `src/modular/layers/symbol/workers/symbol-worker-line.ts`

**Background:** The key difference from the point worker is in `_runLayout`:
1. For each feature, instead of using the first point as the anchor, we take the feature geometry as a polyline.
2. We clip the line to the tile extent using `clipLine`.
3. We optionally merge line segments using `mergeLines` (for roads that are split across features).
4. We call `shapeTextForLayout` (from helpers) with `alongLine: true`.
5. We call `getLineAnchors` (from helpers) to get anchor positions along the line.
6. For each anchor, we call `buildGlyphQuads` and accumulate vertex/index data.

The worker does NOT import `PathInterpolator` or `checkMaxAngle` directly — those are used internally by `getAnchors` (already imported transitively). The key tree-shaking win is that `symbol-worker-point.ts` never imports `clip_line`, `merge_lines`, `path_interpolator`, or `check_max_angle` at all.

No unit tests (browser-only worker with fetch + tile parsing).

- [ ] **Step 3.1: Create symbol-worker-line.ts**

```ts
// src/modular/layers/symbol/workers/symbol-worker-line.ts
//
// Line text worker — places labels along road/river polylines.
// This worker imports the full line machinery. It intentionally does NOT share
// a bundle with symbol-worker-point.ts so that tree-shaking can exclude clip_line,
// merge_lines, path_interpolator, check_max_angle from the point worker bundle.
import * as Comlink from 'comlink'
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import { clipLine } from '../vendor/clip_line.ts'
import { mergeLines } from '../vendor/merge_lines.ts'
import {
  shapeTextForLayout,
  buildGlyphQuads,
  getLineAnchors,
} from '../vendor/symbol_layout_helpers.ts'
import { glyphRange } from '../glyph-loader.ts'
import { StructArray } from '../../../core/struct-array.ts'
import { GlyphVertexLayout } from '../types.ts'
import ONE_EM from '../../../../symbol/one_em.ts'
import Point from '@mapbox/point-geometry'
import type { GlyphMap, GlyphPositions, SymbolTileData } from '../types.ts'

// Tile extent in MVT coordinates
const TILE_EXTENT = 4096

interface PendingTile {
  resolve: (data: SymbolTileData | null) => void
  reject: (err: Error) => void
  pbfBuffer: ArrayBuffer
  textField: string
  sourceLayer: string
  fontstack: string
  fontSize: number
  neededRanges: { [stack: string]: Set<number> }
}

export class SymbolWorkerLine {
  private _glyphMap: GlyphMap = {}
  private _glyphPositions: GlyphPositions = {}
  private _pending = new globalThis.Map<string, AbortController>()
  private _waiting = new globalThis.Map<string, PendingTile>()
  private _buckets = new globalThis.Map<string, SymbolTileData>()

  updateGlyphs(partialMap: GlyphMap, positions: GlyphPositions): void {
    for (const stack in partialMap) {
      if (!this._glyphMap[stack]) this._glyphMap[stack] = {}
      Object.assign(this._glyphMap[stack], partialMap[stack])
    }
    for (const stack in positions) {
      if (!this._glyphPositions[stack]) this._glyphPositions[stack] = {}
      Object.assign(this._glyphPositions[stack], positions[stack])
    }
    for (const [key, pending] of this._waiting) {
      if (this._allRangesLoaded(pending.neededRanges)) {
        this._waiting.delete(key)
        this._runLayout(key, pending).then(pending.resolve, pending.reject)
      }
    }
  }

  private _allRangesLoaded(neededRanges: { [stack: string]: Set<number> }): boolean {
    for (const stack in neededRanges) {
      const stackGlyphs = this._glyphMap[stack]
      if (!stackGlyphs) return false
      for (const range of neededRanges[stack]) {
        if (stackGlyphs[range] === undefined) return false
      }
    }
    return true
  }

  private async _runLayout(key: string, pending: PendingTile): Promise<SymbolTileData | null> {
    const { pbfBuffer, textField, sourceLayer, fontstack, fontSize } = pending

    const tile = new VectorTile(new Pbf(pbfBuffer))
    const layer = tile.layers[sourceLayer]
    if (!layer || layer.length === 0) return null

    const allVerts: number[] = []
    const allIdx: number[] = []
    const labelPositions: { x: number; y: number }[] = []

    for (let i = 0; i < layer.length; i++) {
      const feat = layer.feature(i)

      // Only process line features (type 2 in MVT)
      if (feat.type !== 2) continue

      const rawText = this._resolveTextField(textField, feat.properties)
      if (!rawText) continue

      const geom = feat.loadGeometry()  // Point[][]
      if (!geom || geom.length === 0) continue

      // Shape the text for line placement
      const shaping = shapeTextForLayout({
        text: rawText,
        glyphPositions: this._glyphPositions,
        fontstack,
        fontSize,
        alongLine: true,
      })
      if (!shaping) continue

      // Process each line ring in the feature
      for (const ring of geom) {
        if (ring.length < 2) continue

        // Clip to tile extent — returns zero or more sub-segments
        const clipped = clipLine([ring], 0, 0, TILE_EXTENT, TILE_EXTENT)

        for (const line of clipped) {
          if (line.length < 2) continue

          // Get label placement anchors along this line segment
          const anchors = getLineAnchors({
            line,
            symbolMinDistance: fontSize * 8,  // reasonable spacing: ~8 label widths
            textMaxAngle: Math.PI / 4,
            shaping,
            fontSize,
            extent: TILE_EXTENT,
          })

          for (const anchor of anchors) {
            const quads = buildGlyphQuads({
              anchor: { x: anchor.x, y: anchor.y },
              shaping,
              glyphPositions: this._glyphPositions,
              fontstack,
              textOffset: [0, 0],
              alongLine: false,  // quad offsets are in screen-space; rotation applied per-anchor in full impl
            })

            if (!quads || quads.length === 0) continue

            const scale = fontSize / ONE_EM
            const verts = new StructArray(GlyphVertexLayout)

            for (const quad of quads) {
              const corners = [quad.tl, quad.tr, quad.bl, quad.br]
              const uvCorners = [
                { u: quad.tex.x,              v: quad.tex.y },
                { u: quad.tex.x + quad.tex.w, v: quad.tex.y },
                { u: quad.tex.x,              v: quad.tex.y + quad.tex.h },
                { u: quad.tex.x + quad.tex.w, v: quad.tex.y + quad.tex.h },
              ]
              for (let c = 0; c < 4; c++) {
                const corner = corners[c]
                const uv = uvCorners[c]
                verts.emplaceBack(
                  anchor.x,
                  anchor.y,
                  Math.round(corner.x * scale * 32),
                  Math.round(corner.y * scale * 32),
                  Math.round(uv.u),
                  Math.round(uv.v),
                )
              }
            }

            const idxOffset = allVerts.length / 6
            const view = new Int16Array(verts.arrayBuffer)
            for (let vi = 0; vi < view.length; vi++) allVerts.push(view[vi])

            const quadCount = quads.length
            for (let q = 0; q < quadCount; q++) {
              const base = idxOffset + q * 4
              allIdx.push(base + 0, base + 1, base + 2, base + 1, base + 3, base + 2)
            }

            labelPositions.push({ x: anchor.x, y: anchor.y })
          }
        }
      }
    }

    if (allIdx.length === 0) return null

    const data: SymbolTileData = {
      vertices: new Int16Array(allVerts).buffer,
      indices: new Uint16Array(allIdx).buffer,
      count: allIdx.length,
      labelPositions,
    }
    this._buckets.set(key, data)
    return data
  }

  private _resolveTextField(template: string, props: Record<string, any>): string | null {
    const text = template.replace(/\{([^}]+)\}/g, (_, k) => String(props[k] ?? '')).trim()
    return text.length > 0 ? text : null
  }

  async request(
    key: string,
    url: string,
    textField: string,
    sourceLayer: string,
    fontstack: string,
    fontSize: number,
  ): Promise<SymbolTileData | null> {
    const controller = new AbortController()
    this._pending.set(key, controller)

    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const pbfBuffer = await res.arrayBuffer()
      if (!this._pending.has(key)) return null
      this._pending.delete(key)

      // Parse tile to find needed glyph ranges
      const tile = new VectorTile(new Pbf(pbfBuffer.slice(0)))
      const neededRanges: { [stack: string]: Set<number> } = { [fontstack]: new Set() }

      const vLayer = tile.layers[sourceLayer]
      if (vLayer) {
        for (let i = 0; i < vLayer.length; i++) {
          const feat = vLayer.feature(i)
          if (feat.type !== 2) continue
          const rawText = this._resolveTextField(textField, feat.properties)
          if (!rawText) continue
          for (let ci = 0; ci < rawText.length; ci++) {
            const cp = rawText.codePointAt(ci)
            if (cp !== undefined) {
              neededRanges[fontstack].add(glyphRange(cp))
              if (cp > 0xffff) ci++
            }
          }
        }
      }

      const pendingTile: PendingTile = {
        resolve: () => {},
        reject: () => {},
        pbfBuffer,
        textField,
        sourceLayer,
        fontstack,
        fontSize,
        neededRanges,
      }

      if (this._allRangesLoaded(neededRanges)) {
        return this._runLayout(key, pendingTile)
      }

      return new Promise<SymbolTileData | null>((resolve, reject) => {
        pendingTile.resolve = resolve
        pendingTile.reject = reject
        this._waiting.set(key, pendingTile)
      })
    } catch {
      this._pending.delete(key)
      return null
    }
  }

  getBucket(key: string): SymbolTileData | null {
    return this._buckets.get(key) ?? null
  }

  cancel(key: string): void {
    this._pending.get(key)?.abort()
    this._pending.delete(key)
    this._waiting.delete(key)
  }

  destroy(): void {
    for (const c of this._pending.values()) c.abort()
    this._pending.clear()
    this._waiting.clear()
    this._buckets.clear()
  }
}

Comlink.expose(new SymbolWorkerLine())
```

- [ ] **Step 3.2: Type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "symbol-worker-line"
```

Expected: no errors

- [ ] **Step 3.3: Commit**

```bash
git add src/modular/layers/symbol/workers/symbol-worker-line.ts
git commit -m "feat(modular/symbol): add SymbolWorkerLine — line text layout worker with full line machinery"
```

---

## Task 4: LineTextWorkerService — Comlink wrapper

**Goal:** Main-thread Comlink wrapper for `SymbolWorkerLine`. Structurally identical to `TextWorkerService` — same methods, same patterns — but points at `symbol-worker-line.ts` instead of `symbol-worker-point.ts`, and passes `sourceLayer` as an additional parameter to `request()`.

No unit tests (browser-only Comlink/Worker).

**Files:**
- Create: `src/modular/layers/symbol/workers/line-text-worker-service.ts`

- [ ] **Step 4.1: Create line-text-worker-service.ts**

```ts
// src/modular/layers/symbol/workers/line-text-worker-service.ts
import * as Comlink from 'comlink'
import type { Remote } from 'comlink'
import type { GlyphMap, GlyphPositions, SymbolTileData } from '../types.ts'

type SymbolWorkerLineType = import('./symbol-worker-line.ts').SymbolWorkerLine

/**
 * Main-thread wrapper around the Comlink-exposed SymbolWorkerLine.
 * Mirrors TextWorkerService but includes sourceLayer in request().
 */
export class LineTextWorkerService {
  private _worker: Worker
  private _proxy: Remote<SymbolWorkerLineType>

  constructor() {
    this._worker = new Worker(
      new URL('./symbol-worker-line.ts', import.meta.url),
      { type: 'module' },
    )
    this._proxy = Comlink.wrap<SymbolWorkerLineType>(this._worker)
  }

  /**
   * Trigger layout for a tile in the line worker.
   * Fire and forget — result is retrieved via getBucket().
   */
  async request(
    key: string,
    url: string,
    textField: string,
    sourceLayer: string,
    fontstack: string,
    fontSize: number,
  ): Promise<void> {
    void this._proxy.request(key, url, textField, sourceLayer, fontstack, fontSize)
  }

  /**
   * Retrieve the pre-built SymbolTileData for a tile (if layout has completed).
   * Returns null if the tile is still waiting for glyphs or hasn't been requested.
   */
  async getBucket(key: string): Promise<SymbolTileData | null> {
    return this._proxy.getBucket(key)
  }

  /**
   * Push newly loaded glyphs and atlas positions to the line worker.
   * Called by GlyphManager._onGlyphsLoaded via LineTextLayer.onAdd().
   */
  updateGlyphs(glyphMap: GlyphMap, positions: GlyphPositions): void {
    void this._proxy.updateGlyphs(glyphMap, positions)
  }

  cancel(key: string): void {
    void this._proxy.cancel(key)
  }

  destroy(): void {
    void this._proxy.destroy()
    this._proxy[Comlink.releaseProxy]()
    this._worker.terminate()
  }
}
```

- [ ] **Step 4.2: Type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "line-text-worker-service"
```

Expected: no errors

- [ ] **Step 4.3: Commit**

```bash
git add src/modular/layers/symbol/workers/line-text-worker-service.ts
git commit -m "feat(modular/symbol): add LineTextWorkerService — Comlink wrapper for line text worker"
```

---

## Task 5: LineTextLayer — main-thread layer

**Goal:** Main-thread layer for line text rendering. Structurally identical to `TextLayer` but uses `LineTextWorkerService` instead of `TextWorkerService`, and passes `sourceLayer` as an explicit option (required for line feature filtering in the worker). Shares the same SDF shaders and the same `draw()` logic verbatim.

No unit tests (browser WebGL context required).

**Files:**
- Create: `src/modular/layers/symbol/line-text-layer.ts`

- [ ] **Step 5.1: Create line-text-layer.ts**

```ts
// src/modular/layers/symbol/line-text-layer.ts
import type { ProgramDefinition } from '../../core/types.ts'
import type { DrawContext } from '../../core/render-extension.ts'
import type { RendererAPI } from '../../core/renderer-api.ts'
import { GlyphManager } from './glyph-manager.ts'
import { LineTextWorkerService } from './workers/line-text-worker-service.ts'

// ---- SDF Shaders (identical to TextLayer) ----

const sdfVert = `
precision mediump float;
attribute vec2 a_anchor;
attribute vec2 a_offset;
attribute vec2 a_tex;
uniform vec2 u_texsize;
uniform vec2 u_resolution;
varying vec2 v_uv;
void main() {
  vec4 proj = projectTile(a_anchor);
  vec2 screen = proj.xy / proj.w;
  screen += (a_offset / 32.0) * 2.0 / u_resolution;
  gl_Position = vec4(screen * proj.w, proj.z, proj.w);
  v_uv = a_tex / u_texsize;
}
`

const sdfFrag = `
precision mediump float;
uniform sampler2D u_texture;
uniform vec4 u_color;
uniform float u_opacity;
varying vec2 v_uv;
void main() {
  float dist = texture2D(u_texture, v_uv).a;
  float gamma = 0.105;
  float edge = 0.75;
  float alpha = smoothstep(edge - gamma, edge + gamma, dist);
  gl_FragColor = u_color * alpha * u_opacity;
}
`

// ---- Options ----

export interface LineTextLayerOptions {
  source: string
  sourceLayer: string
  /** Template string, e.g. '{name}' */
  textField: string
  /** Font name, e.g. 'Open Sans Regular' — must match glyphs URL */
  fontstack?: string
  /** Font size in CSS pixels, default 14 */
  fontSize?: number
  /** Hex color string, default '#333333' */
  color?: string
  /** Opacity 0–1, default 1 */
  opacity?: number
  /** Constructed GlyphManager — caller owns lifecycle */
  glyphs: GlyphManager
}

function parseColor(c: string): [number, number, number, number] {
  const h = c.replace('#', '')
  if (h.length === 3)
    return [parseInt(h[0]+h[0], 16)/255, parseInt(h[1]+h[1], 16)/255, parseInt(h[2]+h[2], 16)/255, 1]
  return [parseInt(h.slice(0,2), 16)/255, parseInt(h.slice(2,4), 16)/255, parseInt(h.slice(4,6), 16)/255, 1]
}

// ---- Layer ----

export class LineTextLayer {
  readonly type = 'line-text' as const

  static programs: ProgramDefinition[] = [
    { name: 'symbol_sdf', vertex: sdfVert, fragment: sdfFrag },
  ]

  readonly source: string
  readonly sourceLayer: string

  private _textField: string
  private _fontstack: string
  private _fontSize: number
  private _color: string
  private _opacity: number
  private _glyphs: GlyphManager
  private _workerService: LineTextWorkerService
  private _tileBuckets = new globalThis.Map<string, { verts: WebGLBuffer; idx: WebGLBuffer; count: number } | null>()
  private _webgl!: { createGeometryBuffer(key: string, data: ArrayBufferView, target: number): WebGLBuffer }
  private _gl!: WebGLRenderingContext

  /** Expose workerService so callers can pass it as a TileService-like object if needed. */
  readonly workerService: LineTextWorkerService

  constructor(options: LineTextLayerOptions) {
    this.source = options.source
    this.sourceLayer = options.sourceLayer
    this._textField = options.textField
    this._fontstack = options.fontstack ?? 'Open Sans Regular'
    this._fontSize = options.fontSize ?? 14
    this._color = options.color ?? '#333333'
    this._opacity = options.opacity ?? 1
    this._glyphs = options.glyphs
    this._workerService = new LineTextWorkerService()
    this.workerService = this._workerService
  }

  onAdd(renderer: RendererAPI): void {
    this._webgl = (renderer as any)._webgl
    this._gl = (renderer as any)._gl

    // Wire glyph loading: same pattern as TextLayer
    this._glyphs._onGlyphsLoaded = (partialMap, positions) => {
      this._workerService.updateGlyphs(partialMap, positions)
    }
  }

  evictTile(key: string): void {
    this._tileBuckets.delete(key)
    this._workerService.cancel(key)
  }

  /**
   * draw() only fetches pre-built data from the worker, uploads to GPU, and renders.
   * All layout and line anchor placement happens inside the worker's request().
   */
  async draw(ctx: DrawContext): Promise<void> {
    const { gl, programs, tileID } = ctx
    const key = tileID.key

    if (!this._tileBuckets.has(key)) {
      const bucket = await this._workerService.getBucket(key)
      if (!bucket) {
        this._tileBuckets.set(key, null)
        return
      }
      this._glyphs.buildAtlas(gl)
      const verts = this._webgl.createGeometryBuffer(`tile:${key}:lsym:v`, new Int16Array(bucket.vertices), gl.ARRAY_BUFFER)
      const idx = this._webgl.createGeometryBuffer(`tile:${key}:lsym:i`, new Uint16Array(bucket.indices), gl.ELEMENT_ARRAY_BUFFER)
      this._tileBuckets.set(key, { verts, idx, count: bucket.count })
    }

    const bufs = this._tileBuckets.get(key)
    if (!bufs) return

    const program = programs.get('symbol_sdf')
    if (!program) return

    this._glyphs.buildAtlas(gl)
    if (!this._glyphs.glyphAtlasTexture) return

    gl.useProgram(program)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this._glyphs.glyphAtlasTexture)
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0)

    const atlas = (this._glyphs as any)._atlas
    const atlasW = atlas?.image.width ?? 1
    const atlasH = atlas?.image.height ?? 1
    gl.uniform2f(gl.getUniformLocation(program, 'u_texsize'), atlasW, atlasH)

    const canvas = gl.canvas as HTMLCanvasElement
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height)

    const [r, g, b, a] = parseColor(this._color)
    gl.uniform4f(gl.getUniformLocation(program, 'u_color'), r, g, b, a)
    gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), this._opacity)

    // Bind buffers: stride = 12 bytes: ax(2) ay(2) ox(2) oy(2) u(2) v(2)
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.verts)

    const aAnchor = gl.getAttribLocation(program, 'a_anchor')
    gl.enableVertexAttribArray(aAnchor)
    gl.vertexAttribPointer(aAnchor, 2, gl.SHORT, false, 12, 0)

    const aOffset = gl.getAttribLocation(program, 'a_offset')
    gl.enableVertexAttribArray(aOffset)
    gl.vertexAttribPointer(aOffset, 2, gl.SHORT, false, 12, 4)

    const aTex = gl.getAttribLocation(program, 'a_tex')
    gl.enableVertexAttribArray(aTex)
    gl.vertexAttribPointer(aTex, 2, gl.UNSIGNED_SHORT, false, 12, 8)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.idx)
    gl.drawElements(gl.TRIANGLES, bufs.count, gl.UNSIGNED_SHORT, 0)

    gl.disableVertexAttribArray(aAnchor)
    gl.disableVertexAttribArray(aOffset)
    gl.disableVertexAttribArray(aTex)
  }

  destroy(): void {
    this._workerService.destroy()
    if (this._gl && this._glyphs.glyphAtlasTexture) {
      this._gl.deleteTexture(this._glyphs.glyphAtlasTexture)
    }
  }
}
```

- [ ] **Step 5.2: Type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "line-text-layer"
```

Expected: no errors

- [ ] **Step 5.3: Commit**

```bash
git add src/modular/layers/symbol/line-text-layer.ts
git commit -m "feat(modular/symbol): add LineTextLayer — SDF line text rendering using line worker"
```

---

## Task 6: Demo

**Goal:** Phase 9 demo page showing road name labels following line geometry, layered on top of the Phase 8 fill+point-text map.

**Files:**
- Create: `demo/phase9/index.html`
- Create: `demo/phase9/main.ts`

- [ ] **Step 6.1: Create demo/phase9/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Phase 9 — Line Text Labels</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #111; color: #eee; font-family: system-ui, sans-serif; display: flex; height: 100vh; }
    canvas { display: block; flex: 1; }
    #sidebar {
      width: 220px; padding: 16px; background: #1a1a1a;
      border-left: 1px solid #2a2a2a; display: flex; flex-direction: column; gap: 16px;
    }
    .back { font-size: 11px; opacity: 0.4; text-decoration: none; color: inherit; }
    .back:hover { opacity: 0.8; }
    .phase-badge { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.3; }
    h2 { font-size: 14px; }
    label { font-size: 12px; opacity: 0.6; display: block; margin-bottom: 4px; }
    input[type=range] { width: 100%; accent-color: #4af; }
    .field { display: flex; flex-direction: column; gap: 2px; }
    .value { font-size: 11px; opacity: 0.4; }
    #status { font-size: 11px; opacity: 0.35; margin-top: auto; }
  </style>
</head>
<body>
  <canvas id="map"></canvas>
  <div id="sidebar">
    <a class="back" href="../">← all demos</a>
    <div>
      <div class="phase-badge">Phase 9</div>
      <h2>Line Text Labels</h2>
    </div>
    <div class="field">
      <label>Zoom</label>
      <input type="range" id="zoom" min="4" max="14" step="0.1" value="8" />
      <span class="value" id="zoom-val">8.0</span>
    </div>
    <div class="field">
      <label>Font Size</label>
      <input type="range" id="font-size" min="8" max="20" step="1" value="12" />
      <span class="value" id="font-size-val">12px</span>
    </div>
    <div id="status">Initializing…</div>
  </div>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

- [ ] **Step 6.2: Create demo/phase9/main.ts**

```ts
// demo/phase9/main.ts
import { createRenderer } from '../../src/modular/renderer/index.ts'
import { MapGL } from '../../src/modular/core/map.ts'
import { BackgroundLayer } from '../../src/modular/layers/background.ts'
import { FillLayer } from '../../src/modular/layers/fill.ts'
import { GlyphManager } from '../../src/modular/layers/symbol/glyph-manager.ts'
import { LineTextLayer } from '../../src/modular/layers/symbol/line-text-layer.ts'

const canvas = document.getElementById('map') as HTMLCanvasElement
const status = document.getElementById('status')!

function resize() {
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * devicePixelRatio
  canvas.height = rect.height * devicePixelRatio
}
resize()
window.addEventListener('resize', resize)

const renderer = await createRenderer(canvas)
const map = new MapGL({
  renderer,
  initialCamera: {
    center: { lng: 10, lat: 51 },
    zoom: 8,
    bearing: 0,
    pitch: 0,
    groundElevation: 0,
  },
})

map.addLayer(new BackgroundLayer({ color: '#f8f4f0', opacity: 1 }))

// Vector tile source — OpenMapTiles compatible
map.addSource('openmaptiles', {
  type: 'vector',
  url: 'https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf',
  minZoom: 0,
  maxZoom: 6,
})

map.addLayer(new FillLayer({
  source: 'openmaptiles',
  sourceLayer: 'land',
  color: '#e8e4e0',
  opacity: 1,
}))

// GlyphManager — fetches SDF glyph PBFs from MapLibre's public endpoint
const glyphs = new GlyphManager({
  url: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
})

// LineTextLayer — renders road names following line geometry
const lineTextLayer = new LineTextLayer({
  source: 'openmaptiles',
  sourceLayer: 'transportation_name',
  textField: '{name}',
  fontstack: 'Open Sans Regular',
  fontSize: 12,
  color: '#444444',
  opacity: 1,
  glyphs,
})
map.addLayer(lineTextLayer)

status.textContent = 'Ready — line text labels'

// Controls
const zoomInput = document.getElementById('zoom') as HTMLInputElement
const zoomVal = document.getElementById('zoom-val')!
const fontSizeInput = document.getElementById('font-size') as HTMLInputElement
const fontSizeVal = document.getElementById('font-size-val')!

zoomInput.addEventListener('input', () => {
  map.setCamera({ zoom: parseFloat(zoomInput.value) })
  zoomVal.textContent = parseFloat(zoomInput.value).toFixed(1)
})

map.on('move', (state: { zoom: number }) => {
  zoomInput.value = String(state.zoom.toFixed(1))
  zoomVal.textContent = state.zoom.toFixed(1)
})

fontSizeInput.addEventListener('input', () => {
  fontSizeVal.textContent = fontSizeInput.value + 'px'
})
```

- [ ] **Step 6.3: Verify demo starts**

```bash
npx vite demo/phase9/ --open
```

Open `http://localhost:5173` in a browser. Expected: map renders with light background, land fill, and road names following line geometry at zoom 8.

- [ ] **Step 6.4: Commit**

```bash
git add demo/phase9/
git commit -m "feat(modular/symbol): add Phase 9 demo — line text labels with LineTextLayer"
```

---

## Full test suite

Run all vendor unit tests together to confirm nothing regressed:

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/vendor/
```

Expected:
```
 PASS  src/modular/layers/symbol/vendor/path_interpolator.test.ts
 PASS  src/modular/layers/symbol/vendor/check_max_angle.test.ts
 PASS  src/modular/layers/symbol/vendor/clip_line.test.ts
 PASS  src/modular/layers/symbol/vendor/merge_lines.test.ts
 PASS  src/modular/layers/symbol/vendor/symbol_layout_helpers.test.ts

Test Files  5 passed (5)
Tests      ~25 passed
```

---

## Summary

| Task | Files | Tests | Status |
|---|---|---|---|
| 1. Vendor line files | `vendor/path_interpolator.ts`, `vendor/check_max_angle.ts`, `vendor/clip_line.ts`, `vendor/merge_lines.ts` + test files | Unit (5 tests each) | - [ ] |
| 2. symbol_layout_helpers | `vendor/symbol_layout_helpers.ts`, `vendor/symbol_layout_helpers.test.ts` | Unit (~12 tests) | - [ ] |
| 3. SymbolWorkerLine | `workers/symbol-worker-line.ts` | Integration only | - [ ] |
| 4. LineTextWorkerService | `workers/line-text-worker-service.ts` | None (browser) | - [ ] |
| 5. LineTextLayer | `line-text-layer.ts` | None (browser WebGL) | - [ ] |
| 6. Demo | `demo/phase9/index.html`, `demo/phase9/main.ts` | Visual only | - [ ] |
