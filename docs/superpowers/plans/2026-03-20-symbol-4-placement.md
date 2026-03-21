# Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add collision-aware label placement as an optional plugin. Without Placement, symbols render at full opacity; with it, overlapping labels fade out gracefully.

**Architecture:** PlacementParticipant is a compile-time-only duck-typed interface. Placement plugin runs beforeTiles each frame, traverses map layers, and uses CollisionIndex (adapted from MapLibre) to determine which labels are visible.

**Tech Stack:** TypeScript strict, Vitest (unit), adapted MapLibre collision_index + grid_index

**Spec:** `docs/superpowers/specs/2026-03-20-symbol-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/modular/core/placement-participant.ts` | Create | Compile-time duck-typed interface |
| `src/modular/core/placement-participant.test.ts` | Create | Type-level compile test |
| `src/modular/layers/symbol/vendor/grid_index.ts` | Create | Verbatim copy from MapLibre |
| `src/modular/layers/symbol/vendor/grid_index.test.ts` | Create | Unit test: insert + hitTest |
| `src/modular/layers/symbol/vendor/collision_index.ts` | Create | Adapted: remove clip_line/path_interpolator imports |
| `src/modular/layers/symbol/vendor/collision_index.test.ts` | Create | Unit test: basic box placement |
| `src/modular/layers/symbol/placement.ts` | Create | Placement plugin (beforeTiles hook) |
| `src/modular/layers/symbol/text-layer.ts` | Edit | Implement PlacementParticipant |
| `src/modular/layers/symbol/icon-layer.ts` | Edit | Implement PlacementParticipant |
| `demo/phase9/index.html` | Create | Phase 9 demo page |
| `demo/phase9/main.ts` | Create | Phase 9 demo script |

---

## Task 1: PlacementParticipant interface

**Files:**
- Create: `src/modular/core/placement-participant.ts`
- Create: `src/modular/core/placement-participant.test.ts`

### What `SymbolBucketData` is

A lightweight descriptor for one tile's worth of placed symbol data. It carries the tile key (for opacity lookup), the label anchor positions in screen-space, and bounding boxes for collision testing. Placement reads from it; layers produce it.

```ts
export type SymbolBucketData = {
  /** Tile cache key — used by Placement to key per-label opacity state */
  tileKey: string
  /** Label anchors in screen pixels, one entry per placed label */
  anchors: Array<{ x: number; y: number }>
  /** Axis-aligned bounding boxes in screen pixels — [x1, y1, x2, y2] per label */
  boxes: Array<[number, number, number, number]>
}
```

`anchors` and `boxes` are parallel arrays — `anchors[i]` and `boxes[i]` describe the same label.

- [ ] **Step 1: Create `src/modular/core/placement-participant.ts`**

```ts
// src/modular/core/placement-participant.ts
// Compile-time only — erased at runtime. Zero bundle cost when unused.

export type SymbolBucketData = {
  /** Tile cache key — used by Placement to key per-label opacity state */
  tileKey: string
  /** Label anchor centres in screen pixels, one per placed label */
  anchors: Array<{ x: number; y: number }>
  /** Screen-pixel AABBs [x1, y1, x2, y2] per label — parallel with anchors */
  boxes: Array<[number, number, number, number]>
}

export interface PlacementParticipant {
  getSymbolBuckets(): SymbolBucketData[]
  setOpacity(tileKey: string, opacity: Float32Array): void
}
```

- [ ] **Step 2: Create `src/modular/core/placement-participant.test.ts`**

```ts
// Compile-time only — just verify structural compatibility
import type { PlacementParticipant, SymbolBucketData } from './placement-participant.ts'
import { describe, it, expectTypeOf } from 'vitest'

describe('PlacementParticipant', () => {
  it('accepts a structurally compatible object', () => {
    const participant = {
      getSymbolBuckets: (): SymbolBucketData[] => [],
      setOpacity: (_key: string, _opacity: Float32Array) => {},
    }
    expectTypeOf(participant).toMatchTypeOf<PlacementParticipant>()
  })
})
```

