# Symbol Layer Refactor: Vendor MapLibre Internals

**Date:** 2026-03-22
**Status:** Draft

## Problem

The symbol layer reimplements MapLibre's projection, placement, and collision logic from scratch. Every edge case MapLibre handles (label flipping, vertical glyphs, pitch correction, perpendicular offsets, projection caching) was marked as a STUB. We've been chasing these bugs one by one — each fix introduces new subtle mismatches.

The parts that work reliably are the ones that vendor or wrap MapLibre's actual code: `clip_line`, `merge_lines`, `shapeText`, `getAnchors`, `getGlyphQuads`.

## Principle

**Vendor the algorithms. Own the architecture.**

- **Vendored (MapLibre's code, verbatim):** projection, placement, collision, cross-tile index, grid index, shaping, quads, anchors. Bugs here are MapLibre's bugs — we stay in sync, not in competition.
- **Our architecture:** How these pieces are wired — the SymbolEngine plugin, worker boundaries, tree-shakable layer imports, the renderer API. MapGL core remains completely agnostic to symbol code.

## Architecture

### Boundary: MapGL Core vs Symbol Plugin

```
MapGL Core (symbol-agnostic)
├── MapGL, CameraController, RendererAPI
├── Projection (Mercator, Globe)
├── Tile management, source loading
└── Render loop (beforeTiles → layers → afterTiles)

Symbol Plugin (all symbol knowledge lives here)
├── SymbolEngine (plugin on renderer)
│   ├── CrossTileIndex (vendored)
│   ├── Placement / CollisionIndex (vendored)
│   └── GridIndex (vendored)
├── Layers (tree-shakable imports)
│   ├── LineTextLayer
│   ├── TextLayer
│   └── IconLayer
├── Workers (layout in background thread)
│   └── SymbolWorkerLine, SymbolWorkerPoint
└── Vendor (MapLibre code, minimal modifications)
    ├── projection.ts
    ├── collision_index.ts
    ├── cross_tile_symbol_index.ts
    ├── placement.ts
    ├── grid_index.ts
    ├── symbol_size.ts
    ├── clip_line.ts, merge_lines.ts (already vendored)
    ├── symbol_layout.ts helpers (already wrapped)
    └── anchor.ts, check_max_angle.ts, etc.
```

### What Gets Vendored (replacing reimplementations)

| Current File | Lines | Replaces With | MapLibre Source |
|---|---|---|---|
| `line-projection.ts` | 250 | Vendored projection | `symbol/projection.ts` |
| `vendor/collision_index.ts` | 202 | Vendored collision | `symbol/collision_index.ts` |
| `vendor/grid_index.ts` | 415 | Vendored grid | `symbol/grid_index.ts` |
| `engine/cross-tile-index.ts` | 252 | Vendored cross-tile | `symbol/cross_tile_symbol_index.ts` |
| `engine/layout-engine.ts` | 71 | Vendored placement | `symbol/placement.ts` |
| *(missing)* | — | Vendored symbol_size | `symbol/symbol_size.ts` |

### What Stays (our architecture)

| File | Purpose | Changes |
|---|---|---|
| `engine/symbol-engine.ts` | Plugin registering on renderer, owns placement/collision lifecycle | Adapts to vendored Placement API |
| `base/symbol-layer-base.ts` | Abstract base for symbol layers | Adapts to vendored placement results |
| `base/tile-fetcher.ts` | Async tile state machine | No change |
| `line-text-layer.ts` | Line label layer class, shader, GPU upload | Uses vendored projection |
| `workers/symbol-worker-line.ts` | Worker layout pipeline | Produces StructArray-compatible data |
| `glyph-manager.ts`, `glyph-loader.ts` | Glyph loading/caching | No change |
| `types.ts` | Type definitions | Align with vendored types |

## Data Type Adaptation: StructArray

MapLibre's vendored code operates on `StructArray` subclasses with generated accessors — `PlacedSymbolArray`, `GlyphOffsetArray`, `SymbolLineVertexArray`, `CollisionBoxArray`, etc. These use typed array views with named getters like `getoffsetX(i)`, `getanchorX(i)`.

We have our own `StructArray` system in `src/modular/core/struct-array.ts` with `defineStruct`. Strategy:

1. **Extend our struct-builder** to generate named accessor methods matching MapLibre's API. For each field `foo`, generate `getfoo(index)` and `setfoo(index, value)` on the struct array instance.

2. **Define equivalent struct schemas** for each MapLibre StructArray type used by vendored code:
   - `PlacedSymbolStruct` — anchorX, anchorY, glyphStartIndex, numGlyphs, segment, lineStartIndex, lineLength, crossTileID, etc.
   - `GlyphOffsetStruct` — offsetX
   - `SymbolLineVertexStruct` — x, y, tileUnitDistanceFromAnchor
   - `CollisionBoxStruct` — x1, y1, x2, y2, anchorPointX, anchorPointY, etc.
   - `DynamicLayoutStruct` — ax, ay, angle

3. **Workers produce these StructArrays** instead of plain objects. The worker output becomes transferable ArrayBuffers that the main thread wraps in StructArray instances — matching MapLibre's worker→main thread transfer pattern.

4. **SymbolBucket adapter** — a lightweight class that bundles the StructArrays (text/icon placed symbols, line vertices, glyph offsets, collision boxes, dynamic layout) into the shape vendored Placement/projection code expects. This is NOT a reimplementation of MapLibre's SymbolBucket — it's a data container with the same field names.

### SymbolProjectionContext

MapLibre's projection functions expect a `SymbolProjectionContext` containing:
- `transform`: projects tile coords to clip/label plane (`projectTileCoordinates`, `calculatePosMatrix`, `width`, `height`, `cameraToCenterDistance`, `pitch`, `angle`)
- `tileAnchorPoint`: anchor position in tile coords
- `lineVertexArray`: StructArray of line vertices
- `pitchedLabelPlaneMatrix`: mat4 for pitch-with-map labels
- `projectionCache`: cached projected vertices and offsets per bucket
- `translation`: tile translation offset
- `unwrappedTileID`: tile identifier for projection

We build a transform adapter that satisfies this interface using our tile matrix and viewport state.

### Placement Wiring

MapLibre's `Placement` constructor takes `(transform, fadeDuration, crossSourceCollisions, prevPlacement)`. Its main method `placeLayerBucketPart(bucketPart)` expects a `BucketPart` containing a `SymbolBucket` and tile information.

`SymbolEngine._beforeTiles()` wiring:
1. Create a `Placement` instance with our transform adapter
2. For each symbol layer, for each visible tile:
   - Get the SymbolBucket adapter (populated by worker)
   - Create a `BucketPart` wrapping the bucket + tile ID
   - Call `placeLayerBucketPart(bucketPart)`
3. After all parts placed, call `placement.commit(prevPlacement)`
4. Apply opacity results to layers

## Vendoring Strategy

### Modifications Allowed

1. **Import path adjustments** — point to local vendor copies
2. **Type narrowing** — accept narrower interfaces instead of `Painter`, `Style`, `Transform` (define the minimal interface each vendored file needs)
3. **STUB unsupported paths** — globe-specific paths, terrain RTT, 3D features get stubbed (not removed) with `// STUB:` comments explaining what's missing
4. **Small utility vendoring** — `findLineIntersection` and other utils imported by vendored code

### Modifications NOT Allowed

- Reimplementing algorithms differently
- Changing control flow or logic
- "Simplifying" edge case handling
- Removing features because "we don't need them yet"

### Sync Strategy

Vendored files include a header comment:
```ts
// Vendored from maplibre-gl-js <commit-hash>
// Source: src/symbol/projection.ts
// Modifications: import paths, type narrowing
```

## Implementation Phases

Each phase is independently testable and shippable.

### Phase 1: Projection (replaces line-projection.ts)

**Dependencies:** SymbolLineVertexArray struct, transform adapter
**Vendors:** `projection.ts`, `symbol_size.ts`
**Test:** Same anchors + same tile matrix → identical glyph screen positions as MapLibre
**Risk:** Low — projection is relatively standalone

### Phase 2: Collision (replaces simplified collision_index + grid_index)

**Dependencies:** CollisionBox struct
**Vendors:** `collision_index.ts`, `grid_index.ts`
**Test:** Same collision boxes + same viewport → identical placement decisions
**Risk:** Low — collision is self-contained

### Phase 3: Cross-tile index (replaces simplified cross-tile-index.ts)

**Dependencies:** PlacedSymbol struct with crossTileID
**Vendors:** `cross_tile_symbol_index.ts`
**Test:** Same labels across zoom levels → identical crossTileID assignment
**Risk:** Medium — interacts with tile lifecycle

### Phase 4: Placement (replaces layout-engine.ts)

**Dependencies:** Phases 1-3, SymbolBucket adapter, BucketPart adapter
**Vendors:** `placement.ts`
**Test:** Full pipeline — same tile + same viewport → identical visible labels as MapLibre
**Risk:** High — largest vendored file, most dependencies, most complex wiring

### Phase 5: Worker StructArray output

**Dependencies:** Phase 4 working
**Refactors:** Worker produces StructArrays (PlacedSymbolArray, GlyphOffsetArray, etc.) instead of plain objects, matching MapLibre's worker→main thread transfer
**Test:** Full round-trip — worker layout → placement → projection → identical to MapLibre

## Testing Strategy

Tests compare our output against MapLibre's original pipeline output for the same input:

1. **Layout parity**: Same tile + same glyphs → identical anchor count and positions
2. **Projection parity**: Same anchors + same tile matrix → identical glyph screen positions
3. **Collision parity**: Same labels + same viewport → identical visibility decisions (with matching layer priority order)
4. **Snapshot tests**: Real tile data (versatiles-14-8414-5384.pbf) with real glyphs — regression tests against known-good output from MapLibre's pipeline

Reference data is generated by running MapLibre's original code in the test harness, then snapshotted for regression. Each test runs both pipelines and asserts equality.

Tests that pass but don't catch visual bugs are worse than no tests.

## Out of Scope

These features exist in the vendored code but are not wired up or tested. The code is retained per the "no removal" vendoring policy, but not exercised:

- Globe projection (vendor Mercator paths only for now)
- Terrain elevation (getElevation returns 0)
- Icon placement (focus on text first)
- Variable anchor placement
- RTL text support
