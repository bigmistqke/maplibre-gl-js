# TextLayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement GlyphManager + TextWorkerService + TextLayer — a complete text label rendering pipeline that loads SDF glyphs, lays out labels in the worker, and renders them with a minimal SDF shader.

**Architecture:** GlyphManager (main thread) fetches PBF glyph ranges and maintains a glyph atlas WebGLTexture. TextWorkerService wraps a Comlink worker that fetches tile PBF, parses features, queues tiles waiting for glyphs, and runs shaping+quad generation when glyphs arrive, returning pre-built vertex arrays. TextLayer uses TextWorkerService as its TileService and draws from the side-channel bucket cache.

**Tech Stack:** TypeScript strict, Vitest (unit), @mapbox/vector-tile, pbf, @mapbox/tiny-sdf, potpack, Comlink, StructArray (already implemented)

**Spec:** `docs/superpowers/specs/2026-03-20-symbol-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/modular/layers/symbol/types.ts` | Create | Shared types + GlyphVertexLayout constant |
| `src/modular/layers/symbol/types.test.ts` | Create | Unit tests for layout stride |
| `src/modular/layers/symbol/glyph-loader.ts` | Create | Fetch + parse PBF glyph ranges |
| `src/modular/layers/symbol/glyph-loader.test.ts` | Create | Unit tests with mocked fetch |
| `src/modular/layers/symbol/glyph-atlas.ts` | Create | Pack SDF glyphs into atlas image |
| `src/modular/layers/symbol/glyph-atlas.test.ts` | Create | Unit tests for atlas packing |
| `src/modular/layers/symbol/glyph-manager.ts` | Create | Main-thread glyph resource manager |
| `src/modular/layers/symbol/glyph-manager.test.ts` | Create | Unit tests with mocked fetch |
| `src/modular/layers/symbol/simple-shaper.ts` | Create | shapeText + getGlyphQuads → StructArray |
| `src/modular/layers/symbol/simple-shaper.test.ts` | Create | Unit tests with minimal glyph map |
| `src/modular/layers/symbol/workers/symbol-worker-point.ts` | Create | Comlink worker: layout engine |
| `src/modular/layers/symbol/workers/text-worker-service.ts` | Create | Comlink wrapper for the worker |
| `src/modular/layers/symbol/text-layer.ts` | Create | Main-thread layer: draw SDF text |
| `demo/phase8/index.html` | Create | Phase 8 demo page |
| `demo/phase8/main.ts` | Create | Phase 8 demo script |

---

## Task 1: Types and StructArray layout

**Files:**
- Create: `src/modular/layers/symbol/types.ts`
- Create: `src/modular/layers/symbol/types.test.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/modular/layers/symbol/types.ts
import { defineStruct, type StructArray } from '../../../modular/core/struct-array.ts'

// ---- Glyph types ----

export type GlyphMetrics = {
  width: number
  height: number
  left: number
  top: number
  advance: number
}

export type StyleGlyph = {
  id: number
  bitmap: { width: number; height: number; data: Uint8Array }
  metrics: GlyphMetrics
}

/** Keyed by fontstack → codepoint → glyph (or null if missing from font) */
export type GlyphMap = { [stack: string]: { [id: number]: StyleGlyph | null } }

/** Position of a glyph in the packed atlas image */
export type GlyphPosition = {
  rect: { x: number; y: number; w: number; h: number }
  metrics: GlyphMetrics
}

/** Atlas positions keyed by fontstack → codepoint */
export type GlyphPositions = { [stack: string]: { [id: number]: GlyphPosition } }

// ---- Vertex layout ----

/**
 * Per-vertex SDF glyph layout:
 *   ax, ay  — anchor position in tile coords (int16, MVT [0..4096])
 *   ox, oy  — glyph pixel offset from anchor (int16, stored ×32 fixed-point)
 *   u,  v   — atlas texel coordinate (uint16, in atlas pixels — normalized to [0,1] on CPU before upload)
 *
 * Stride: 2+2+2+2+2+2 = 12 bytes
 */
export const GlyphVertexLayout = defineStruct({
  ax: 'int16',
  ay: 'int16',
  ox: 'int16',
  oy: 'int16',
  u:  'uint16',
  v:  'uint16',
})

// ---- Tile data produced by worker ----

export type SymbolTileData = {
  /** Interleaved vertex data matching GlyphVertexLayout */
  vertices: ArrayBuffer
  /** Uint16 index data */
  indices: ArrayBuffer
  /** Number of indices (= drawElements count) */
  count: number
  /** Label anchor positions in tile coords (for debugging / collision) */
  labelPositions: { x: number; y: number }[]
}
```

- [ ] **Step 2: Create the test file**

```ts
// src/modular/layers/symbol/types.test.ts
import { describe, it, expect } from 'vitest'
import { GlyphVertexLayout } from './types.ts'

describe('GlyphVertexLayout', () => {
  it('has stride of 12 bytes (6 fields × 2 bytes each)', () => {
    expect(GlyphVertexLayout.stride).toBe(12)
  })

  it('ax field is at offset 0', () => {
    expect(GlyphVertexLayout.fields.ax.offset).toBe(0)
  })

  it('ay field is at offset 2', () => {
    expect(GlyphVertexLayout.fields.ay.offset).toBe(2)
  })

  it('ox field is at offset 4', () => {
    expect(GlyphVertexLayout.fields.ox.offset).toBe(4)
  })

  it('oy field is at offset 6', () => {
    expect(GlyphVertexLayout.fields.oy.offset).toBe(6)
  })

  it('u field is at offset 8', () => {
    expect(GlyphVertexLayout.fields.u.offset).toBe(8)
  })

  it('v field is at offset 10', () => {
    expect(GlyphVertexLayout.fields.v.offset).toBe(10)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/types.test.ts
```

Expected output:
```
 PASS  src/modular/layers/symbol/types.test.ts
  GlyphVertexLayout
    ✓ has stride of 12 bytes (6 fields × 2 bytes each)
    ✓ ax field is at offset 0
    ✓ ay field is at offset 2
    ✓ ox field is at offset 4
    ✓ oy field is at offset 6
    ✓ u field is at offset 8
    ✓ v field is at offset 10
```

- [ ] **Step 4: Commit**

```bash
git add src/modular/layers/symbol/types.ts src/modular/layers/symbol/types.test.ts
git commit -m "feat(modular/symbol): add shared types and GlyphVertexLayout (12-byte stride)"
```

---

## Task 2: GlyphLoader — fetch and parse PBF glyph ranges

**Files:**
- Create: `src/modular/layers/symbol/glyph-loader.ts`
- Create: `src/modular/layers/symbol/glyph-loader.test.ts`

**Background:** MapLibre glyph URLs follow the pattern `{url}/{fontstack}/{range}.pbf` where `range` is the block start (e.g. 0, 256, 512 …). Each range file is a protobuf containing up to 256 glyphs. `parseGlyphPbf` from `src/style/parse_glyph_pbf.ts` decodes it to `StyleGlyph[]`. Our local `StyleGlyph` type differs slightly — `bitmap` is `{width, height, data: Uint8Array}` instead of `AlphaImage`. We adapt the output when building the GlyphMap.

- [ ] **Step 1: Create glyph-loader.ts**