- [ ] **Step 3: Run the test**

```
npx vitest run --config vitest.config.unit.ts src/modular/core/placement-participant.test.ts
```

- [ ] **Step 4: Commit**

Commit message: `feat(modular/placement): add PlacementParticipant interface`

---

## Task 2: Vendor grid_index.ts (verbatim copy)

**Files:**
- Create: `src/modular/layers/symbol/vendor/grid_index.ts`
- Create: `src/modular/layers/symbol/vendor/grid_index.test.ts`

### Source

Copy verbatim from `/Users/puckey/rg/maplibre-gl-js/src/symbol/grid_index.ts`.

The only change needed is fixing the import path. The source imports:
```ts
import type {OverlapMode} from '../style/style_layer/overlap_mode';
```
Replace with an inline definition to keep the vendor file self-contained and avoid pulling in MapLibre's style system:
```ts
// Inlined from MapLibre — avoids dependency on style_layer package
export type OverlapMode = 'never' | 'always' | 'cooperative'
```

Everything else is copied verbatim.

- [ ] **Step 1: Create `src/modular/layers/symbol/vendor/grid_index.ts`**

Copy the full file from `/Users/puckey/rg/maplibre-gl-js/src/symbol/grid_index.ts`, replacing the `OverlapMode` import with the inline type above. Export `OverlapMode` from this file so `collision_index.ts` can import it from here instead of from the MapLibre style package.

- [ ] **Step 2: Create `src/modular/layers/symbol/vendor/grid_index.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { GridIndex } from './grid_index.ts'

describe('GridIndex', () => {
  it('inserts a box and finds it with hitTest', () => {
    const grid = new GridIndex<{ overlapMode: 'never' }>(100, 100, 10)
    grid.insert({ overlapMode: 'never' }, 10, 10, 30, 30)
    expect(grid.hitTest(15, 15, 25, 25, 'never')).toBe(true)
  })

  it('returns false for non-overlapping query', () => {
    const grid = new GridIndex<{ overlapMode: 'never' }>(100, 100, 10)
    grid.insert({ overlapMode: 'never' }, 10, 10, 30, 30)
    expect(grid.hitTest(50, 50, 70, 70, 'never')).toBe(false)
  })

  it('allows overlap when overlapMode is always', () => {
    const grid = new GridIndex<{ overlapMode: 'always' | 'never' }>(100, 100, 10)
    grid.insert({ overlapMode: 'never' }, 10, 10, 30, 30)
    // 'always' overlap mode ignores existing 'never' entries
    expect(grid.hitTest(15, 15, 25, 25, 'always')).toBe(false)
  })

  it('reports keysLength after insert', () => {
    const grid = new GridIndex<{ overlapMode: 'never' }>(100, 100, 10)
    grid.insert({ overlapMode: 'never' }, 0, 0, 10, 10)
    grid.insertCircle({ overlapMode: 'never' }, 50, 50, 5)
    expect(grid.keysLength()).toBe(2)
  })
})
```

- [ ] **Step 3: Run the test**

```
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/vendor/grid_index.test.ts
```

- [ ] **Step 4: Commit**

Commit message: `feat(modular/placement): vendor grid_index verbatim from MapLibre`

---

## Task 3: Vendor collision_index.ts (adapted)

**Files:**
- Create: `src/modular/layers/symbol/vendor/collision_index.ts`
- Create: `src/modular/layers/symbol/vendor/collision_index.test.ts`

### What to adapt

The upstream `src/symbol/collision_index.ts` has two static imports that bring in line-placement machinery out of scope for Plan 4:

```ts
import {clipLine} from './clip_line';
import {PathInterpolator} from './path_interpolator';
```

These are only used in the circle-based path-label placement code paths (`placeCollisionCircles`, `_insertCollisionCircles`). Remove both imports and stub out any method bodies that reference `clipLine` or `PathInterpolator` with a `throw new Error('line placement not supported in Plan 4')` guard, or simply remove those methods if they are not called by the box-based path (`placeCollisionBox`/`insertCollisionBox`).

