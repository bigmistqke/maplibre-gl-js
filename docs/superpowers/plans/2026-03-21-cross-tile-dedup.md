# Cross-Tile Symbol Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent duplicate labels across tile boundaries by assigning persistent crossTileIDs and skipping already-placed symbols during collision.

**Architecture:** `CrossTileIndex` maintains a per-zoom spatial index of symbols keyed by text hash. When tiles arrive, symbols are matched against existing tiles (same zoom, parent, child) using position tolerance. The `LayoutEngine` skips symbols whose crossTileID was already placed. Workers return label texts for hashing on the main thread.

**Tech Stack:** TypeScript strict, Vitest, `murmurhash-js` (already installed)

**Spec:** `docs/superpowers/specs/2026-03-21-cross-tile-dedup-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/modular/layers/symbol/engine/cross-tile-index.ts` | Create | CrossTileIndex + TileSymbolIndex |
| `src/modular/layers/symbol/engine/cross-tile-index.test.ts` | Create | Unit tests |
| `src/modular/layers/symbol/base/types.ts` | Modify | Add `crossTileIDs: number[]` to CollisionData |
| `src/modular/layers/symbol/types.ts` | Modify | Add `labelTexts?: string[]` to SymbolTileData |
| `src/modular/layers/symbol/engine/symbol-engine.ts` | Modify | Add CrossTileIndex, call update in beforeTiles |
| `src/modular/layers/symbol/engine/layout-engine.ts` | Modify | Skip already-seen crossTileIDs during placement |
| `src/modular/layers/symbol/workers/symbol-worker-point.ts` | Modify | Return labelTexts |
| `src/modular/layers/symbol/workers/symbol-worker-line.ts` | Modify | Return labelTexts |
| `src/modular/layers/symbol/text-layer.ts` | Modify | Store LabelData, include crossTileIDs in collision data |
| `src/modular/layers/symbol/line-text-layer.ts` | Modify | Same as text-layer |

---

### Task 1: Types — Add crossTileIDs to CollisionData + labelTexts to SymbolTileData

**Files:**
- Modify: `src/modular/layers/symbol/base/types.ts`
- Modify: `src/modular/layers/symbol/types.ts`

- [ ] **Step 1: Add crossTileIDs to CollisionData**

In `src/modular/layers/symbol/base/types.ts`, add to the `CollisionData` type:

```ts
export type CollisionData = {
  tileKey: string
  anchors: Array<{ x: number; y: number }>
  boxes: Array<[number, number, number, number]>
  /** Persistent IDs for cross-tile dedup. Parallel with anchors. */
  crossTileIDs: number[]
}
```

- [ ] **Step 2: Add labelTexts to SymbolTileData**

In `src/modular/layers/symbol/types.ts`, add to `SymbolTileData`:

```ts
  /** Raw text strings per label, parallel with labelPositions. For cross-tile dedup keying. */
  labelTexts?: string[]
```

- [ ] **Step 3: Fix compilation errors**

Adding `crossTileIDs` as required to `CollisionData` will break all `getCollisionData()` implementations. Temporarily add `crossTileIDs: []` (empty array) to each layer's return value — these will be properly populated in later tasks. Files to update:
- `src/modular/layers/symbol/text-layer.ts` — add `crossTileIDs: []` to the `buckets.push()` call
- `src/modular/layers/symbol/line-text-layer.ts` — same
- `src/modular/layers/symbol/icon-layer.ts` — same
- `src/modular/layers/symbol/base/symbol-layer-base.test.ts` — update test subclass's `getCollisionData` return
- `src/modular/layers/symbol/engine/layout-engine.test.ts` — update mock collision data

Mark each `crossTileIDs: []` with `// STUB: populated by CrossTileIndex`.

- [ ] **Step 4: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/
```

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/base/types.ts src/modular/layers/symbol/types.ts src/modular/layers/symbol/text-layer.ts src/modular/layers/symbol/line-text-layer.ts src/modular/layers/symbol/icon-layer.ts src/modular/layers/symbol/base/symbol-layer-base.test.ts src/modular/layers/symbol/engine/layout-engine.test.ts
git commit -m "feat(symbol): add crossTileIDs to CollisionData, labelTexts to SymbolTileData

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: CrossTileIndex Core

The heart of the dedup system. Adapted from MapLibre's `cross_tile_symbol_index.ts`.

**Files:**
- Create: `src/modular/layers/symbol/engine/cross-tile-index.ts`
- Create: `src/modular/layers/symbol/engine/cross-tile-index.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/modular/layers/symbol/engine/cross-tile-index.test.ts
import { describe, it, expect } from 'vitest'
import { CrossTileIndex, type LabelData } from './cross-tile-index.ts'
import type { TileID } from '../../../core/types.ts'