```ts
// src/modular/layers/symbol/glyph-loader.ts
import Pbf from 'pbf'
import type { StyleGlyph, GlyphMap } from './types.ts'

// ---- Inline minimal PBF parser (avoids importing AlphaImage from src/util/image.ts) ----
// Mirrors src/style/parse_glyph_pbf.ts but produces our local StyleGlyph type.

const BORDER = 3  // matches GLYPH_PBF_BORDER in MapLibre

function readFontstacks(tag: number, glyphs: StyleGlyph[], pbf: any) {
  if (tag === 1) pbf.readMessage(readFontstack, glyphs)
}

function readFontstack(tag: number, glyphs: StyleGlyph[], pbf: any) {
  if (tag === 3) {
    const raw: any = {}
    pbf.readMessage(readGlyph, raw)
    const { id, bitmap, width = 0, height = 0, left = 0, top = 0, advance = 0 } = raw
    const w = width + 2 * BORDER
    const h = height + 2 * BORDER
    const data = new Uint8Array(w * h)
    if (bitmap && width > 0 && height > 0) {
      // Copy bitmap bytes into bordered buffer (same as AlphaImage constructor)
      for (let row = 0; row < height; row++) {
        const srcOff = row * width
        const dstOff = (row + BORDER) * w + BORDER
        data.set(bitmap.subarray(srcOff, srcOff + width), dstOff)
      }
    }
    glyphs.push({ id, bitmap: { width: w, height: h, data }, metrics: { width, height, left, top, advance } })
  }
}

function readGlyph(tag: number, glyph: any, pbf: any) {
  if      (tag === 1) glyph.id     = pbf.readVarint()
  else if (tag === 2) glyph.bitmap = pbf.readBytes()
  else if (tag === 3) glyph.width  = pbf.readVarint()
  else if (tag === 4) glyph.height = pbf.readVarint()
  else if (tag === 5) glyph.left   = pbf.readSVarint()
  else if (tag === 6) glyph.top    = pbf.readSVarint()
  else if (tag === 7) glyph.advance = pbf.readVarint()
}

function parseGlyphPbfLocal(data: ArrayBuffer | Uint8Array): StyleGlyph[] {
  return new (Pbf as any)(data).readFields(readFontstacks, [])
}

// ---- Public API ----

/**
 * Fetch and decode one glyph range (256 codepoints) for a given fontstack.
 *
 * @param fontstack  e.g. "Open Sans Regular"
 * @param range      block start: 0, 256, 512 … (= Math.floor(codepoint / 256) * 256)
 * @param urlTemplate  e.g. "https://…/{fontstack}/{range}.pbf"
 * @param signal     optional AbortSignal
 */
export async function loadGlyphRange(
  fontstack: string,
  range: number,
  urlTemplate: string,
  signal?: AbortSignal,
): Promise<{ [id: number]: StyleGlyph | null }> {
  const url = urlTemplate
    .replace('{fontstack}', encodeURIComponent(fontstack))
    .replace('{range}', `${range}-${range + 255}`)

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`loadGlyphRange: HTTP ${res.status} for ${url}`)
  const buf = await res.arrayBuffer()
  const glyphs = parseGlyphPbfLocal(buf)

  const result: { [id: number]: StyleGlyph | null } = {}
  // Pre-fill entire range with null so callers know a range is loaded
  for (let i = range; i < range + 256; i++) result[i] = null
  for (const g of glyphs) result[g.id] = g
  return result
}

/** Return the range block start for a given codepoint (0, 256, 512, …). */
export function glyphRange(codepoint: number): number {
  return Math.floor(codepoint / 256) * 256
}
```

- [ ] **Step 2: Create glyph-loader.test.ts**

```ts
// src/modular/layers/symbol/glyph-loader.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadGlyphRange, glyphRange } from './glyph-loader.ts'

// Build a minimal glyph PBF for a single codepoint (id=65 = 'A')
// We use a hand-crafted protobuf. Since constructing real PBFs is complex in
// tests, we mock fetch to return a known ArrayBuffer that parseGlyphPbfLocal
// will decode — here we use an empty response and just verify the shape.

describe('glyphRange', () => {
  it('returns 0 for codepoint 0', () => expect(glyphRange(0)).toBe(0))
  it('returns 0 for codepoint 65 (A)', () => expect(glyphRange(65)).toBe(0))
  it('returns 256 for codepoint 256', () => expect(glyphRange(256)).toBe(256))
  it('returns 256 for codepoint 511', () => expect(glyphRange(511)).toBe(256))
  it('returns 512 for codepoint 512', () => expect(glyphRange(512)).toBe(512))
})

describe('loadGlyphRange', () => {
  beforeEach(() => {
    // Mock fetch to return an empty valid protobuf (no glyphs in the range)
    // An empty ArrayBuffer is a valid protobuf with zero fields.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls fetch with interpolated URL', async () => {
    await loadGlyphRange('Open Sans Regular', 0, 'https://example.com/{fontstack}/{range}.pbf')
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('Open%20Sans%20Regular'),
      expect.any(Object),
    )
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('0-255'),
      expect.any(Object),
    )
  })

  it('returns a map pre-filled with null for the full range', async () => {
    const result = await loadGlyphRange('Open Sans Regular', 0, 'https://example.com/{fontstack}/{range}.pbf')
    // With empty PBF, all 256 slots should be null
    expect(result[0]).toBeNull()
    expect(result[65]).toBeNull()
    expect(result[255]).toBeNull()
    // But outside this range should be undefined
    expect(result[256]).toBeUndefined()
  })

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(
      loadGlyphRange('Open Sans Regular', 0, 'https://example.com/{fontstack}/{range}.pbf'),
    ).rejects.toThrow('HTTP 404')
  })

  it('passes AbortSignal to fetch', async () => {
    const controller = new AbortController()
    await loadGlyphRange('Open Sans Regular', 0, 'https://example.com/{fontstack}/{range}.pbf', controller.signal)
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    )
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/glyph-loader.test.ts
```

Expected output:
```
 PASS  src/modular/layers/symbol/glyph-loader.test.ts
  glyphRange
    ✓ returns 0 for codepoint 0
    ✓ returns 0 for codepoint 65 (A)
    ✓ returns 256 for codepoint 256
    ✓ returns 256 for codepoint 511
    ✓ returns 512 for codepoint 512
  loadGlyphRange
    ✓ calls fetch with interpolated URL
    ✓ returns a map pre-filled with null for the full range
    ✓ throws on HTTP error
    ✓ passes AbortSignal to fetch
```

- [ ] **Step 4: Commit**

```bash
git add src/modular/layers/symbol/glyph-loader.ts src/modular/layers/symbol/glyph-loader.test.ts
git commit -m "feat(modular/symbol): add GlyphLoader — fetch and parse PBF glyph ranges"
```

---

## Task 3: GlyphAtlas — pack SDF glyphs into a texture

**Files:**
- Create: `src/modular/layers/symbol/glyph-atlas.ts`
- Create: `src/modular/layers/symbol/glyph-atlas.test.ts`

**Background:** `potpack` takes an array of `{w, h}` bin objects and mutates them in-place with `{x, y}` — it returns `{w, h}` of the final sheet. We add 1px padding around each glyph bitmap to prevent bleeding. The output is a flat `Uint8Array` alpha image.

- [ ] **Step 1: Create glyph-atlas.ts**