Additionally, the upstream file imports several MapLibre-internal types that do not exist in this codebase:

| Upstream import | Action |
|---|---|
| `IReadonlyTransform` from `'../geo/transform_interface'` | Replace with a minimal local interface (see below) |
| `SingleCollisionBox` from `'../data/bucket/symbol_bucket'` | Replace with a minimal local type |
| `GlyphOffsetArray`, `SymbolLineVertexArray` from `'../data/array_types.g'` | Only referenced in circle methods — remove with those methods |
| `OverlapMode` from `'../style/style_layer/overlap_mode'` | Import from `./grid_index.ts` (our vendor copy) |
| `OverscaledTileID`, `UnwrappedTileID` from `'../source/tile_id'` | Replace with minimal local types |
| `PointProjection`, `SymbolProjectionContext`, `getTileSkewVectors`, etc. from `'../symbol/projection'` | Only used in circle methods — remove with those methods |
| `clamp`, `getAABB` from `'../util/util'` | Inline tiny implementations |
| `Bounds` from `'../geo/bounds'` | Only used in circle methods — remove |
| `mat4`, `vec4` from `'gl-matrix'` | Keep — gl-matrix is already a project dependency |
| `Point` from `'@mapbox/point-geometry'` | Keep — already a project dependency |
| `intersectionTests` from `'../util/intersection_tests'` | Keep — copy verbatim from MapLibre or inline |

### Minimal replacement types

```ts
// Minimal stand-in for IReadonlyTransform — only the fields CollisionIndex uses
type SimpleTransform = {
  width: number
  height: number
  cameraToCenterDistance: number
  pitch: number  // radians
  zoom: number
}

// Minimal stand-in for SingleCollisionBox
type SimpleCollisionBox = {
  x1: number; y1: number; x2: number; y2: number
  padding: number
}
```

Check the `placeCollisionBox` and `insertCollisionBox` methods in the source to confirm these fields suffice. If additional fields are accessed, add them.

### Methods to keep (box-based placement only)

