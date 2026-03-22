# Symbol Vendor Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace reimplemented symbol internals (projection, collision, placement, cross-tile index) with vendored MapLibre code, keeping the modular architecture.

**Architecture:** Vendor MapLibre's symbol algorithms verbatim (import path + type narrowing modifications only). Extend our StructArray builder with MapLibre-compatible typed array views and alignment. Wire vendored code through SymbolEngine plugin — MapGL core stays symbol-agnostic.

**Tech Stack:** TypeScript, gl-matrix, @mapbox/point-geometry, vitest, MapLibre GL JS source (at `/Users/puckey/rg/maplibre-gl-js`)

**Spec:** `docs/superpowers/specs/2026-03-22-symbol-vendor-refactor-design.md`

**Vendoring rule:** Every vendored file gets a header:
```ts
// Vendored from maplibre-gl-js <commit-hash>
// Source: src/symbol/<filename>.ts
// Modifications: import paths, type narrowing, STUB comments
```

**Parity test methodology:** Import the original MapLibre function AND the vendored function. Feed identical inputs. Assert identical outputs. If a test only checks internal consistency (not against MapLibre-original), it is incomplete.

---

## Phase 0: StructArray Extension

Our `src/modular/core/struct-array.ts` needs three capabilities to support vendored MapLibre code:

1. **Typed array views** (`int16`, `uint16`, `uint32`, `float32`) over the underlying buffer, with alignment padding in the struct stride
2. **Named accessors** (`get<field>(index)`, `get(index).field`)
3. **Lifecycle methods** (`clear()`, `resize()`, `emplace()`, `_trim()`)

MapLibre's generated Struct classes access `this._structArray.int16[this._pos2 + N]` — this requires the struct stride to be padded to alignment boundaries and the StructArray to expose typed array overlays.

### Task 0.1: Add alignment padding and typed array views

**Files:**
- Modify: `src/modular/core/struct-array.ts`
- Modify: `src/modular/core/struct-array.test.ts`

- [ ] **Step 1: Write failing test for typed array views**

```ts
it('exposes int16/uint16/uint32/float32 typed array views', () => {
  const layout = defineStruct({ x: 'int16', y: 'int16', dist: 'float32' })
  const arr = new StructArray(layout)
  arr.emplaceBack(100, 200, 42.5)
  expect(arr.int16).toBeInstanceOf(Int16Array)
  expect(arr.float32).toBeInstanceOf(Float32Array)
})

it('pads stride to align to largest member type', () => {
  // int16(2) + int16(2) + float32(4) = 8 bytes, aligned to 4 = stride 8
  const layout = defineStruct({ x: 'int16', y: 'int16', dist: 'float32' })
  expect(layout.stride).toBe(8) // must be multiple of 4 (float32 alignment)
})

it('typed array views index correctly with alignment', () => {
  const layout = defineStruct({ x: 'int16', y: 'int16', dist: 'float32' })
  const arr = new StructArray(layout)
  arr.emplaceBack(100, 200, 42.5)
  arr.emplaceBack(300, 400, 99.0)
  // int16 view: stride/2 = 4 int16s per element
  expect(arr.int16[0]).toBe(100) // x of element 0
  expect(arr.int16[1]).toBe(200) // y of element 0
  expect(arr.int16[4]).toBe(300) // x of element 1
  // float32 view: stride/4 = 2 float32s per element
  expect(arr.float32[1]).toBeCloseTo(42.5) // dist of element 0
  expect(arr.float32[3]).toBeCloseTo(99.0) // dist of element 1
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.config.modular.ts src/modular/core/struct-array.test.ts`

- [ ] **Step 3: Implement alignment padding in `defineStruct` and typed array views on `StructArray`**

`defineStruct` must:
- Compute field offsets with alignment (each field aligned to its own size)
- Pad stride to be a multiple of the largest field type's byte size

`StructArray` must:
- Expose `int16`, `uint16`, `uint32`, `float32` getters that return typed array views over `_buf`
- Refresh views after `_grow()`

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

### Task 0.2: Add `get<field>(index)` and `set<field>(index, value)` accessors