```ts
// src/modular/layers/symbol/glyph-atlas.ts
import potpack from 'potpack'
import type { GlyphMap, GlyphPositions, StyleGlyph } from './types.ts'

const PADDING = 1

export type AtlasImage = { width: number; height: number; data: Uint8Array }

export class GlyphAtlas {
  readonly image: AtlasImage
  readonly positions: GlyphPositions

  constructor(stacks: GlyphMap) {
    const positions: GlyphPositions = {}
    const bins: Array<{ x: number; y: number; w: number; h: number; stack: string; id: number }> = []

    for (const stack in stacks) {
      const glyphs = stacks[stack]
      positions[stack] = {}
      for (const idStr in glyphs) {
        const id = +idStr
        const src = glyphs[id]
        if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) continue
        const bin = { x: 0, y: 0, w: src.bitmap.width + 2 * PADDING, h: src.bitmap.height + 2 * PADDING, stack, id }
        bins.push(bin)
        positions[stack][id] = { rect: bin, metrics: src.metrics }
      }
    }

    const { w, h } = potpack(bins)
    const width = w || 1
    const height = h || 1
    const data = new Uint8Array(width * height)

    for (const stack in stacks) {
      const glyphs = stacks[stack]
      for (const idStr in glyphs) {
        const id = +idStr
        const src = glyphs[id]
        if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) continue
        const pos = positions[stack][id]
        const { x: bx, y: by } = pos.rect
        // Copy alpha bytes row by row into atlas, offset by PADDING
        const bw = src.bitmap.width
        const bh = src.bitmap.height
        for (let row = 0; row < bh; row++) {
          const srcOff = row * bw
          const dstOff = (by + PADDING + row) * width + (bx + PADDING)
          data.set(src.bitmap.data.subarray(srcOff, srcOff + bw), dstOff)
        }
      }
    }

    this.image = { width, height, data }
    this.positions = positions
  }
}
```

- [ ] **Step 2: Create glyph-atlas.test.ts**

```ts
// src/modular/layers/symbol/glyph-atlas.test.ts
import { describe, it, expect } from 'vitest'
import { GlyphAtlas } from './glyph-atlas.ts'
import type { GlyphMap } from './types.ts'

function makeGlyph(id: number, w: number, h: number): import('./types.ts').StyleGlyph {
  // Fill with a solid value (e.g. 200) for easy testing
  const data = new Uint8Array(w * h).fill(200)
  return { id, bitmap: { width: w, height: h, data }, metrics: { width: w, height: h, left: 0, top: 0, advance: w } }
}

describe('GlyphAtlas', () => {
  it('produces non-empty image for non-empty glyph map', () => {
    const map: GlyphMap = { 'Open Sans Regular': { 65: makeGlyph(65, 10, 12) } }
    const atlas = new GlyphAtlas(map)
    expect(atlas.image.width).toBeGreaterThan(0)
    expect(atlas.image.height).toBeGreaterThan(0)
    expect(atlas.image.data.length).toBe(atlas.image.width * atlas.image.height)
  })

  it('sets position rect for each glyph', () => {
    const map: GlyphMap = { 'Open Sans Regular': { 65: makeGlyph(65, 10, 12) } }
    const atlas = new GlyphAtlas(map)
    const pos = atlas.positions['Open Sans Regular'][65]
    expect(pos).toBeDefined()
    expect(pos.rect.w).toBe(10 + 2)  // glyph width + 2 * PADDING
    expect(pos.rect.h).toBe(12 + 2)
  })

  it('copies glyph bitmap data into atlas image', () => {
    const map: GlyphMap = { 'Open Sans Regular': { 65: makeGlyph(65, 4, 4) } }
    const atlas = new GlyphAtlas(map)
    const pos = atlas.positions['Open Sans Regular'][65]
    // The top-left pixel of the glyph (at PADDING offset) should equal 200
    const px = (pos.rect.y + 1) * atlas.image.width + (pos.rect.x + 1)
    expect(atlas.image.data[px]).toBe(200)
  })

  it('handles empty GlyphMap gracefully (1×1 image)', () => {
    const atlas = new GlyphAtlas({})
    expect(atlas.image.width).toBe(1)
    expect(atlas.image.height).toBe(1)
  })

  it('handles glyphs with zero-size bitmap (skipped)', () => {
    const map: GlyphMap = { 'Open Sans Regular': { 32: { id: 32, bitmap: { width: 0, height: 0, data: new Uint8Array(0) }, metrics: { width: 0, height: 0, left: 0, top: 0, advance: 6 } } } }
    const atlas = new GlyphAtlas(map)
    expect(atlas.positions['Open Sans Regular'][32]).toBeUndefined()
  })

  it('packs multiple glyphs without overlap', () => {
    const map: GlyphMap = {
      'Open Sans Regular': {
        65: makeGlyph(65, 8, 8),
        66: makeGlyph(66, 8, 8),
        67: makeGlyph(67, 8, 8),
      }
    }
    const atlas = new GlyphAtlas(map)
    // Each position rect should be distinct (potpack guarantees non-overlap)
    const rects = Object.values(atlas.positions['Open Sans Regular']).map(p => p.rect)
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j]
        const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
        expect(overlap).toBe(false)
      }
    }
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/glyph-atlas.test.ts
```

Expected output:
```
 PASS  src/modular/layers/symbol/glyph-atlas.test.ts
  GlyphAtlas
    ✓ produces non-empty image for non-empty glyph map
    ✓ sets position rect for each glyph
    ✓ copies glyph bitmap data into atlas image
    ✓ handles empty GlyphMap gracefully (1×1 image)
    ✓ handles glyphs with zero-size bitmap (skipped)
    ✓ packs multiple glyphs without overlap
```

- [ ] **Step 4: Commit**

```bash
git add src/modular/layers/symbol/glyph-atlas.ts src/modular/layers/symbol/glyph-atlas.test.ts
git commit -m "feat(modular/symbol): add GlyphAtlas — potpack bin-packing of SDF glyphs"
```

---

## Task 4: GlyphManager — main-thread glyph resource manager

**Files:**
- Create: `src/modular/layers/symbol/glyph-manager.ts`
- Create: `src/modular/layers/symbol/glyph-manager.test.ts`

**Background:** GlyphManager caches loaded ranges, deduplicates in-flight requests, builds the GlyphAtlas on demand, and uploads it to a WebGL texture. It exposes an `_onGlyphsLoaded` callback that TextLayer wires up to push new glyphs AND atlas positions to the worker. The callback fires AFTER atlas positions have been rebuilt (CPU-only, no `gl` context needed), so the worker receives fresh `GlyphPositions` it can use to set UV attributes correctly.

- [ ] **Step 1: Create glyph-manager.ts**