function makeTile(z: number, x: number, y: number): TileID {
  return { z, x, y, key: `${z}/${x}/${y}` }
}

function makeLabels(texts: string[], positions: Array<{ x: number; y: number }>): LabelData[] {
  return texts.map((text, i) => ({
    key: 0, // will be set by hashText in real code, but for tests we set manually
    anchorX: positions[i].x,
    anchorY: positions[i].y,
    crossTileID: 0,
  }))
}

// Helper: assign same key to labels with same text
function setKeys(labels: LabelData[], texts: string[]) {
  // Simple hash for testing: use charCodeAt sum
  for (let i = 0; i < labels.length; i++) {
    let h = 0
    for (let j = 0; j < texts[i].length; j++) h = (h * 31 + texts[i].charCodeAt(j)) | 0
    labels[i].key = h
  }
}

describe('CrossTileIndex', () => {
  it('assigns unique crossTileIDs to unmatched labels', () => {
    const index = new CrossTileIndex()
    const labels: LabelData[] = [
      { key: 1, anchorX: 100, anchorY: 100, crossTileID: 0 },
      { key: 2, anchorX: 200, anchorY: 200, crossTileID: 0 },
    ]
    const tile = makeTile(5, 10, 10)

    index.addTile('layer1', tile, labels)

    expect(labels[0].crossTileID).toBeGreaterThan(0)
    expect(labels[1].crossTileID).toBeGreaterThan(0)
    expect(labels[0].crossTileID).not.toBe(labels[1].crossTileID)
  })

  it('matches labels with same key and nearby position across tiles at same zoom', () => {
    const index = new CrossTileIndex()

    // Tile A has "Germany" at position (2048, 2048)
    const labelsA: LabelData[] = [{ key: 42, anchorX: 2048, anchorY: 2048, crossTileID: 0 }]
    const tileA = makeTile(5, 10, 10)
    index.addTile('layer1', tileA, labelsA)
    const idA = labelsA[0].crossTileID

    // Tile B (adjacent) has "Germany" at a position that maps to the same world location
    // At same zoom, the scaled coordinates should match within tolerance
    const labelsB: LabelData[] = [{ key: 42, anchorX: 2048, anchorY: 2048, crossTileID: 0 }]
    const tileB = makeTile(5, 11, 10)
    index.addTile('layer1', tileB, labelsB)

    // Different tiles, different local coords — but same key, so if world coords match, same ID
    // Note: whether they match depends on the coordinate scaling. At same zoom adjacent tiles,
    // anchorX=2048 in tile (10,10) and anchorX=2048 in tile (11,10) are DIFFERENT world positions.
    // So they should get DIFFERENT IDs.
    expect(labelsB[0].crossTileID).toBeGreaterThan(0)
    expect(labelsB[0].crossTileID).not.toBe(idA)
  })

  it('matches parent tile labels with child tile labels', () => {
    const index = new CrossTileIndex()

    // Parent tile z=5 has "Germany" at (2048, 2048)
    const parentLabels: LabelData[] = [{ key: 42, anchorX: 2048, anchorY: 2048, crossTileID: 0 }]
    const parentTile = makeTile(5, 10, 10)
    index.addTile('layer1', parentTile, parentLabels)
    const parentID = parentLabels[0].crossTileID

    // Child tile z=6 has "Germany" — its anchorX would be the parent's position
    // scaled to child tile coords. Parent (10,10) at z5 → child (20,20) at z6.
    // AnchorX 2048 in parent maps to anchorX 0 in child (20,20) at z6
    // (because parent tile covers 2 child tiles, so position 2048/4096 of parent = start of right child)
    const childLabels: LabelData[] = [{ key: 42, anchorX: 0, anchorY: 0, crossTileID: 0 }]
    const childTile = makeTile(6, 20, 20)
    index.addTile('layer1', childTile, childLabels)

    // Should inherit parent's crossTileID
    expect(childLabels[0].crossTileID).toBe(parentID)
  })

  it('assigns new IDs to labels that do not match any existing tile', () => {
    const index = new CrossTileIndex()

    const labels: LabelData[] = [{ key: 99, anchorX: 500, anchorY: 500, crossTileID: 0 }]
    index.addTile('layer1', makeTile(5, 10, 10), labels)

    expect(labels[0].crossTileID).toBeGreaterThan(0)
  })

  it('removeStaleTiles removes tiles not in the provided set', () => {
    const index = new CrossTileIndex()

    const labelsA: LabelData[] = [{ key: 1, anchorX: 100, anchorY: 100, crossTileID: 0 }]
    const labelsB: LabelData[] = [{ key: 2, anchorX: 200, anchorY: 200, crossTileID: 0 }]
    index.addTile('layer1', makeTile(5, 10, 10), labelsA)
    index.addTile('layer1', makeTile(5, 11, 10), labelsB)

    // Only keep tile 5/10/10
    index.removeStaleTiles('layer1', new Set(['5/10/10']))

    // Add a new tile — it should not match the removed tile's labels
    const labelsC: LabelData[] = [{ key: 2, anchorX: 200, anchorY: 200, crossTileID: 0 }]
    index.addTile('layer1', makeTile(5, 11, 10), labelsC)
    // Should get a new ID (the old one was removed)
    expect(labelsC[0].crossTileID).not.toBe(labelsB[0].crossTileID)
  })

  it('handles multiple layers independently', () => {
    const index = new CrossTileIndex()

    const labelsL1: LabelData[] = [{ key: 42, anchorX: 100, anchorY: 100, crossTileID: 0 }]
    const labelsL2: LabelData[] = [{ key: 42, anchorX: 100, anchorY: 100, crossTileID: 0 }]
    index.addTile('text', makeTile(5, 10, 10), labelsL1)
    index.addTile('line-text', makeTile(5, 10, 10), labelsL2)

    // Same key+position but different layers — should get different IDs
    expect(labelsL1[0].crossTileID).not.toBe(labelsL2[0].crossTileID)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/engine/cross-tile-index.test.ts
```

- [ ] **Step 3: Implement CrossTileIndex**

Read MapLibre's `cross_tile_symbol_index.ts` at `/Users/puckey/rg/maplibre-gl-js/src/symbol/cross_tile_symbol_index.ts` for reference. The implementation should:

1. Define `LabelData` type (key, anchorX, anchorY, crossTileID)
2. Implement `TileSymbolIndex`:
   - Constructor groups labels by key, rounds positions to ~4px grid (MapLibre: `512 / EXTENT / 2`)
   - `getScaledCoordinates()` converts label position from one tile's coordinate space to another's, accounting for zoom difference
   - `findMatches()` linear search within tolerance (same as MapLibre lines 143-161, skip the KDBush path)
3. Implement `CrossTileIndex`:
   - `_layerIndexes: Map<string, Map<number, Map<string, TileSymbolIndex>>>` — layerID → zoom → tileKey → index
   - `_nextID` monotonic counter
   - `addTile(layerID, tileID, labels)`:
     - Reset all labels' crossTileIDs to 0
     - Match against child tiles (higher zoom) and parent tiles (lower zoom)
     - Assign new IDs to unmatched labels
     - Store the TileSymbolIndex for future matching
   - `removeStaleTiles(layerID, activeTileKeys)`: remove indexes for tiles no longer visible

Key constants from MapLibre:
- `EXTENT = 4096` (tile coordinate extent)
- `roundingFactor = 512 / EXTENT / 2` ≈ 0.0625 (rounds to ~4px grid)
- Tolerance: `1` when matching against higher-zoom tiles, `Math.pow(2, zoomDiff)` for lower-zoom

For tile parent/child relationships:
- Parse z/x/y from tile key string
- Parent of tile `(z, x, y)` at zoom `pz` is `(pz, floor(x / 2^(z-pz)), floor(y / 2^(z-pz)))`
- Child test: tile `(cz, cx, cy)` is child of `(pz, px, py)` if `cz > pz && floor(cx / 2^(cz-pz)) === px && floor(cy / 2^(cz-pz)) === py`

```
// STUB: KDBush — MapLibre uses KDBush for >128 symbols per key.
//       Linear search is fine for current data volumes.
// STUB: Antimeridian wrap — MapLibre adjusts tile wrap values when
//       user pans across the date line. We don't handle wrapping yet.
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/engine/cross-tile-index.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/engine/cross-tile-index.ts src/modular/layers/symbol/engine/cross-tile-index.test.ts
git commit -m "feat(symbol): add CrossTileIndex — persistent IDs across tiles and zoom levels

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire CrossTileIndex into SymbolEngine + LayoutEngine

**Files:**
- Modify: `src/modular/layers/symbol/engine/symbol-engine.ts`
- Modify: `src/modular/layers/symbol/engine/layout-engine.ts`

- [ ] **Step 1: Read both files first**

- [ ] **Step 2: Add CrossTileIndex to SymbolEngine**

In `symbol-engine.ts`:

1. Import `CrossTileIndex`
2. Add `readonly crossTile: CrossTileIndex` property, initialized in constructor
3. In `_beforeTiles()`, before calling `layout.runPlacement()`, call the cross-tile update.

The engine needs to pass each layer's label data through the cross-tile index. The interface between layers and the cross-tile index needs a new method on `PlaceableLayer`:

```ts
// Add to PlaceableLayer interface in layout-engine.ts:
export interface PlaceableLayer {
  id?: string
  getCollisionData(ctx: RenderContext, visibleKeys: ReadonlySet<string>): CollisionData[]
  setLabelOpacity(tileKey: string, opacity: Float32Array): void
  /** Return label data for cross-tile dedup. Called before collision. */
  getLabelData(): Map<string, LabelData[]>  // tileKey → labels
}
```

In `_beforeTiles()`:
```ts
// Before placement, run cross-tile dedup
for (const layer of ordered) {
  const layerID = layer.id ?? 'unknown'
  const labelDataMap = layer.getLabelData()
  const activeTileKeys = new Set<string>()
  for (const [tileKey, labels] of labelDataMap) {
    if (!visibleKeys.has(tileKey)) continue
    const [z, x, y] = tileKey.split('/').map(Number)
    this.crossTile.addTile(layerID, { z, x, y, key: tileKey }, labels)
    activeTileKeys.add(tileKey)
  }
  this.crossTile.removeStaleTiles(layerID, activeTileKeys)
}
```

- [ ] **Step 3: Add crossTileID dedup to LayoutEngine**

In `layout-engine.ts`, modify the placement loop:

```ts
const seenCrossTileIDs = new Set<number>()

for (const layer of layers) {
  const buckets = layer.getCollisionData(ctx, visibleKeys)
  for (const bucket of buckets) {
    const n = bucket.anchors.length
    const opacity = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const crossTileID = bucket.crossTileIDs[i]

      // Skip if this crossTileID was already placed by another tile
      if (crossTileID > 0 && seenCrossTileIDs.has(crossTileID)) {
        // opacity stays 0 — duplicate hidden
        continue
      }

      const [x1, y1, x2, y2] = bucket.boxes[i]
      const box = { x1, y1, x2, y2, padding: 0 }
      const result = ci.placeCollisionBox(box, 'never', 1, 0, 0, false, false, [0, 0])
      if (result.placeable) {
        ci.insertCollisionBox(...)
        opacity[i] = 1
        if (crossTileID > 0) seenCrossTileIDs.add(crossTileID)
      }
    }
    layer.setLabelOpacity(bucket.tileKey, opacity)
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/engine/
```

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/engine/symbol-engine.ts src/modular/layers/symbol/engine/layout-engine.ts
git commit -m "feat(symbol): wire CrossTileIndex into SymbolEngine + LayoutEngine

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Workers Return labelTexts

**Files:**
- Modify: `src/modular/layers/symbol/workers/symbol-worker-point.ts`
- Modify: `src/modular/layers/symbol/workers/symbol-worker-line.ts`

- [ ] **Step 1: Read both workers**

- [ ] **Step 2: In symbol-worker-point.ts**

In `_runLayout()`, the worker already has the text for each label (stored in `allLabels` or similar array). Add the text to the returned `SymbolTileData`:

```ts
// Alongside labelPositions, add:
labelTexts.push(rawText)

// In the returned data:
const data: SymbolTileData = {
  // ... existing fields ...
  labelTexts,
}
```

- [ ] **Step 3: In symbol-worker-line.ts**

Same pattern — the worker already has `rawText` per label in the anchor loop.

- [ ] **Step 4: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/
```

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/workers/symbol-worker-point.ts src/modular/layers/symbol/workers/symbol-worker-line.ts
git commit -m "feat(symbol): workers return labelTexts for cross-tile dedup keying

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Layers Store LabelData + Return crossTileIDs

**Files:**
- Modify: `src/modular/layers/symbol/text-layer.ts`
- Modify: `src/modular/layers/symbol/line-text-layer.ts`
- Modify: `src/modular/layers/symbol/icon-layer.ts`
- Modify: `src/modular/layers/symbol/base/symbol-layer-base.ts`

- [ ] **Step 1: Read text-layer.ts, line-text-layer.ts, icon-layer.ts, symbol-layer-base.ts**

- [ ] **Step 2: Add LabelData storage to layers**

Each layer needs to:
1. Import `LabelData` from cross-tile-index
2. Import `murmur3` from `murmurhash-js`
3. Store `_labelData: Map<string, LabelData[]>` per tile
4. When a tile's data arrives from the worker (in the TileFetcher's `onReady` or `fetch` callback), build the `LabelData[]` from `labelPositions` + `labelTexts`:

```ts
const labelData: LabelData[] = []
for (let i = 0; i < bucket.labelPositions.length; i++) {
  labelData.push({
    key: murmur3(bucket.labelTexts?.[i] ?? ''),
    anchorX: bucket.labelPositions[i].x,
    anchorY: bucket.labelPositions[i].y,
    crossTileID: 0,
  })
}
this._labelData.set(key, labelData)
```

5. Implement `getLabelData(): Map<string, LabelData[]>` returning the stored map
6. In `getCollisionData()`, include `crossTileIDs` from the stored LabelData:

```ts
buckets.push({
  tileKey: key,
  anchors,
  boxes,
  crossTileIDs: labelData.map(l => l.crossTileID),
})
```

7. Clean up `_labelData` in `evictTile()`

- [ ] **Step 3: Add abstract getLabelData to SymbolLayerBase or PlaceableLayer**

Add `getLabelData()` to the base class as a concrete method if label data storage can be shared, or update the `PlaceableLayer` interface.

- [ ] **Step 4: For IconLayer**

Icons may not have text — use the icon field name as the key instead. Or if icons don't need dedup, return an empty map from `getLabelData()`.

- [ ] **Step 5: Remove the `// STUB: populated by CrossTileIndex` markers from Task 1**

Replace the `crossTileIDs: []` stubs with the real implementation.

- [ ] **Step 6: Run all tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/
```

- [ ] **Step 7: Commit**

```bash
git add src/modular/layers/symbol/text-layer.ts src/modular/layers/symbol/line-text-layer.ts src/modular/layers/symbol/icon-layer.ts src/modular/layers/symbol/base/symbol-layer-base.ts
git commit -m "feat(symbol): layers store LabelData and return crossTileIDs for dedup

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Visual Verification

**Files:** None (testing only)

- [ ] **Step 1: Test with phase9 demo (point labels)**

```bash
node scripts/demo.ts open phase9
node scripts/demo.ts zoom 3 -s
node scripts/demo.ts zoom 4 -s
```

Check that "Tropic of Cancer" appears only once (not repeated per tile).

- [ ] **Step 2: Test with phase10 demo (line labels)**

```bash
node scripts/demo.ts open phase10
node scripts/demo.ts zoom 3 -s
node scripts/demo.ts zoom 4 -s
```

Check line labels aren't duplicated across tiles.

- [ ] **Step 3: Test zoom transitions**

```bash
node scripts/demo.ts open phase9
node scripts/demo.ts zoom 2 5 -d 1000 -s
node scripts/demo.ts zoom 5 2 -d 1000 -s
```

Labels should persist across zoom changes without flickering or doubling.

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/
```

- [ ] **Step 5: Update STATUS.md**

Check off `Collision across tiles (cross-tile symbol index)` and any related items.

```bash
git add STATUS.md
git commit -m "docs: update STATUS.md — cross-tile symbol dedup implemented

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