- `constructor`
- `placeCollisionBox`
- `insertCollisionBox`
- `queryRenderedSymbols` (optional — keep if it doesn't depend on line types)

### Methods to remove or stub (circle / line path placement)

- `placeCollisionCircles`
- `_insertCollisionCircles`
- Any private helpers called only from those methods

- [ ] **Step 1: Create `src/modular/layers/symbol/vendor/collision_index.ts`**

Copy the full upstream file, then apply the adaptations described above:
1. Remove `import {clipLine} from './clip_line'` and `import {PathInterpolator} from './path_interpolator'`
2. Replace MapLibre-internal type imports with minimal local types
3. Import `OverlapMode` from `./grid_index.ts`
4. Remove circle/line-path methods
5. Inline `clamp` and `getAABB` as local helpers
6. Copy or inline `intersection_tests` (it is small — check the source)

- [ ] **Step 2: Create `src/modular/layers/symbol/vendor/collision_index.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { CollisionIndex } from './collision_index.ts'

// Minimal transform satisfying SimpleTransform
const makeTransform = (w = 800, h = 600) => ({
  width: w,
  height: h,
  cameraToCenterDistance: 500,
  pitch: 0,
  zoom: 5,
})

describe('CollisionIndex', () => {
  it('constructs without error', () => {
    const ci = new CollisionIndex(makeTransform())
    expect(ci).toBeTruthy()
  })

  it('allows placing a non-overlapping box', () => {
    const ci = new CollisionIndex(makeTransform())
    const box = { x1: 100, y1: 100, x2: 200, y2: 150, padding: 0 }
    const result = ci.placeCollisionBox(box, 'never', 0, 0, 1)
    expect(result.placeable).toBe(true)
  })

  it('detects overlap after insertion', () => {
    const ci = new CollisionIndex(makeTransform())
    const box = { x1: 100, y1: 100, x2: 200, y2: 150, padding: 0 }
    const key = { bucketInstanceId: 0, featureIndex: 0, collisionGroupID: 0, overlapMode: 'never' as const }
    ci.insertCollisionBox([100, 100, 200, 150], 'never', key)
    const result2 = ci.placeCollisionBox(
      { x1: 120, y1: 110, x2: 180, y2: 140, padding: 0 },
      'never', 0, 0, 1,
    )
    expect(result2.placeable).toBe(false)
  })
})
```

- [ ] **Step 3: Run the test**

```
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/vendor/collision_index.test.ts
```

- [ ] **Step 4: Commit**

Commit message: `feat(modular/placement): vendor collision_index adapted from MapLibre (box-only)`

---

## Task 4: Placement plugin

**Files:**
- Create: `src/modular/layers/symbol/placement.ts`

No unit tests — this is a render-loop integration that requires a live WebGL context and the full renderer stack. Validated in the demo (Task 7).

### Design

`Placement` is added via `map.addPlugin(new Placement())`. It provides a `renderExtension` with a `beforeTiles` hook. Each frame:

1. Create a fresh `CollisionIndex` using current canvas dimensions and camera state
2. Traverse `map.getLayers()` (accessed via the `renderer` passed in `onAdd`) and duck-type for `PlacementParticipant` (check `typeof layer.getSymbolBuckets === 'function'`)
3. For each participating layer, call `layer.getSymbolBuckets()` to get `SymbolBucketData[]`
4. For each bucket, iterate `boxes`, call `collisionIndex.placeCollisionBox(...)` to test placement, then `collisionIndex.insertCollisionBox(...)` if placed
5. Build a `Float32Array` of opacity values (1 = placed, 0 = rejected — could animate over frames in a future plan) per bucket
6. Call `layer.setOpacity(tileKey, opacityArray)` so the layer can use it in `draw()`

### Access to `getLayers`

`getLayers()` is currently a test-helper method on the concrete `Renderer` class (not on `RendererAPI`). The `Placement` plugin receives the renderer in `onAdd(map, renderer)`. It needs to cast to access `getLayers`:

```ts
onAdd(map: MapGL, renderer: RendererAPI): void {
  this._renderer = renderer as unknown as { getLayers(): LayerInstance[] }
}
```

This is an intentional loose coupling — `Placement` does not import the concrete `Renderer` type.

### Camera state to CollisionIndex

`CollisionIndex` needs a transform with `width`, `height`, `cameraToCenterDistance`, `pitch`, and `zoom`. These are available from `RenderContext.camera` in the `beforeTiles` hook (check `CameraState` in `src/modular/core/types.ts` for the field names and compute `cameraToCenterDistance` from `canvas.height / (2 * Math.tan(fov / 2))` with a default fov of 0.6435 radians, or pass canvas dimensions and camera zoom directly).

- [ ] **Step 1: Create `src/modular/layers/symbol/placement.ts`**

```ts
// src/modular/layers/symbol/placement.ts
import type { RenderContext } from '../../core/render-extension.ts'
import type { RenderExtension } from '../../core/render-extension.ts'
import type { RendererAPI, LayerInstance } from '../../core/renderer-api.ts'
import type { MapGL } from '../../core/map.ts'
import type { PlacementParticipant } from '../../core/placement-participant.ts'
import { CollisionIndex } from './vendor/collision_index.ts'

function isParticipant(layer: LayerInstance): layer is LayerInstance & PlacementParticipant {
  return typeof (layer as any).getSymbolBuckets === 'function' &&
         typeof (layer as any).setOpacity === 'function'
}

export class Placement {
  private _renderer: { getLayers(): LayerInstance[] } | null = null

  readonly renderExtension: RenderExtension = {
    id: 'placement',
    beforeTiles: (ctx: RenderContext) => {
      if (!this._renderer) return
      this._runPlacement(ctx)
    },
  }

  onAdd(_map: MapGL, renderer: RendererAPI): void {
    this._renderer = renderer as unknown as { getLayers(): LayerInstance[] }
  }

  private _runPlacement(ctx: RenderContext): void {
    const { gl, camera } = ctx
    const canvas = (gl as WebGLRenderingContext).canvas as HTMLCanvasElement
    const w = canvas.width
    const h = canvas.height

    // Build a minimal transform for CollisionIndex
    // cameraToCenterDistance: distance in pixels from camera to map center plane
    // Approximated from canvas height and a default ~36.87° vertical fov
    const fov = 0.6435  // radians (~36.87°), matches MapLibre default
    const cameraToCenterDistance = h / (2 * Math.tan(fov / 2))
    const transform = {
      width: w,
      height: h,
      cameraToCenterDistance,
      pitch: (camera.pitch ?? 0) * Math.PI / 180,
      zoom: camera.zoom,
    }

    const ci = new CollisionIndex(transform)

    const layers = this._renderer!.getLayers()
    for (const layer of layers) {
      if (!isParticipant(layer)) continue
      const buckets = layer.getSymbolBuckets()
      for (const bucket of buckets) {
        const n = bucket.anchors.length
        const opacity = new Float32Array(n)
        for (let i = 0; i < n; i++) {
          const [x1, y1, x2, y2] = bucket.boxes[i]
          const box = { x1, y1, x2, y2, padding: 2 }
          const result = ci.placeCollisionBox(box, 'never', 0, 0, 1)
          if (result.placeable) {
            ci.insertCollisionBox(
              [x1, y1, x2, y2],
              'never',
              { bucketInstanceId: 0, featureIndex: i, collisionGroupID: 0, overlapMode: 'never' as const },
            )
            opacity[i] = 1
          } else {
            opacity[i] = 0
          }
        }
        layer.setOpacity(bucket.tileKey, opacity)
      }
    }
  }
}
```

- [ ] **Step 2: Verify type-check passes**

```
node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

Commit message: `feat(modular/placement): add Placement plugin with beforeTiles collision detection`

---

## Task 5: Update TextLayer to implement PlacementParticipant

**Files:**
- Edit: `src/modular/layers/symbol/text-layer.ts`

### Changes

1. Import `PlacementParticipant` and `SymbolBucketData` types from `../../core/placement-participant.ts`
2. Add `implements PlacementParticipant` to the class declaration (structural — TypeScript will verify)
3. Add per-tile opacity storage: `private _tileOpacity = new globalThis.Map<string, Float32Array>()`
4. Implement `getSymbolBuckets(): SymbolBucketData[]` — iterate `_tileBuckets`, convert `labelPositions` from tile coords to screen pixels (use the last-known camera/zoom from a stored `_lastCamera`), compute a fixed-size bounding box per label (e.g. `fontSize * 0.5` px half-width, `fontSize * 0.6` px half-height as a reasonable approximation), and return the array
5. Implement `setOpacity(tileKey: string, opacity: Float32Array): void` — store in `_tileOpacity`
6. In `draw()`: if `_tileOpacity` has an entry for this tile, use it to set `u_opacity` per symbol instead of the static `this._opacity`. Since we draw all symbols in one `drawElements` call, the simplest approach for Plan 4 is to use the **minimum** opacity across all symbols in the tile as a tile-level opacity (this is a coarse approximation — per-symbol opacity requires instancing or a texture lookup, which is out of scope). A more correct approach is to write a uniform array and loop, but the simplest path is: if any label in the tile is placed, opacity = `this._opacity`; if all are rejected, opacity = 0

**Note on screen-space projection:** `getSymbolBuckets()` needs to project tile-coord label positions to screen pixels. `TextLayer.draw()` already calls into `ctx.camera` indirectly via the shader. For placement, a CPU-side approximation is acceptable: convert tile coords `(ax, ay)` in [0, 4096] to fractional tile position, then to Web Mercator, then project through the current viewport matrix. The simplest approximation: store the `DrawContext` camera from the last draw call in `this._lastCamera` and use the same projection math as the vertex shader (which is already implemented in the renderer's `vertexShaderPrelude`). For Plan 4, a rough screen-space estimate is fine — exact collision accuracy is a later concern.

- [ ] **Step 1: Add `_lastCamera` and `_lastCanvas` storage to TextLayer**

Add private fields:
```ts
private _lastCamera: import('../../core/types.ts').CameraState | null = null
private _lastCanvasWidth = 1
private _lastCanvasHeight = 1
```

At the top of `draw()`, capture the current camera:
```ts
this._lastCamera = ctx.camera  // if DrawContext exposes camera; otherwise store from RenderContext
this._lastCanvasWidth = (gl.canvas as HTMLCanvasElement).width
this._lastCanvasHeight = (gl.canvas as HTMLCanvasElement).height
```

**Check:** `DrawContext` (in `render-extension.ts`) does not currently expose `camera`. The `RenderContext` does. Add a `camera?: CameraState` field to `DrawContext` in `render-extension.ts`, or store the camera from `onAdd`/an `afterTiles` hook. The simplest fix: add `camera: CameraState` to `DrawContext` in the renderer's frame loop (it is already available there). Alternatively, expose it via the `renderer` reference that `TextLayer` already has from `onAdd`.

- [ ] **Step 2: Implement `getSymbolBuckets()`**

```ts
getSymbolBuckets(): SymbolBucketData[] {
  if (!this._lastCamera) return []
  const buckets: SymbolBucketData[] = []

  for (const [key, buf] of this._tileBuckets) {
    if (!buf) continue
    const workerBucket = this._workerService.getBucketSync?.(key)  // see note below
    if (!workerBucket) continue

    const anchors: { x: number; y: number }[] = []
    const boxes: [number, number, number, number][] = []
    const halfW = (this._fontSize * 0.5)
    const halfH = (this._fontSize * 0.6)

    for (const pos of workerBucket.labelPositions) {
      const screen = this._tileToScreen(key, pos.x, pos.y)
      anchors.push(screen)
      boxes.push([
        screen.x - halfW, screen.y - halfH,
        screen.x + halfW, screen.y + halfH,
      ])
    }
    buckets.push({ tileKey: key, anchors, boxes })
  }
  return buckets
}
```

**Note on `getBucketSync`:** `TextWorkerService.getBucket()` is a Comlink async call. For `getSymbolBuckets()` (called synchronously in `beforeTiles`), we need the cached data. Add a `getBucketSync(key: string): SymbolTileData | null` method to `TextWorkerService` that returns from a main-thread cache populated when `getBucket` resolves. `TextLayer.draw()` already stores resolved bucket data in `_tileBuckets` (the GPU buffer). Mirror the raw worker data into a `_workerCache = new Map<string, SymbolTileData>()` when the bucket first resolves.

**Tile-to-screen projection helper:**
```ts
private _tileToScreen(tileKey: string, tx: number, ty: number): { x: number; y: number } {
  // Parse z/x/y from tileKey (format: 'z/x/y')
  // Convert tile-local coords [0, 4096] to Web Mercator [0, 1]
  // Apply viewport transform using camera state
  // This is a simplified approximation suitable for Plan 4 collision boxes
  // ... implementation details below
}
```

The exact math for `_tileToScreen` mirrors the vertex shader's `projectTile()` function. Since the renderer's prelude is available (stored in `RendererAPI`), the cleanest approach is to expose a `projectTileCoord(tileID, x, y): {x, y}` method on `RendererAPI`. For Plan 4, a simpler approximation is fine:
1. Parse `z`, `x`, `y` from `tileKey` (`'z/x/y'` format — check actual key format in the renderer)
2. Convert tile-local coords to Web Mercator: `mercX = (x + tx/4096) / 2^z`, `mercY = (y + ty/4096) / 2^z`
3. Convert to screen pixels using the current zoom and camera center

- [ ] **Step 3: Implement `setOpacity()`**

```ts
private _tileOpacity = new globalThis.Map<string, Float32Array>()

setOpacity(tileKey: string, opacity: Float32Array): void {
  this._tileOpacity.set(tileKey, opacity)
}
```

In `evictTile()`, also delete from `_tileOpacity`:
```ts
this._tileOpacity.delete(key)
```

- [ ] **Step 4: Use opacity in draw()**

In `draw()`, after retrieving `bufs`, determine the effective opacity:
```ts
let effectiveOpacity = this._opacity
const placementOpacity = this._tileOpacity.get(key)
if (placementOpacity && placementOpacity.length > 0) {
  // Tile-level coarse fade: if any label placed, render at full configured opacity;
  // if all rejected, skip rendering entirely for this tile
  const anyPlaced = placementOpacity.some(v => v > 0)
  if (!anyPlaced) return
}
gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), effectiveOpacity)
```

- [ ] **Step 5: Verify type-check**

```
node_modules/.bin/tsc --noEmit
```

- [ ] **Step 6: Commit**

Commit message: `feat(modular/placement): TextLayer implements PlacementParticipant`

---

## Task 6: Update IconLayer to implement PlacementParticipant

**Files:**
- Edit: `src/modular/layers/symbol/icon-layer.ts`

### Changes

Same pattern as TextLayer. IconLayer already has `_tileBuffers` (GPU buffers) and `_workerService.getBucket()` for raw `IconTileData`.

Key difference from TextLayer: `IconTileData` does not currently have a `labelPositions` field. Add it:

```ts
// In src/modular/layers/symbol/icon-types.ts, update IconTileData:
export type IconTileData = {
  vertices: ArrayBuffer
  indices: ArrayBuffer
  count: number
  /** Anchor positions in tile coords, one per icon quad — for collision / placement */
  anchorPositions: { x: number; y: number }[]
}
```

Update `symbol-worker-icon.ts` to populate `anchorPositions` from the feature geometry when building quads. The anchor is the feature's first point coordinate in tile space (already available during quad generation).

Then in IconLayer:

1. Import `PlacementParticipant` and `SymbolBucketData`
2. Add `implements PlacementParticipant`
3. Add `_tileOpacity` map and `_workerCache` map
4. Implement `getSymbolBuckets()` — same pattern as TextLayer but using `anchorPositions` and icon half-dimensions from sprite data (or a fixed `16 × 16` pixel box for Plan 4)
5. Implement `setOpacity()` — store in `_tileOpacity`
6. In `draw()`: skip tile if all icons rejected, same coarse approach as TextLayer

- [ ] **Step 1: Update `IconTileData` in `icon-types.ts`**

Add `anchorPositions: { x: number; y: number }[]` field.

- [ ] **Step 2: Update `symbol-worker-icon.ts`**

Collect anchor positions during quad generation and include in returned `IconTileData`.

- [ ] **Step 3: Implement PlacementParticipant on IconLayer**

Follow the same pattern as Task 5. Use `16` as the default half-size for icon bounding boxes:
```ts
const halfSize = 16  // pixels — reasonable default for Plan 4
boxes.push([screen.x - halfSize, screen.y - halfSize, screen.x + halfSize, screen.y + halfSize])
```

- [ ] **Step 4: Verify type-check**

```
node_modules/.bin/tsc --noEmit
```

- [ ] **Step 5: Commit**

Commit message: `feat(modular/placement): IconLayer implements PlacementParticipant`

---

## Task 7: Demo wiring (phase9)

**Files:**
- Create: `demo/phase9/index.html`
- Create: `demo/phase9/main.ts`

This demo shows placement in action: text labels and icons rendered together, with the `Placement` plugin registered. Labels that overlap fade out (or are skipped in the coarse Plan 4 implementation).

- [ ] **Step 1: Create `demo/phase9/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Phase 9 — Placement</title>
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
      <h2>Placement</h2>
    </div>
    <div class="field">
      <label>Zoom</label>
      <input type="range" id="zoom" min="2" max="14" step="0.1" value="5" />
      <span class="value" id="zoom-val">5.0</span>
    </div>
    <div id="status">Initializing…</div>
  </div>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create `demo/phase9/main.ts`**