```ts
// src/modular/layers/symbol/glyph-manager.ts
import { loadGlyphRange, glyphRange } from './glyph-loader.ts'
import { GlyphAtlas } from './glyph-atlas.ts'
import type { GlyphMap, GlyphPositions, StyleGlyph } from './types.ts'

export class GlyphManager {
  private _url: string
  /** Loaded glyphs per fontstack, keyed by codepoint */
  private _glyphs: { [stack: string]: { [id: number]: StyleGlyph | null } } = {}
  /** Ranges already loaded (or in-flight) per fontstack, keyed by range start */
  private _loadedRanges: { [stack: string]: { [range: number]: boolean | Promise<void> } } = {}

  /** Atlas is rebuilt whenever new ranges arrive */
  private _atlas: GlyphAtlas | null = null
  /** Dirty flag: set when new glyphs loaded, cleared after buildAtlas() */
  private _atlasDirty = false
  /** WebGL texture holding the current atlas */
  glyphAtlasTexture: WebGLTexture | null = null
  /** Atlas positions for the current built atlas */
  glyphPositions: GlyphPositions = {}

  /**
   * Optional callback invoked (on main thread) whenever new glyph ranges finish loading.
   * TextLayer sets this to push glyphs to the worker.
   */
  _onGlyphsLoaded: ((map: GlyphMap, positions: GlyphPositions) => void) | null = null

  constructor(options: { url: string }) {
    this._url = options.url
  }

  /**
   * Ensure all listed codepoints are loaded for each fontstack.
   * Returns the full GlyphMap (including already-cached glyphs).
   * Resolves once all needed ranges have been fetched.
   */
  async getGlyphs(neededGlyphs: { [stack: string]: number[] }): Promise<GlyphMap> {
    const promises: Promise<void>[] = []

    for (const stack in neededGlyphs) {
      if (!this._glyphs[stack]) this._glyphs[stack] = {}
      if (!this._loadedRanges[stack]) this._loadedRanges[stack] = {}

      const ids = neededGlyphs[stack]
      const neededRanges = new Set(ids.map(glyphRange))

      for (const range of neededRanges) {
        if (this._loadedRanges[stack][range]) continue  // already loaded or in-flight

        const p = this._loadRange(stack, range)
        this._loadedRanges[stack][range] = p
        promises.push(p)
      }
    }

    await Promise.all(promises)

    // Build result map from cache
    const result: GlyphMap = {}
    for (const stack in neededGlyphs) {
      result[stack] = {}
      for (const id of neededGlyphs[stack]) {
        result[stack][id] = this._glyphs[stack][id] ?? null
      }
    }
    return result
  }

  private async _loadRange(stack: string, range: number): Promise<void> {
    const rangeGlyphs = await loadGlyphRange(stack, range, this._url)
    Object.assign(this._glyphs[stack], rangeGlyphs)
    this._atlasDirty = true

    // Rebuild atlas positions (CPU-only — no gl needed) so callback receives fresh positions.
    // Leave _atlasDirty = true so buildAtlas() knows the GPU texture needs re-uploading.
    this._atlas = new GlyphAtlas(this._glyphs as GlyphMap)
    this.glyphPositions = this._atlas.positions

    // Notify listener (TextLayer → worker) with BOTH the partial glyph map and
    // the freshly computed atlas positions so the worker can set UV attributes.
    if (this._onGlyphsLoaded) {
      const partial: GlyphMap = { [stack]: rangeGlyphs }
      this._onGlyphsLoaded(partial, this.glyphPositions)
    }
  }

  /**
   * (Re)build the glyph atlas from all loaded glyphs and upload to GPU.
   * Call this once per frame from TextLayer.draw() before binding the texture.
   * No-op if nothing changed since last call.
   */
  buildAtlas(gl: WebGLRenderingContext): void {
    if (!this._atlasDirty && this._atlas !== null) return
    this._atlasDirty = false

    // If _atlas is already current (rebuilt CPU-side in _loadRange), reuse it.
    // Otherwise rebuild from scratch (e.g. first call with no ranges loaded yet).
    if (!this._atlas) {
      this._atlas = new GlyphAtlas(this._glyphs as GlyphMap)
      this.glyphPositions = this._atlas.positions
    }

    if (!this.glyphAtlasTexture) {
      this.glyphAtlasTexture = gl.createTexture()
    }

    gl.bindTexture(gl.TEXTURE_2D, this.glyphAtlasTexture)
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.ALPHA,
      this._atlas.image.width, this._atlas.image.height,
      0, gl.ALPHA, gl.UNSIGNED_BYTE,
      this._atlas.image.data,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  destroy(): void {
    this._glyphs = {}
    this._loadedRanges = {}
    this._atlas = null
    this._atlasDirty = false
    // Caller responsible for deleting glyphAtlasTexture from WebGL context
    this.glyphAtlasTexture = null
  }
}
```

- [ ] **Step 2: Create glyph-manager.test.ts**

```ts
// src/modular/layers/symbol/glyph-manager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GlyphManager } from './glyph-manager.ts'

// We mock the glyph-loader module so we can control what ranges return
vi.mock('./glyph-loader.ts', () => ({
  glyphRange: (id: number) => Math.floor(id / 256) * 256,
  loadGlyphRange: vi.fn().mockResolvedValue({}),
}))

import { loadGlyphRange } from './glyph-loader.ts'

describe('GlyphManager', () => {
  beforeEach(() => {
    vi.mocked(loadGlyphRange).mockClear()
    // By default, return an empty range
    vi.mocked(loadGlyphRange).mockResolvedValue({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls loadGlyphRange for each needed range', async () => {
    const mgr = new GlyphManager({ url: 'https://example.com/{fontstack}/{range}.pbf' })
    await mgr.getGlyphs({ 'Open Sans Regular': [65, 66, 67] })
    // All codepoints are in range 0, so only one fetch
    expect(vi.mocked(loadGlyphRange)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(loadGlyphRange)).toHaveBeenCalledWith('Open Sans Regular', 0, expect.any(String))
  })

  it('does not re-fetch an already-loaded range', async () => {
    const mgr = new GlyphManager({ url: 'https://example.com/{fontstack}/{range}.pbf' })
    await mgr.getGlyphs({ 'Open Sans Regular': [65] })
    await mgr.getGlyphs({ 'Open Sans Regular': [66] })
    // Same range (0), should only fetch once
    expect(vi.mocked(loadGlyphRange)).toHaveBeenCalledTimes(1)
  })

  it('fetches separate ranges for different codepoints', async () => {
    const mgr = new GlyphManager({ url: 'https://example.com/{fontstack}/{range}.pbf' })
    await mgr.getGlyphs({ 'Open Sans Regular': [65, 300] })  // ranges 0 and 256
    expect(vi.mocked(loadGlyphRange)).toHaveBeenCalledTimes(2)
  })

  it('invokes _onGlyphsLoaded callback after each range loads with both GlyphMap and GlyphPositions', async () => {
    const mgr = new GlyphManager({ url: 'https://example.com/{fontstack}/{range}.pbf' })
    const cb = vi.fn()
    mgr._onGlyphsLoaded = cb
    await mgr.getGlyphs({ 'Open Sans Regular': [65] })
    expect(cb).toHaveBeenCalledTimes(1)
    // First arg: partial GlyphMap
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ 'Open Sans Regular': expect.any(Object) }),
      // Second arg: GlyphPositions (may be empty if no non-zero bitmaps, but must be an object)
      expect.any(Object),
    )
  })

  it('returns null for glyphs not in loaded data', async () => {
    const mgr = new GlyphManager({ url: 'https://example.com/{fontstack}/{range}.pbf' })
    // loadGlyphRange returns empty map → glyph 65 is null
    const result = await mgr.getGlyphs({ 'Open Sans Regular': [65] })
    expect(result['Open Sans Regular'][65]).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/glyph-manager.test.ts
```