**Files:**
- Modify: `src/modular/core/struct-array.ts`
- Modify: `src/modular/core/struct-array.test.ts`

- [ ] **Step 1: Write failing test**

```ts
it('generates get<field>(index) accessors', () => {
  const layout = defineStruct({ offsetX: 'float32' })
  const arr = new StructArray(layout)
  arr.emplaceBack(42.5)
  arr.emplaceBack(99.0)
  expect(arr.getoffsetX(0)).toBeCloseTo(42.5)
  expect(arr.getoffsetX(1)).toBeCloseTo(99.0)
})

it('generates set<field>(index, value) mutators', () => {
  const layout = defineStruct({ offsetX: 'float32' })
  const arr = new StructArray(layout)
  arr.emplaceBack(0)
  arr.setoffsetX(0, 42.5)
  expect(arr.getoffsetX(0)).toBeCloseTo(42.5)
})
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement by defining methods on the StructArray instance after construction**

For each field `foo` in the schema, define `get<foo>(index): number` and `set<foo>(index, value): void` using the typed array views (e.g., `this.float32[index * (stride/4) + fieldPos4]`).

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

### Task 0.3: Add `get(index)` struct accessor returning proxy object

MapLibre's `PlacedSymbolArray.get(i)` returns a struct object with property getters/setters (e.g., `get(i).anchorX`, `get(i).hidden = true`).

**Files:**
- Modify: `src/modular/core/struct-array.ts`
- Modify: `src/modular/core/struct-array.test.ts`

- [ ] **Step 1: Write failing test**

```ts
it('get(index) returns object with field getters/setters', () => {
  const layout = defineStruct({
    anchorX: 'int16', anchorY: 'int16', hidden: 'uint8',
  })
  const arr = new StructArray(layout)
  arr.emplaceBack(100, 200, 0)
  const s = arr.get(0)
  expect(s.anchorX).toBe(100)
  expect(s.anchorY).toBe(200)
  expect(s.hidden).toBe(0)
  s.hidden = 1
  expect(arr.get(0).hidden).toBe(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement `get(index)` with getter/setter properties backed by the ArrayBuffer**

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

### Task 0.4: Add `clear()`, `resize()`, `emplace()`, `_trim()`

**Files:**
- Modify: `src/modular/core/struct-array.ts`
- Modify: `src/modular/core/struct-array.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
it('clear() resets length to 0', () => {
  const layout = defineStruct({ offsetX: 'float32' })
  const arr = new StructArray(layout)
  arr.emplaceBack(1); arr.emplaceBack(2)
  expect(arr.length).toBe(2)
  arr.clear()
  expect(arr.length).toBe(0)
})

it('resize(n) sets length and allocates capacity', () => {
  const layout = defineStruct({ offsetX: 'float32' })
  const arr = new StructArray(layout)
  arr.resize(100)
  expect(arr.length).toBe(100)
})

it('emplace(i, ...values) writes at arbitrary index', () => {
  const layout = defineStruct({ x: 'int16', y: 'int16' })
  const arr = new StructArray(layout)
  arr.resize(3)
  arr.emplace(1, 42, 99)
  expect(arr.getx(1)).toBe(42)
  expect(arr.gety(1)).toBe(99)
})

it('_trim() shrinks buffer to fit length', () => {
  const layout = defineStruct({ x: 'float32' })
  const arr = new StructArray(layout)
  arr.resize(1000)
  arr.length = 5
  arr._trim()
  expect(arr.arrayBuffer.byteLength).toBe(5 * layout.stride)
})
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

---

## Phase 0.5: Narrow Type Interfaces

Define minimal interfaces for MapLibre types that vendored code depends on. These let us type-narrow `Painter`, `Tile`, `StyleLayer`, `FeatureIndex` etc. without importing MapLibre's full class hierarchy.

### Task 0.5.1: Define narrow interfaces

**Files:**
- Create: `src/modular/layers/symbol/vendor/types.ts`

- [ ] **Step 1: Define `ISymbolTransform`**

Minimal interface for `IReadonlyTransform` as used by projection.ts and placement.ts:

```ts
export interface ISymbolTransform {
  width: number
  height: number
  cameraToCenterDistance: number
  pitch: number
  angle: number // bearing in radians
  zoom: number
  calculatePosMatrix(unwrappedTileID: UnwrappedTileIDLike): mat4
  projectTileCoordinates(x: number, y: number, unwrappedTileID: UnwrappedTileIDLike, getElevation: (x: number, y: number) => number): PointProjection
}
```

- [ ] **Step 2: Define `ISymbolTile`, `ISymbolStyleLayer`, `IFeatureIndex`**

Minimal interfaces with only the fields vendored placement.ts accesses.

- [ ] **Step 3: Define `UnwrappedTileIDLike`, `PointProjection`**

Structural types that satisfy vendored code without importing MapLibre's tile_id.ts.

- [ ] **Step 4: Commit**

---

## Phase 1: Vendor Projection

Replace `line-projection.ts` with vendored `projection.ts` from MapLibre.

### Task 1.1: Define symbol StructArray schemas

Define the StructArray layouts that projection.ts needs: `SymbolLineVertexArray`, `GlyphOffsetArray`, `SymbolDynamicLayoutArray`.

**Files:**
- Create: `src/modular/layers/symbol/vendor/symbol_structs.ts`
- Test: `src/modular/layers/symbol/vendor/symbol_structs.test.ts`

- [ ] **Step 1: Write failing tests for each schema**

Test `emplaceBack` → typed array view access matches expected values. Test field count and stride match MapLibre's definitions:
- `SymbolLineVertexLayout`: x(int16), y(int16), tileUnitDistanceFromAnchor(int16) → 6 bytes
- `GlyphOffsetLayout`: offsetX(float32) → 4 bytes
- `DynamicLayoutLayout`: ax(float32), ay(float32), angle(float32) → 12 bytes

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Define schemas**

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

### Task 1.2: Implement TransformAdapter — interface and properties

**Files:**
- Create: `src/modular/layers/symbol/vendor/transform_adapter.ts`
- Test: `src/modular/layers/symbol/vendor/transform_adapter.test.ts`

- [ ] **Step 1: Write failing tests for transform properties**

```ts
it('exposes cameraToCenterDistance from viewport height', () => {
  const adapter = new TransformAdapter(camera, viewport, tileID)
  expect(adapter.cameraToCenterDistance).toBeCloseTo(expectedValue)
})

it('exposes width/height from viewport', () => {
  const adapter = new TransformAdapter(camera, viewport, tileID)
  expect(adapter.width).toBe(512)
  expect(adapter.height).toBe(512)
})

it('exposes pitch and angle in radians', () => {
  const adapter = new TransformAdapter({ ...camera, pitch: 45, bearing: 90 }, viewport, tileID)
  expect(adapter.pitch).toBeCloseTo(45 * Math.PI / 180)
  expect(adapter.angle).toBeCloseTo(-90 * Math.PI / 180)
})
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement TransformAdapter properties**

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

### Task 1.3: Implement TransformAdapter — `projectTileCoordinates`

**Files:**
- Modify: `src/modular/layers/symbol/vendor/transform_adapter.ts`
- Modify: `src/modular/layers/symbol/vendor/transform_adapter.test.ts`

- [ ] **Step 1: Write failing tests comparing against MapLibre's MercatorTransform**

```ts
it('projectTileCoordinates matches MapLibre for tile center', () => {
  const adapter = new TransformAdapter(camera, viewport, tileID)
  const result = adapter.projectTileCoordinates(2048, 2048, unwrappedTileID, () => 0)
  // Compare against MapLibre's MercatorTransform.projectTileCoordinates
  // for the same input
  expect(result.point.x).toBeCloseTo(expectedClipX, 3)
  expect(result.point.y).toBeCloseTo(expectedClipY, 3)
  expect(result.signedDistanceFromCamera).toBeGreaterThan(0)
})

it('projectTileCoordinates correct at tile edges', () => { ... })
it('signedDistanceFromCamera correct for perspective ratio', () => { ... })
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement using our tile matrix math**

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

### Task 1.4: Implement TransformAdapter — `calculatePosMatrix`

**Files:**
- Modify: `src/modular/layers/symbol/vendor/transform_adapter.ts`
- Modify: `src/modular/layers/symbol/vendor/transform_adapter.test.ts`

- [ ] **Step 1: Write failing test**

Test that `calculatePosMatrix(unwrappedTileID)` returns a mat4 matching our `getTileMatrix` output for the same tile.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Run test, commit**

### Task 1.5: Vendor utility functions

**Files:**
- Create: `src/modular/layers/symbol/vendor/util.ts`

- [ ] **Step 1: Copy `findLineIntersection` from `/Users/puckey/rg/maplibre-gl-js/src/util/util.ts`**

- [ ] **Step 2: Copy `addDynamicAttributes` from `/Users/puckey/rg/maplibre-gl-js/src/data/bucket/symbol_bucket.ts:145-150`**

Adapt to use our DynamicLayoutArray.

- [ ] **Step 3: Copy `translatePosition` and `warnOnce` from `/Users/puckey/rg/maplibre-gl-js/src/util/util.ts`**

These are needed by placement.ts later, but vendor them now.

- [ ] **Step 4: Copy `pixelsToTileUnits` from `/Users/puckey/rg/maplibre-gl-js/src/source/pixels_to_tile_units.ts`**

- [ ] **Step 5: Commit**

### Task 1.6: Vendor symbol_size.ts

**Files:**
- Create: `src/modular/layers/symbol/vendor/symbol_size.ts`

- [ ] **Step 1: Copy from `/Users/puckey/rg/maplibre-gl-js/src/symbol/symbol_size.ts`**

Adjust import paths. STUB style evaluation dependencies with `// STUB:` comments — keep `evaluateSizeForZoom` and `evaluateSizeForFeature` signatures intact.

- [ ] **Step 2: Verify it compiles**

- [ ] **Step 3: Commit**

### Task 1.7: Vendor projection.ts — copy and fix imports

**Files:**
- Create: `src/modular/layers/symbol/vendor/projection.ts`

- [ ] **Step 1: Copy from `/Users/puckey/rg/maplibre-gl-js/src/symbol/projection.ts`**

Add vendoring header.

- [ ] **Step 2: Adjust all import paths to point to local vendor copies**

Replace `../data/bucket/symbol_bucket` → local util for `addDynamicAttributes`.
Replace `../geo/transform_interface` → local `types.ts` for `ISymbolTransform`.
Replace `../data/array_types.g` → local `symbol_structs.ts`.
Replace `../util/util` → local `util.ts`.
Replace `../source/tile_id` → local `types.ts`.
Replace `../util/struct_array` → local struct-array.
Replace `./symbol_size` → local `symbol_size.ts`.
Replace `./shaping` → import from existing MapLibre source (already used by symbol_layout_helpers).

- [ ] **Step 3: Define narrow `PainterLike` interface replacing `Painter` type**

projection.ts uses `painter.transform` and `painter.width/height`. Define a minimal interface.

- [ ] **Step 4: STUB globe-specific code paths**

Add `// STUB: globe projection` to globe-related branches.

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

### Task 1.8: Write projection parity test

**Files:**
- Create: `src/modular/layers/symbol/vendor/projection.test.ts`

- [ ] **Step 1: Write test that runs BOTH MapLibre-original and vendored projection on same input**

Use the test tile fixture + real glyph snapshot. For each label:
- Build SymbolLineVertexArray + GlyphOffsetArray from snapshot data
- Build SymbolProjectionContext using TransformAdapter
- Call vendored `placeGlyphAlongLine` for each glyph
- Import MapLibre's original `placeGlyphAlongLine` directly from `/Users/puckey/rg/maplibre-gl-js/src/symbol/projection.ts`
- Assert positions and angles match exactly

- [ ] **Step 2: Run test — should pass since both use same algorithm**

- [ ] **Step 3: Commit**

### Task 1.9: Wire vendored projection into LineTextLayer

**Note:** Vendored `updateLineLabels` expects a `SymbolBucket` interface. Until Phase 4 provides the full adapter, create a minimal shim that wraps our current `LineLabelInfo[]` data into the shape `updateLineLabels` expects. This shim will be removed in Phase 5.

**Files:**
- Modify: `src/modular/layers/symbol/line-text-layer.ts`
- Create: `src/modular/layers/symbol/vendor/bucket_shim.ts` (temporary, removed in Phase 5)

- [ ] **Step 1: Create bucket shim that wraps LineLabelInfo[] into the StructArrays updateLineLabels expects**

- [ ] **Step 2: Replace `updateLineLabels` import with vendored projection**

- [ ] **Step 3: Run all modular tests**

Run: `npx vitest run --config vitest.config.modular.ts`

- [ ] **Step 4: Take screenshot, compare with original**

Run: `npm run demo open phase10-roads/modular` → zoom 14 → screenshot
Visual check: labels flip correctly, no upside-down text, vertical lines handled.

- [ ] **Step 5: Commit**

---

## Phase 2: Vendor Collision

Replace simplified `collision_index.ts` and `grid_index.ts` with vendored MapLibre versions.

### Task 2.1: Vendor grid_index.ts

**Files:**
- Replace: `src/modular/layers/symbol/vendor/grid_index.ts`

- [ ] **Step 1: Copy from `/Users/puckey/rg/maplibre-gl-js/src/symbol/grid_index.ts`**

Add vendoring header. Adjust import paths. This file is mostly self-contained.

- [ ] **Step 2: Write parity test**

Import both MapLibre's original `GridIndex` and our vendored copy. Insert same boxes, query same regions. Assert identical results.

- [ ] **Step 3: Commit**

### Task 2.2: Define CollisionBox StructArray schema

**Files:**
- Modify: `src/modular/layers/symbol/vendor/symbol_structs.ts`
- Modify: `src/modular/layers/symbol/vendor/symbol_structs.test.ts`

- [ ] **Step 1: Add CollisionBoxLayout (9 fields, 20 bytes)**

```ts
export const CollisionBoxLayout = defineStruct({
  anchorPointX: 'int16', anchorPointY: 'int16',
  x1: 'int16', y1: 'int16', x2: 'int16', y2: 'int16',
  featureIndex: 'uint32',
  sourceLayerIndex: 'uint16', bucketIndex: 'uint16',
})
```

- [ ] **Step 2: Test round-trip**

- [ ] **Step 3: Commit**

### Task 2.3: Vendor collision_index.ts

**Files:**
- Replace: `src/modular/layers/symbol/vendor/collision_index.ts` (existing 202-line simplified version → full MapLibre version)

- [ ] **Step 1: Copy from `/Users/puckey/rg/maplibre-gl-js/src/symbol/collision_index.ts`**

Add vendoring header. Replace `IReadonlyTransform` with `ISymbolTransform`. STUB terrain elevation paths with `// STUB: terrain elevation`.

- [ ] **Step 2: Write parity test**

Import MapLibre's original `CollisionIndex`. Feed same collision boxes + same transform. Assert `placeCollisionBox` returns identical results.

- [ ] **Step 3: Commit**

---

## Phase 3: Vendor Cross-Tile Index

### Task 3.1: Define SymbolInstance StructArray schema

**Files:**
- Modify: `src/modular/layers/symbol/vendor/symbol_structs.ts`
- Modify: `src/modular/layers/symbol/vendor/symbol_structs.test.ts`

- [ ] **Step 1: Add SymbolInstanceLayout (28 fields, 64 bytes)**

All fields from MapLibre's `symbol_instance` definition in `symbol_attributes.ts:78-107`.

- [ ] **Step 2: Test `get(i)` accessor returns all fields correctly**

- [ ] **Step 3: Commit**

### Task 3.2: Vendor cross_tile_symbol_index.ts

**Files:**
- Create: `src/modular/layers/symbol/vendor/cross_tile_symbol_index.ts`
- Delete: `src/modular/layers/symbol/engine/cross-tile-index.ts` (old reimplementation)

- [ ] **Step 1: Copy from `/Users/puckey/rg/maplibre-gl-js/src/symbol/cross_tile_symbol_index.ts`**

Add vendoring header. Adjust import paths.

- [ ] **Step 2: Write parity test**

Import MapLibre's original `CrossTileSymbolIndex`. Feed same symbol data across zoom levels. Assert identical `crossTileID` assignments.

- [ ] **Step 3: Commit**

---

## Phase 4: Vendor Placement

### Task 4.1: Define PlacedSymbol and remaining StructArray schemas

**Files:**
- Modify: `src/modular/layers/symbol/vendor/symbol_structs.ts`
- Modify: `src/modular/layers/symbol/vendor/symbol_structs.test.ts`

- [ ] **Step 1: Add PlacedSymbolLayout (17 fields, 48 bytes)**

All fields from MapLibre's `placement` definition in `symbol_attributes.ts:58-76`.

- [ ] **Step 2: Add TextAnchorOffsetLayout, CollisionVertexLayout, OpacityLayout**

- [ ] **Step 3: Test all schemas with round-trip emplaceBack → get**

- [ ] **Step 4: Commit**

### Task 4.2: Create SymbolBucket adapter

**Files:**
- Create: `src/modular/layers/symbol/vendor/symbol_bucket_adapter.ts`
- Test: `src/modular/layers/symbol/vendor/symbol_bucket_adapter.test.ts`

- [ ] **Step 1: Define SymbolBucketAdapter class**

Must satisfy the interface vendored Placement expects:
- `symbolInstances: SymbolInstanceArray`
- `text: { placedSymbolArray, dynamicLayoutVertexArray, opacityVertexArray }`
- `icon: { placedSymbolArray, dynamicLayoutVertexArray, opacityVertexArray }`
- `glyphOffsetArray: GlyphOffsetArray`
- `lineVertexArray: SymbolLineVertexArray`
- `collisionBoxArray: CollisionBoxArray`
- `textCollisionBox`, `iconCollisionBox` containers
- `overscaling`, `tilePixelRatio`, `textSizeData`
- `addToLineVertexArray()` method

- [ ] **Step 2: Write test that constructs adapter and verifies field shapes**

- [ ] **Step 3: Commit**

### Task 4.3: Vendor placement.ts secondary dependencies

**Files:**
- Create: `src/modular/layers/symbol/vendor/overlap_mode.ts`
- Create: `src/modular/layers/symbol/vendor/variable_text_anchor.ts`

- [ ] **Step 1: Copy `getOverlapMode` from `/Users/puckey/rg/maplibre-gl-js/src/style/style_layer/overlap_mode.ts`**

- [ ] **Step 2: Copy `TextAnchorEnum` from `/Users/puckey/rg/maplibre-gl-js/src/style/style_layer/variable_text_anchor.ts`**

- [ ] **Step 3: Copy `getAnchorJustification` from `/Users/puckey/rg/maplibre-gl-js/src/symbol/symbol_layout.ts`**

- [ ] **Step 4: Copy `getAnchorAlignment` from `/Users/puckey/rg/maplibre-gl-js/src/symbol/shaping.ts`**

(Note: WritingMode is already available via our existing symbol_layout_helpers vendored shaping import.)

- [ ] **Step 5: Commit**

### Task 4.4: Vendor placement.ts — copy and fix imports

**Files:**
- Create: `src/modular/layers/symbol/vendor/placement.ts`

- [ ] **Step 1: Copy from `/Users/puckey/rg/maplibre-gl-js/src/symbol/placement.ts`**

Add vendoring header.

- [ ] **Step 2: Adjust import paths to point to local vendor copies**

- [ ] **Step 3: Replace `Tile`, `StyleLayer`, `FeatureIndex` with narrow interfaces from `types.ts`**

- [ ] **Step 4: STUB terrain-specific paths**

- [ ] **Step 5: Verify it compiles**

- [ ] **Step 6: Commit**

### Task 4.5: Wire vendored Placement into SymbolEngine

**Files:**
- Modify: `src/modular/layers/symbol/engine/symbol-engine.ts`
- Delete: `src/modular/layers/symbol/engine/layout-engine.ts` (old reimplementation)

- [ ] **Step 1: Replace LayoutEngine with vendored Placement**

In `_beforeTiles()`:
1. Create `Placement` with TransformAdapter
2. For each symbol layer, call `getBucketParts` to get BucketPart array
3. For each BucketPart, call `placeLayerBucketPart`
4. Call `placement.commit(now)` with current timestamp
5. Call `placement.updateLayerOpacities` for each layer

- [ ] **Step 2: Run all modular tests**

- [ ] **Step 3: Take screenshot, compare collision/overlap behavior with original**

- [ ] **Step 4: Commit**

---

## Phase 5: Worker StructArray Output + Wiring

### Task 5.1: Refactor worker to produce GlyphOffsetArray and SymbolLineVertexArray

**Files:**
- Modify: `src/modular/layers/symbol/workers/symbol-worker-line.ts`

- [ ] **Step 1: Replace `glyphOffsets: number[]` with GlyphOffsetArray**

- [ ] **Step 2: Replace `lineVertices: number[]` with SymbolLineVertexArray (using `addToLineVertexArray` pattern)**

- [ ] **Step 3: Run tests, commit**

### Task 5.2: Refactor worker to produce PlacedSymbolArray and SymbolInstanceArray

**Files:**
- Modify: `src/modular/layers/symbol/workers/symbol-worker-line.ts`

- [ ] **Step 1: Populate PlacedSymbolArray with anchor, glyph indices, segment, line offsets**

- [ ] **Step 2: Populate SymbolInstanceArray with collision box indices, crossTileID**

- [ ] **Step 3: Run tests, commit**

### Task 5.3: Refactor worker to produce CollisionBoxArray

**Files:**
- Modify: `src/modular/layers/symbol/workers/symbol-worker-line.ts`

- [ ] **Step 1: Generate collision boxes per symbol matching MapLibre's format**

- [ ] **Step 2: Run tests, commit**

### Task 5.4: Update line-text-layer.ts to use SymbolBucketAdapter

**Files:**
- Modify: `src/modular/layers/symbol/line-text-layer.ts`
- Delete: `src/modular/layers/symbol/vendor/bucket_shim.ts` (temporary from Task 1.9)

- [ ] **Step 1: Construct SymbolBucketAdapter from worker StructArray output**

- [ ] **Step 2: Pass adapter to vendored `updateLineLabels` and `Placement`**

- [ ] **Step 3: Run all tests**

- [ ] **Step 4: Commit**

### Task 5.5: Delete old reimplementations

**Files:**
- Delete: `src/modular/layers/symbol/line-projection.ts`
- Delete: `src/modular/layers/symbol/line-projection.test.ts`
- Delete: `src/modular/layers/symbol/engine/layout-engine.ts`
- Delete: `src/modular/layers/symbol/engine/cross-tile-index.ts` (if not already deleted in Phase 3)
- Update: any remaining imports

- [ ] **Step 1: Remove files, update imports**

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run --config vitest.config.modular.ts`
Expected: All tests pass.

- [ ] **Step 3: Final screenshot comparison**

Take screenshots at zoom 14 and zoom 15 for both `phase10-roads/original` and `phase10-roads/modular`. Compare label density, flipping, collision, and vertical text.

- [ ] **Step 4: Commit**

---

## Phase 6: Cleanup and Documentation

### Task 6.1: Generate regression snapshot from MapLibre-original

**Files:**
- Create or update: `test/unit/assets/line-label-snapshot.json`

- [ ] **Step 1: Run MapLibre's full pipeline on test tile, capture output**

Snapshot includes: anchor positions, glyph screen positions, visibility decisions, crossTileIDs.

- [ ] **Step 2: Write automated regression test asserting vendored pipeline matches snapshot**

- [ ] **Step 3: Commit**

### Task 6.2: Update STATUS.md

- [ ] **Step 1: Check off completed items, note vendored projection/collision/placement**

- [ ] **Step 2: Remove resolved STUB comments from codebase**

- [ ] **Step 3: Commit**