```ts
// demo/phase9/main.ts
import { createRenderer } from '../../src/modular/renderer/index.ts'
import { MapGL } from '../../src/modular/core/map.ts'
import { BackgroundLayer } from '../../src/modular/layers/background.ts'
import { FillLayer } from '../../src/modular/layers/fill.ts'
import { GlyphManager } from '../../src/modular/layers/symbol/glyph-manager.ts'
import { TextLayer } from '../../src/modular/layers/symbol/text-layer.ts'
import { Placement } from '../../src/modular/layers/symbol/placement.ts'

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

map.addSource('openmaptiles', {
  type: 'vector',
  url: 'https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf',
  minZoom: 0,
  maxZoom: 6,
})

map.addLayer(new FillLayer({
  source: 'openmaptiles',
  sourceLayer: 'countries',
  color: '#d4e8c2',
  opacity: 0.8,
}))

const glyphs = new GlyphManager({
  url: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
})

const textLayer = new TextLayer({
  source: 'openmaptiles',
  sourceLayer: 'place_labels',
  textField: '{name}',
  fontstack: 'Open Sans Regular',
  fontSize: 14,
  color: '#333333',
  glyphs,
})

// Register Placement plugin BEFORE layers — beforeTiles runs before draw()
map.addPlugin(new Placement())
map.addLayer(textLayer)

// Zoom slider
const zoomSlider = document.getElementById('zoom') as HTMLInputElement
const zoomVal = document.getElementById('zoom-val')!
zoomSlider.addEventListener('input', () => {
  const z = parseFloat(zoomSlider.value)
  zoomVal.textContent = z.toFixed(1)
  map.setCamera({ zoom: z })
})
map.on('move', (s: any) => {
  zoomSlider.value = String(s.zoom.toFixed(1))
  zoomVal.textContent = s.zoom.toFixed(1)
})

status.textContent = 'Ready'
```