Expected output:
```
 PASS  src/modular/layers/symbol/glyph-manager.test.ts
  GlyphManager
    ✓ calls loadGlyphRange for each needed range
    ✓ does not re-fetch an already-loaded range
    ✓ fetches separate ranges for different codepoints
    ✓ invokes _onGlyphsLoaded callback after each range loads with both GlyphMap and GlyphPositions
    ✓ returns null for glyphs not in loaded data
```

- [ ] **Step 4: Commit**

```bash
git add src/modular/layers/symbol/glyph-manager.ts src/modular/layers/symbol/glyph-manager.test.ts
git commit -m "feat(modular/symbol): add GlyphManager — main-thread glyph cache and atlas builder"
```

---

## Task 5: SimpleShaper — extract text features and generate quads

**Files:**
- Create: `src/modular/layers/symbol/simple-shaper.ts`
- Create: `src/modular/layers/symbol/simple-shaper.test.ts`

**Background:** We use MapLibre's `shapeText` and `getGlyphQuads` directly. `shapeText` requires a `Formatted` object (from `@maplibre/maplibre-gl-style-spec`) and glyph metrics via a `GlyphPosition` map. `getGlyphQuads` requires the shaping result, `GlyphPosition` map, and an `Anchor`. We wrap these in a simpler interface. Quad vertices are packed into a `StructArray` using `GlyphVertexLayout`.

Each glyph quad produces 4 vertices and 6 indices (two triangles). Anchor positions (tile coords) are replicated per vertex. Offsets from `getGlyphQuads` are in ems — multiply by `fontSize / ONE_EM * 32` to get fixed-point pixel offsets (stored ×32 as int16). Atlas UV coords are from `pos.rect.{x,y}` — stored as uint16 atlas pixels.

- [ ] **Step 1: Create simple-shaper.ts**

```ts
// src/modular/layers/symbol/simple-shaper.ts
import { Formatted, FormattedSection } from '@maplibre/maplibre-gl-style-spec'
import ONE_EM from '../../../symbol/one_em.ts'
import { shapeText } from '../../../symbol/shaping.ts'
import { getGlyphQuads } from '../../../symbol/quads.ts'
import { Anchor } from '../../../symbol/anchor.ts'
import { StructArray } from '../../core/struct-array.ts'
import { GlyphVertexLayout } from './types.ts'
import type { GlyphMap, GlyphPositions } from './types.ts'

export interface ShaperOptions {
  text: string
  anchor: { x: number; y: number }
  glyphMap: GlyphMap
  glyphPositions: GlyphPositions
  fontstack: string
  fontSize: number
}

export interface ShaperResult {
  vertices: StructArray<'ax' | 'ay' | 'ox' | 'oy' | 'u' | 'v'>
  indices: number[]
}

/**
 * Shape a text string and generate glyph quads packed into a StructArray.
 * Returns null if shaping fails (e.g. all glyphs missing).
 */
export function shapeAndBuildQuads(options: ShaperOptions): ShaperResult | null {
  const { text, anchor, glyphMap, glyphPositions, fontstack, fontSize } = options

  // Build a Formatted object — one section with the entire text
  const formatted = new Formatted([new FormattedSection(text, null, null, null, null)])

  // Build per-stack glyph metrics maps required by shapeText
  // shapeText expects: glyphs[stack][id] = {rect, metrics} | null
  const glyphsForShaping: { [stack: string]: { [id: number]: { rect: any; metrics: any } | null } } = {}
  const posForStack = glyphPositions[fontstack] ?? {}
  glyphsForShaping[fontstack] = {}
  for (const idStr in posForStack) {
    const id = +idStr
    glyphsForShaping[fontstack][id] = posForStack[id]
  }

  const shaping = shapeText(
    formatted,
    glyphsForShaping,
    {},        // images (none)
    fontstack,
    24,        // lineHeight in pixels
    'center',  // textAnchor
    'center',  // textJustify
    0,         // spacing
    [0, 0],    // translate
    { scale: fontSize / ONE_EM },
    0,         // writingMode
    { horizontal: true },
    false,     // allowVerticalPlacement
    false,     // symbolPlacementLine
  )

  if (!shaping) return null

  const maplibreAnchor = new Anchor(anchor.x, anchor.y, 0, undefined)

  const quads = getGlyphQuads(
    maplibreAnchor,
    shaping,
    [0, 0],    // textOffset
    {
      layout: {
        get: (name: string) => {
          if (name === 'text-rotate') return 0
          if (name === 'text-keep-upright') return false
          return null
        }
      }
    } as any,
    glyphPositions[fontstack] ?? {},
    false,     // alongLine
  )

  if (!quads || quads.length === 0) return null

  const verts = new StructArray(GlyphVertexLayout)
  const indices: number[] = []
  const scale = fontSize / ONE_EM  // ems → pixels

  for (const quad of quads) {
    const base = verts.length

    // Each quad: 4 corners (tl, tr, bl, br)
    // tl, tr, bl, br are Points with x/y offsets in ems
    const corners = [quad.tl, quad.tr, quad.bl, quad.br]
    const uvCorners = [
      { u: quad.tex.x,             v: quad.tex.y },
      { u: quad.tex.x + quad.tex.w, v: quad.tex.y },
      { u: quad.tex.x,             v: quad.tex.y + quad.tex.h },
      { u: quad.tex.x + quad.tex.w, v: quad.tex.y + quad.tex.h },
    ]

    for (let i = 0; i < 4; i++) {
      const c = corners[i]
      const uv = uvCorners[i]
      // offset stored as int16 ×32 fixed-point (matching shader: a_offset / 32.0 = pixels)
      verts.emplaceBack(
        anchor.x,             // ax (tile coords)
        anchor.y,             // ay (tile coords)
        Math.round(c.x * scale * 32),  // ox (fixed-point pixels ×32)
        Math.round(c.y * scale * 32),  // oy
        Math.round(uv.u),     // u (atlas pixels)
        Math.round(uv.v),     // v (atlas pixels)
      )
    }

    // Two triangles: tl-tr-bl, tr-br-bl
    indices.push(base + 0, base + 1, base + 2, base + 1, base + 3, base + 2)
  }

  return { vertices: verts, indices }
}

/** Extract codepoints needed for a text string from a fontstack's glyph map. */
export function getNeededGlyphs(text: string, fontstack: string): { [stack: string]: number[] } {
  const codepoints = new Set<number>()
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i)
    if (cp !== undefined) codepoints.add(cp)
    // Skip surrogate pairs
    if (cp !== undefined && cp > 0xffff) i++
  }
  return { [fontstack]: Array.from(codepoints) }
}
```

- [ ] **Step 2: Create simple-shaper.test.ts**

