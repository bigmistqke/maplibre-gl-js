# Cross-Tile Symbol Deduplication — Design Spec

## Overview

Prevent duplicate labels across tile boundaries by assigning persistent `crossTileID`s to symbols that represent the same text at the same position. The LayoutEngine uses these IDs to skip duplicates during collision placement.

**Goals:**
- Same label text at same position shown only once, even when multiple tiles contain it
- Persistent IDs across zoom levels (parent→child matching) for future opacity fade support
**Non-goals:**
- Opacity fade transitions using crossTileIDs (STUB — binary 0/1 for now)
- Antimeridian wrap handling (STUB)
- KDBush spatial index (STUB — linear search for now, add when performance requires it)

---

## How MapLibre Does It

1. Each symbol gets a `key` (murmur3 hash of rendered text) at layout time
2. `CrossTileSymbolIndex` maintains a spatial index per zoom level per layer
3. When a new tile arrives, its symbols are matched against existing tiles:
   - Same zoom: match by key + position within 4px tolerance
   - Parent zoom: match against parent tile with scaled tolerance
   - Child zoom: match against child tiles
4. Matched symbols get the same `crossTileID`; unmatched get new IDs
5. Placement skips symbols whose `crossTileID` was already placed

**Why position rounding:** Symbols at the same real-world location may have slightly different tile-local coordinates depending on which tile they fall in. Rounding to a ~4px grid makes matching robust.

**Why KDBush:** When a text key has >128 symbols (e.g., "Street" appears everywhere), linear search is O(n²). KDBush provides O(n log n) spatial range queries.

**Why cross-zoom matching:** When zooming from z5 to z6, the z5 tile's "Germany" label and the z6 tile's "Germany" label are the same symbol. Assigning them the same ID enables smooth opacity transitions (the new tile's label inherits the old tile's fade state instead of popping in).

---

## Architecture

### Data Flow

```
Worker (layout time):
  For each label: return text string alongside position
  → SymbolTileData.labelTexts: string[]

SymbolEngine.beforeTiles (per frame):
  1. CrossTileIndex.update(layers, visibleTiles)
     - For each layer's tile buckets:
       - Hash label texts → keys
       - Match against existing tiles (same zoom, parent, child)
       - Assign crossTileIDs
     - Remove stale tile indexes
  2. LayoutEngine.runPlacement(ctx, layers)
     - Skip labels whose crossTileID was already placed
```

### Components

#### CrossTileIndex (`engine/cross-tile-index.ts`)

Adapted from MapLibre's `CrossTileSymbolIndex`. One instance per `SymbolEngine`.

```ts
class CrossTileIndex {
  /** Assign crossTileIDs for all visible tiles across all layers */
  update(layers: PlaceableLayer[], visibleTiles: TileID[]): void

  /** Remove indexes for tiles no longer visible */
  pruneStale(visibleTiles: TileID[]): void
}
```

Internally maintains:
- `_indexes: Map<number, Map<string, TileSymbolIndex>>` — keyed by zoom → tileKey
- `_nextID: number` — monotonic ID generator

#### TileSymbolIndex

Per-tile spatial index of symbols, grouped by text key.

```ts
class TileSymbolIndex {
  constructor(tileID: TileID, labels: LabelData[])

  /** Find matches for symbols from another tile */
  findMatches(
    labels: LabelData[],
    sourceTileID: TileID,
    zoomCrossTileIDs: Set<number>,
  ): void
}
```

Each text key maps to a position array with linear search.

```
// STUB: KDBush — MapLibre uses KDBush for >128 symbols per key for O(n log n)
//       range queries. Linear search is fine for our current data volumes.
```

#### LabelData

What the CrossTileIndex needs per label:

```ts
type LabelData = {
  key: number          // murmur3 hash of text
  anchorX: number      // tile-local position
  anchorY: number
  crossTileID: number  // 0 = unassigned, >0 = assigned
}
```

This is stored per tile per layer, managed by the layer (not the worker). The layer builds it from `labelPositions` + `labelTexts` when a tile is uploaded.

#### LayoutEngine Change

Add `crossTileID` awareness to placement:

```ts
runPlacement(ctx, layers, visibleKeys) {
  const seenCrossTileIDs = new Set<number>()

  for (const layer of layers) {
    for (const bucket of layer.getCollisionData(ctx, visibleKeys)) {
      for (let i = 0; i < bucket.anchors.length; i++) {
        const crossTileID = bucket.crossTileIDs[i]

        // Skip if this crossTileID was already placed by another tile
        if (crossTileID > 0 && seenCrossTileIDs.has(crossTileID)) {
          opacity[i] = 0
          continue
        }

        // ... existing collision logic ...

        if (crossTileID > 0) seenCrossTileIDs.add(crossTileID)
      }
    }
  }
}
```

#### CollisionData Extension

Add optional `crossTileIDs` to `CollisionData`:

```ts
type CollisionData = {
  tileKey: string
  anchors: Array<{ x: number; y: number }>
  boxes: Array<[number, number, number, number]>
  /** Persistent IDs for cross-tile dedup. Parallel with anchors. */
  crossTileIDs: number[]
}
```

#### Worker Change

Add `labelTexts` to `SymbolTileData`:

```ts
type SymbolTileData = {
  // ... existing fields ...
  /** Raw text strings per label, parallel with labelPositions. For cross-tile dedup keying. */
  labelTexts?: string[]
}
```

Workers already have the text — they just need to include it in the output.

#### SymbolLayerBase / Subclass Changes

Each layer stores `LabelData[]` per tile (built from worker's `labelPositions` + `labelTexts`). The `getCollisionData()` method includes `crossTileIDs` in its output after the CrossTileIndex has run.

---

## What Gets Changed

| File | Change |
|------|--------|
| `src/modular/layers/symbol/engine/cross-tile-index.ts` | **NEW**: CrossTileIndex + TileSymbolIndex |
| `src/modular/layers/symbol/engine/cross-tile-index.test.ts` | **NEW**: unit tests |
| `src/modular/layers/symbol/engine/symbol-engine.ts` | Add CrossTileIndex, call update in beforeTiles |
| `src/modular/layers/symbol/engine/layout-engine.ts` | Skip already-seen crossTileIDs |
| `src/modular/layers/symbol/base/types.ts` | Add `crossTileIDs?` to CollisionData |
| `src/modular/layers/symbol/types.ts` | Add `labelTexts?` to SymbolTileData |
| `src/modular/layers/symbol/workers/symbol-worker-point.ts` | Return labelTexts |
| `src/modular/layers/symbol/workers/symbol-worker-line.ts` | Return labelTexts |
| `src/modular/layers/symbol/text-layer.ts` | Store LabelData, include crossTileIDs in collision data |
| `src/modular/layers/symbol/line-text-layer.ts` | Same |

---

## STUB Registry

| STUB | Where | What MapLibre does | Why |
|------|-------|--------------------|-----|
| Opacity fade via crossTileID | LayoutEngine | Previous placement's opacity state keyed by crossTileID enables smooth fade | Visual: labels fade in/out instead of popping |
| Antimeridian wrap | CrossTileIndex | Adjusts wrap values when user pans across date line | Correctness: prevents ID mismatches at ±180° |
| KDBush spatial index | TileSymbolIndex | Uses KDBush for >128 symbols per key | Performance: O(n log n) vs O(n²) for dense keys like "Street" |