- [ ] **Step 3: Open the demo in the browser**

```
npx vite demo/phase9
```

Verify:
- Map renders with background and fill layers
- Text labels appear on countries/places
- Zooming in shows more labels; zooming out drops overlapping ones (tile-level coarse fade)
- No console errors

- [ ] **Step 4: Commit**

Commit message: `feat(modular/placement): add phase9 demo with Placement plugin`

---

## Summary

| Task | Files | Tests |
|---|---|---|
| 1 — PlacementParticipant | `core/placement-participant.ts` + test | Vitest unit (type-level) |
| 2 — vendor/grid_index | `vendor/grid_index.ts` + test | Vitest unit |
| 3 — vendor/collision_index | `vendor/collision_index.ts` + test | Vitest unit |
| 4 — Placement plugin | `placement.ts` | Browser only |
| 5 — TextLayer participant | edit `text-layer.ts` | Browser (phase9 demo) |
| 6 — IconLayer participant | edit `icon-layer.ts` + `icon-types.ts` + `symbol-worker-icon.ts` | Browser (phase9 demo) |
| 7 — Demo | `demo/phase9/` | Manual |

### Key design decisions

- `getLayers()` is accessed via an `as unknown as` cast in `Placement.onAdd` — avoids importing the concrete `Renderer` class and keeps the plugin decoupled from the renderer implementation.
- Plan 4 uses tile-level coarse opacity (all-or-nothing per tile) to avoid the per-symbol instancing complexity. Per-symbol opacity with smooth fade-in is a follow-up.
- `getSymbolBuckets()` returns screen-space boxes computed from the last-known camera state. The approximation is sufficient for collision suppression at the tile level.
- `PlacementParticipant` is a TypeScript interface only — no `instanceof` check, no runtime registration. Duck-typing in `Placement._runPlacement` is the entire discovery mechanism.