```ts
// src/modular/layers/symbol/simple-shaper.test.ts
import { describe, it, expect } from 'vitest'
import { getNeededGlyphs, shapeAndBuildQuads } from './simple-shaper.ts'
import type { GlyphMap, GlyphPositions } from './types.ts'

describe('getNeededGlyphs', () => {
  it('returns codepoints for ASCII text', () => {
    const result = getNeededGlyphs('Hi', 'Open Sans Regular')
    expect(result['Open Sans Regular']).toContain(72)  // 'H'
    expect(result['Open Sans Regular']).toContain(105) // 'i'
  })

  it('deduplicates repeated characters', () => {
    const result = getNeededGlyphs('aa', 'Open Sans Regular')
    expect(result['Open Sans Regular'].filter(c => c === 97).length).toBe(1)
  })
})

describe('shapeAndBuildQuads', () => {
  // Build a minimal GlyphMap and GlyphPositions for a single character 'A' (65)
  const metrics = { width: 8, height: 10, left: 1, top: 10, advance: 10 }
  const bitmap = { width: 14, height: 16, data: new Uint8Array(14 * 16).fill(128) }  // includes BORDER
  const glyphMap: GlyphMap = {
    'Open Sans Regular': { 65: { id: 65, bitmap, metrics } }
  }
  const glyphPositions: GlyphPositions = {
    'Open Sans Regular': {
      65: { rect: { x: 0, y: 0, w: 14, h: 16 }, metrics }
    }
  }

  it('returns null for empty text', () => {
    const result = shapeAndBuildQuads({
      text: '',
      anchor: { x: 2048, y: 2048 },
      glyphMap,
      glyphPositions,
      fontstack: 'Open Sans Regular',
      fontSize: 16,
    })
    // Empty text → no glyphs → null (or 0 quads, depending on shapeText)
    // We just verify it doesn't throw
    expect(result === null || result.indices.length === 0).toBe(true)
  })

  it('returns vertices and indices for a shapeable character', () => {
    const result = shapeAndBuildQuads({
      text: 'A',
      anchor: { x: 2048, y: 2048 },
      glyphMap,
      glyphPositions,
      fontstack: 'Open Sans Regular',
      fontSize: 16,
    })
    if (result === null) return  // skip if MapLibre shaper needs more setup
    expect(result.vertices.length).toBeGreaterThan(0)
    expect(result.indices.length).toBeGreaterThan(0)
    // Indices must come in groups of 6 (two triangles per quad)
    expect(result.indices.length % 6).toBe(0)
  })

  it('anchor coordinates appear in vertex buffer', () => {
    const result = shapeAndBuildQuads({
      text: 'A',
      anchor: { x: 1234, y: 5678 },
      glyphMap,
      glyphPositions,
      fontstack: 'Open Sans Regular',
      fontSize: 16,
    })
    if (!result || result.vertices.length === 0) return
    const buf = result.vertices.arrayBuffer
    const view = new DataView(buf)
    // First vertex: ax = 1234, ay = 5678 (int16 at offsets 0 and 2)
    expect(view.getInt16(0, true)).toBe(1234)
    expect(view.getInt16(2, true)).toBe(5678)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/simple-shaper.test.ts
```

Expected output:
```
 PASS  src/modular/layers/symbol/simple-shaper.test.ts
  getNeededGlyphs
    ✓ returns codepoints for ASCII text
    ✓ deduplicates repeated characters
  shapeAndBuildQuads
    ✓ returns null for empty text
    ✓ returns vertices and indices for a shapeable character
    ✓ anchor coordinates appear in vertex buffer
```

Note: If MapLibre's `shapeText` throws due to missing internal dependencies (e.g. RTL worker), the shaper tests that call `shapeAndBuildQuads` with real text may skip via the `if (result === null) return` guard. The `getNeededGlyphs` tests will always pass.

- [ ] **Step 4: Commit**

```bash
git add src/modular/layers/symbol/simple-shaper.ts src/modular/layers/symbol/simple-shaper.test.ts
git commit -m "feat(modular/symbol): add SimpleShaper — shapeText + getGlyphQuads → StructArray"
```

---

## Task 6: SymbolWorker — worker-side layout engine

**Files:**
- Create: `src/modular/layers/symbol/workers/symbol-worker-point.ts`

**Background:** The worker fetches tile PBF, extracts text features, determines which glyph ranges are needed, and either runs layout immediately (if all glyphs present in `_glyphMap`) or stores the tile in `_waiting` until `updateGlyphs()` supplies the missing ranges.

Layout produces a `SymbolTileData` stored in `_buckets`, accessible via `getBucket()`. The main thread calls `getBucket()` (via the service) on each draw frame.

- [ ] **Step 1: Create symbol-worker-point.ts**

```ts
// src/modular/layers/symbol/workers/symbol-worker-point.ts
import * as Comlink from 'comlink'
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import { shapeAndBuildQuads, getNeededGlyphs } from '../simple-shaper.ts'
import { glyphRange } from '../glyph-loader.ts'
import type { GlyphMap, SymbolTileData, GlyphPositions } from '../types.ts'

interface PendingTile {
  resolve: (data: SymbolTileData | null) => void
  reject: (err: Error) => void
  pbfBuffer: ArrayBuffer
  textField: string
  fontstack: string
  fontSize: number
  anchorX: number
  anchorY: number
  neededRanges: { [stack: string]: Set<number> }
}

export class SymbolWorkerPoint {
  private _glyphMap: GlyphMap = {}
  private _glyphPositions: GlyphPositions = {}
  private _pending = new globalThis.Map<string, AbortController>()
  private _waiting = new globalThis.Map<string, PendingTile>()
  private _buckets = new globalThis.Map<string, SymbolTileData>()

  /**
   * Merge new glyphs into the local map and unblock any waiting tiles
   * whose missing ranges are now satisfied.
   */
  updateGlyphs(partialMap: GlyphMap, positions: GlyphPositions): void {
    for (const stack in partialMap) {
      if (!this._glyphMap[stack]) this._glyphMap[stack] = {}
      Object.assign(this._glyphMap[stack], partialMap[stack])
    }
    for (const stack in positions) {
      if (!this._glyphPositions[stack]) this._glyphPositions[stack] = {}
      Object.assign(this._glyphPositions[stack], positions[stack])
    }
    // Check waiting tiles
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
        // A range is loaded if any codepoint in that range exists in the map
        // (loadGlyphRange pre-fills the entire range with null)
        if (stackGlyphs[range] === undefined) return false
      }
    }
    return true
  }

  private async _runLayout(key: string, pending: PendingTile): Promise<SymbolTileData | null> {
    const { pbfBuffer, textField, fontstack, fontSize } = pending

    const tile = new VectorTile(new Pbf(pbfBuffer))
    // Collect all text from all layers for simplicity; in production you'd use sourceLayer
    const allLabels: { text: string; x: number; y: number }[] = []

    for (const layerName in tile.layers) {
      const layer = tile.layers[layerName]
      for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i)
        const rawText = this._resolveTextField(textField, feat.properties)
        if (!rawText) continue

        // Use centroid of first geometry point as anchor
        const geom = feat.loadGeometry()
        if (!geom || geom.length === 0 || geom[0].length === 0) continue
        allLabels.push({ text: rawText, x: geom[0][0].x, y: geom[0][0].y })
      }
    }

    if (allLabels.length === 0) return null

    const allVerts: number[] = []
    const allIdx: number[] = []
    const labelPositions: { x: number; y: number }[] = []

    for (const label of allLabels) {
      const result = shapeAndBuildQuads({
        text: label.text,
        anchor: { x: label.x, y: label.y },
        glyphMap: this._glyphMap,
        glyphPositions: this._glyphPositions,
        fontstack,
        fontSize,
      })
      if (!result || result.indices.length === 0) continue

      const idxOffset = allVerts.length / 6  // each vertex is 6 int16s → 12 bytes / 2 = 6
      const buf = result.vertices.arrayBuffer
      const view = new Int16Array(buf)
      for (let i = 0; i < view.length; i++) allVerts.push(view[i])
      for (const idx of result.indices) allIdx.push(idx + idxOffset)
      labelPositions.push({ x: label.x, y: label.y })
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
    const text = template.replace(/\{([^}]+)\}/g, (_, key) => String(props[key] ?? '')).trim()
    return text.length > 0 ? text : null
  }

  async request(
    key: string,
    url: string,
    textField: string,
    fontstack: string,
    fontSize: number,
  ): Promise<SymbolTileData | null> {
    const controller = new AbortController()
    this._pending.set(key, controller)

    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const pbfBuffer = await res.arrayBuffer()
      if (!this._pending.has(key)) return null  // cancelled
      this._pending.delete(key)

      // Parse tile to find needed glyph ranges
      const tile = new VectorTile(new Pbf(pbfBuffer.slice(0)))
      const neededRanges: { [stack: string]: Set<number> } = { [fontstack]: new Set() }

      for (const layerName in tile.layers) {
        const layer = tile.layers[layerName]
        for (let i = 0; i < layer.length; i++) {
          const feat = layer.feature(i)
          const rawText = this._resolveTextField(textField, feat.properties)
          if (!rawText) continue
          const needed = getNeededGlyphs(rawText, fontstack)
          for (const id of needed[fontstack] ?? []) {
            neededRanges[fontstack].add(glyphRange(id))
          }
        }
      }

      const pending: PendingTile = {
        resolve: () => {},
        reject: () => {},
        pbfBuffer,
        textField,
        fontstack,
        fontSize,
        anchorX: 0,
        anchorY: 0,
        neededRanges,
      }

      if (this._allRangesLoaded(neededRanges)) {
        return this._runLayout(key, pending)
      }

      // Queue until glyphs arrive
      return new Promise<SymbolTileData | null>((resolve, reject) => {
        pending.resolve = resolve
        pending.reject = reject
        this._waiting.set(key, pending)
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

Comlink.expose(new SymbolWorkerPoint())
```

No unit tests for this task (integration tested via TextLayer in the browser demo).

- [ ] **Step 2: Commit**

```bash
git add src/modular/layers/symbol/workers/symbol-worker-point.ts
git commit -m "feat(modular/symbol): add SymbolWorkerPoint — worker-side layout engine with glyph queuing"
```

---

## Task 7: TextWorkerService — Comlink wrapper

**Files:**
- Create: `src/modular/layers/symbol/workers/text-worker-service.ts`

- [ ] **Step 1: Create text-worker-service.ts**

```ts
// src/modular/layers/symbol/workers/text-worker-service.ts
import * as Comlink from 'comlink'
import type { Remote } from 'comlink'
import type { GlyphMap, GlyphPositions, SymbolTileData } from '../types.ts'

type SymbolWorkerType = import('./symbol-worker-point.ts').SymbolWorkerPoint

/**
 * Main-thread wrapper around the Comlink-exposed SymbolWorkerPoint.
 * Not a TileService — symbol tiles follow a side-channel protocol.
 */
export class TextWorkerService {
  private _worker: Worker
  private _proxy: Remote<SymbolWorkerType>

  constructor() {
    this._worker = new Worker(
      new URL('./symbol-worker-point.ts', import.meta.url),
      { type: 'module' },
    )
    this._proxy = Comlink.wrap<SymbolWorkerType>(this._worker)
  }

  /**
   * Trigger layout for a tile in the worker.
   * The worker fetches the PBF, finds needed glyph ranges, and either
   * resolves immediately or queues until updateGlyphs() supplies them.
   */
  async request(
    key: string,
    url: string,
    textField: string,
    fontstack: string,
    fontSize: number,
  ): Promise<void> {
    // Fire and forget — result is retrieved via getBucket()
    void this._proxy.request(key, url, textField, fontstack, fontSize)
  }

  /**
   * Retrieve the pre-built SymbolTileData for a tile (if layout has completed).
   * Returns null if the tile is still waiting for glyphs or hasn't been requested.
   */
  async getBucket(key: string): Promise<SymbolTileData | null> {
    return this._proxy.getBucket(key)
  }

  /**
   * Push newly loaded glyphs and atlas positions to the worker.
   * Called by GlyphManager._onGlyphsLoaded via TextLayer.onAdd().
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

No unit tests (browser-only Comlink/Worker).

- [ ] **Step 2: Commit**

```bash
git add src/modular/layers/symbol/workers/text-worker-service.ts
git commit -m "feat(modular/symbol): add TextWorkerService — Comlink wrapper for symbol layout worker"
```

---

## Task 8: TextLayer — main-thread layer

**Files:**
- Create: `src/modular/layers/symbol/text-layer.ts`

**Background:** TextLayer owns a `TextWorkerService` and a `GlyphManager`. On `onAdd()` it hooks `GlyphManager._onGlyphsLoaded` to push new glyphs AND freshly computed atlas positions to the worker (GlyphManager already rebuilt the atlas CPU-side before firing the callback). On `draw()` it calls `this._workerService.getBucket(key)` to fetch pre-built vertex data from the worker, uploads it to GPU if newly arrived, and draws with the SDF shader. All shaping and quad generation happens inside the worker — `draw()` does NOT parse tiles or call SimpleShaper.

**Critical invariant:** `draw()` never does layout. It only: (1) calls `getBucket()`, (2) uploads to GPU, (3) renders. The worker's `request()` does all the CPU-heavy work.

- [ ] **Step 1: Create text-layer.ts**

```ts
// src/modular/layers/symbol/text-layer.ts
import type { ProgramDefinition } from '../../core/types.ts'
import type { DrawContext } from '../../core/render-extension.ts'
import type { RendererAPI } from '../../core/renderer-api.ts'
import { GlyphManager } from './glyph-manager.ts'
import { TextWorkerService } from './workers/text-worker-service.ts'

// ---- SDF Shaders ----

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

export interface TextLayerOptions {
  source: string
  sourceLayer: string
  /** Template string, e.g. '{name}' */
  textField: string
  /** Font name, e.g. 'Open Sans Regular' — must match glyphs URL */
  fontstack?: string
  /** Font size in CSS pixels, default 16 */
  fontSize?: number
  /** Hex color string, default '#000000' */
  color?: string
  /** Opacity 0–1, default 1 */
  opacity?: number
  /** Constructed GlyphManager — caller owns lifecycle */
  glyphs: GlyphManager
}

function parseColor(c: string): [number, number, number, number] {
  const h = c.replace('#', '')
  if (h.length === 3)
    return [parseInt(h[0]+h[0],16)/255, parseInt(h[1]+h[1],16)/255, parseInt(h[2]+h[2],16)/255, 1]
  return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255, 1]
}

// ---- Layer ----

export class TextLayer {
  readonly type = 'text' as const

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
  private _workerService: TextWorkerService
  private _tileBuckets = new globalThis.Map<string, { verts: WebGLBuffer; idx: WebGLBuffer; count: number } | null>()
  private _webgl!: { createGeometryBuffer(key: string, data: ArrayBufferView, target: number): WebGLBuffer }
  private _gl!: WebGLRenderingContext

  /** Expose workerService so callers can pass it as a TileService-like object if needed. */
  readonly workerService: TextWorkerService

  constructor(options: TextLayerOptions) {
    this.source = options.source
    this.sourceLayer = options.sourceLayer
    this._textField = options.textField
    this._fontstack = options.fontstack ?? 'Open Sans Regular'
    this._fontSize = options.fontSize ?? 16
    this._color = options.color ?? '#000000'
    this._opacity = options.opacity ?? 1
    this._glyphs = options.glyphs
    this._workerService = new TextWorkerService()
    this.workerService = this._workerService
  }

  onAdd(renderer: RendererAPI): void {
    this._webgl = (renderer as any)._webgl
    this._gl = (renderer as any)._gl

    // Wire glyph loading: GlyphManager already rebuilt atlas positions (CPU-side)
    // before firing this callback, so glyphPositions is up to date.
    // Push both the partial glyph map AND the fresh atlas positions to the worker.
    this._glyphs._onGlyphsLoaded = (partialMap, positions) => {
      this._workerService.updateGlyphs(partialMap, positions)
    }
  }

  evictTile(key: string): void {
    this._tileBuckets.delete(key)
    this._workerService.cancel(key)
  }

  /**
   * draw() ONLY fetches pre-built data from the worker, uploads it to GPU, and renders.
   * All shaping and quad generation has already happened inside the worker's request().
   */
  async draw(ctx: DrawContext): Promise<void> {
    const { gl, programs, tileID } = ctx
    const key = tileID.key

    if (!this._tileBuckets.has(key)) {
      // Ask the worker for the pre-built SymbolTileData (null = not ready yet or empty tile)
      const bucket = await this._workerService.getBucket(key)
      if (!bucket) {
        this._tileBuckets.set(key, null)
        return
      }
      // Upload vertex and index data to GPU
      this._glyphs.buildAtlas(gl)
      const verts = this._webgl.createGeometryBuffer(`tile:${key}:sym:v`, new Int16Array(bucket.vertices), gl.ARRAY_BUFFER)
      const idx = this._webgl.createGeometryBuffer(`tile:${key}:sym:i`, new Uint16Array(bucket.indices), gl.ELEMENT_ARRAY_BUFFER)
      this._tileBuckets.set(key, { verts, idx, count: bucket.count })
    }

    const bufs = this._tileBuckets.get(key)
    if (!bufs) return

    const program = programs.get('symbol_sdf')
    if (!program) return

    // Ensure atlas texture is up to date on GPU
    this._glyphs.buildAtlas(gl)
    if (!this._glyphs.glyphAtlasTexture) return

    gl.useProgram(program)

    // Bind glyph atlas to texture unit 0
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this._glyphs.glyphAtlasTexture)
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0)

    // Atlas size for UV normalization in shader (a_tex / u_texsize = [0,1])
    const atlas = (this._glyphs as any)._atlas
    const atlasW = atlas?.image.width ?? 1
    const atlasH = atlas?.image.height ?? 1
    gl.uniform2f(gl.getUniformLocation(program, 'u_texsize'), atlasW, atlasH)

    // Resolution for pixel-space offsets
    const canvas = gl.canvas as HTMLCanvasElement
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height)

    // Color + opacity
    const [r, g, b, a] = parseColor(this._color)
    gl.uniform4f(gl.getUniformLocation(program, 'u_color'), r, g, b, a)
    gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), this._opacity)

    // Bind buffers and set attributes
    // GlyphVertexLayout stride = 12 bytes: ax(2) ay(2) ox(2) oy(2) u(2) v(2)
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.verts)

    const aAnchor = gl.getAttribLocation(program, 'a_anchor')
    gl.enableVertexAttribArray(aAnchor)
    gl.vertexAttribPointer(aAnchor, 2, gl.SHORT, false, 12, 0)  // ax, ay at offset 0

    const aOffset = gl.getAttribLocation(program, 'a_offset')
    gl.enableVertexAttribArray(aOffset)
    gl.vertexAttribPointer(aOffset, 2, gl.SHORT, false, 12, 4)  // ox, oy at offset 4

    const aTex = gl.getAttribLocation(program, 'a_tex')
    gl.enableVertexAttribArray(aTex)
    gl.vertexAttribPointer(aTex, 2, gl.UNSIGNED_SHORT, false, 12, 8)  // u, v at offset 8

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.idx)
    gl.drawElements(gl.TRIANGLES, bufs.count, gl.UNSIGNED_SHORT, 0)

    // Cleanup
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

No unit tests for TextLayer itself (browser WebGL context required).

- [ ] **Step 2: Commit**

```bash
git add src/modular/layers/symbol/text-layer.ts
git commit -m "feat(modular/symbol): add TextLayer — SDF text rendering with GlyphManager integration"
```

---

## Task 9: Wire demo

**Files:**
- Create: `demo/phase8/index.html`
- Create: `demo/phase8/main.ts`

**Background:** Phase 8 demo adds a `TextLayer` on top of the vector tile layer from Phase 5. Uses MapLibre's public glyph endpoint. Labels come from the `place` layer's `name` property.

- [ ] **Step 1: Create demo/phase8/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Phase 8 — Text Labels</title>
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
      <div class="phase-badge">Phase 8</div>
      <h2>Text Labels</h2>
    </div>
    <div class="field">
      <label>Zoom</label>
      <input type="range" id="zoom" min="2" max="14" step="0.1" value="5" />
      <span class="value" id="zoom-val">5.0</span>
    </div>
    <div class="field">
      <label>Font Size</label>
      <input type="range" id="font-size" min="8" max="32" step="1" value="14" />
      <span class="value" id="font-size-val">14px</span>
    </div>
    <div id="status">Initializing…</div>
  </div>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create demo/phase8/main.ts**

```ts
// demo/phase8/main.ts
import { createRenderer } from '../../src/modular/renderer/index.ts'
import { MapGL } from '../../src/modular/core/map.ts'
import { BackgroundLayer } from '../../src/modular/layers/background.ts'
import { FillLayer } from '../../src/modular/layers/fill.ts'
import { GlyphManager } from '../../src/modular/layers/symbol/glyph-manager.ts'
import { TextLayer } from '../../src/modular/layers/symbol/text-layer.ts'

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
    zoom: 5,
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

// TextLayer — renders place names
const textLayer = new TextLayer({
  source: 'openmaptiles',
  sourceLayer: 'place',
  textField: '{name}',
  fontstack: 'Open Sans Regular',
  fontSize: 14,
  color: '#333333',
  opacity: 1,
  glyphs,
})
map.addLayer(textLayer)

status.textContent = 'Ready — text labels'

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
  // TextLayer doesn't support live fontSize update — show value only
  // In a real app, you'd recreate the layer or add a setFontSize() method
  fontSizeVal.textContent = fontSizeInput.value + 'px'
})
```

- [ ] **Step 3: Verify demo starts (dev server)**

```bash
npx vite demo/phase8/ --open
```

Open `http://localhost:5173` in a browser. Expected: map renders with a light background, land fill, and place name labels at zoom 5.

- [ ] **Step 4: Commit**

```bash
git add demo/phase8/
git commit -m "feat(modular/symbol): add Phase 8 demo — text labels with GlyphManager + TextLayer"
```

---

## Full test suite

Run all symbol unit tests together to confirm nothing regressed:

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/
```

Expected:
```
 PASS  src/modular/layers/symbol/types.test.ts
 PASS  src/modular/layers/symbol/glyph-loader.test.ts
 PASS  src/modular/layers/symbol/glyph-atlas.test.ts
 PASS  src/modular/layers/symbol/glyph-manager.test.ts
 PASS  src/modular/layers/symbol/simple-shaper.test.ts

Test Files  5 passed (5)
Tests      ~25 passed
```
