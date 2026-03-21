# Symbol Rendering: MapLibre Original vs Modular — Architecture Analysis

## Executive Summary

Symbol rendering is by far the most complex feature in MapLibre GL JS. The original implementation spans ~15,000 lines across 20+ files with deep interdependencies between shaping, placement, projection, and rendering. Our modular port successfully renders SDF text and icons, but takes significant shortcuts that result in visual regressions (label overlap, no cross-tile dedup, no halo).

**Key insight**: We already import MapLibre's most complex code (`shapeText`, `getGlyphQuads`, `getAnchors`) — the parts that would take weeks to reimplement. The gaps are mostly in the *integration plumbing* that connects layout → placement → rendering, not in algorithm reimplementation.

---

## Architecture Comparison

### Data Flow: Original MapLibre

```
Style JSON
  ↓
SymbolStyleLayer (evaluates expressions per feature per zoom)
  ↓
Worker Thread: WorkerTile.parse()
  ↓
SymbolBucket.populate() → performSymbolLayout()
  ├── shapeText() → Shaping (positioned glyphs)
  ├── shapeIcon() → PositionedIcon
  ├── getAnchors() / getCenterAnchor()
  ├── getGlyphQuads() / getIconQuads() → SymbolQuad[]
  ├── CollisionFeature (bounding boxes)
  ├── addSymbol() → vertex arrays (6 different StructArrays)
  └── Size evaluation at multiple zoom stops
  ↓
Main Thread: SymbolBucket transferred back
  ↓
CrossTileSymbolIndex.addBucket() → assigns persistent crossTileIDs
  ↓
Placement.placeLayerBucketPart()
  ├── Project anchors to screen space
  ├── CollisionIndex.placeCollisionBox() per symbol
  ├── Track JointPlacement (text + icon together)
  ├── Variable anchor testing (up to 8 positions)
  └── Opacity fade transitions (smooth 300ms)
  ↓
draw_symbol.ts
  ├── updateLineLabels() → dynamic vertex buffer (a_projected_pos)
  ├── Bind glyph atlas + icon atlas textures
  ├── Set 15+ uniforms (matrices, sizes, colors, fades)
  └── Draw call per segment
```

### Data Flow: Our Modular Version

```
Layer constructor options (source, textField, fontstack, fontSize, color)
  ↓
draw() called per tile per frame
  ↓
Worker (Comlink): SymbolWorkerPoint / SymbolWorkerLine / SymbolWorkerIcon
  ├── Parse PBF, extract text/icon properties
  ├── shapeTextForLayout() → Shaping (wraps MapLibre's shapeText)
  ├── buildGlyphQuads() (wraps MapLibre's getGlyphQuads)
  ├── getLineAnchors() (wraps MapLibre's getAnchors) [line worker only]
  └── Write vertex data to StructArray (1 array, 12-byte stride)
  ↓
Main Thread: poll for results, GPU upload
  ↓
Placement plugin (optional RenderExtension)
  ├── Gather PlacementParticipant.getSymbolBuckets()
  ├── CollisionIndex.placeCollisionBox() per label
  └── Set per-label opacity (binary 0/1, no fade)
  ↓
draw() continuation
  ├── Bind single glyph/icon atlas texture
  ├── Set 6 uniforms (texture, texsize, resolution, color, opacity, font_scale)
  └── Single draw call per tile
```

---

## What We Import from MapLibre

These are the **irreplaceable** MapLibre modules we depend on:

| Module | What it does | Why we can't rewrite it |
|--------|-------------|------------------------|
| `shapeText()` | Converts text string → positioned glyphs with line breaks, bidirectional support, CJK handling | 800+ lines of complex Unicode/OpenType logic |
| `getGlyphQuads()` | Converts shaped glyphs → textured quad geometry | Handles rotation, writing modes, pixel offsets, stretch regions |
| `getAnchors()` | Places anchor points along polylines at spacing intervals | Complex geometric resampling with angle validation |
| `getCenterAnchor()` | Single anchor at line midpoint | Needs max-angle checking |
| `checkMaxAngle()` | Validates line curvature isn't too sharp for text | Geometric computation |
| `clipLine()` | Clips polylines to tile bounds | Geometric clipping |
| `mergeLines()` | Merges line features sharing endpoints and text | Feature deduplication |
| `Anchor` | Point on a line with segment index | Used by all anchor/quad code |
| `ONE_EM` | Constant = 24 | All font metrics are in 24px units |

**These imports are correct and should be maintained.** They represent the core layout algorithms that MapLibre has refined over years.

---

## What We Built From Scratch

### Things that work well

| Component | Lines | Notes |
|-----------|-------|-------|
| `GlyphManager` | ~170 | Clean range-based loading with atlas rebuild + worker notification |
| `GlyphAtlas` | ~70 | Potpack-based bin packing, identical approach to MapLibre |
| `glyph-loader.ts` | ~60 | Inline PBF parser (avoids MapLibre's protobuf dep) |
| `ImageManager` | ~80 | Sprite JSON+PNG loading |
| `StructArray` | ~80 | Generic typed vertex buffer packing |
| Worker architecture | ~300ea | Clean Comlink workers with glyph update protocol |
| SDF shader | ~30 | Functional SDF text rendering |

### Things that need improvement

| Component | Issue | MapLibre's approach |
|-----------|-------|---------------------|
| Placement | Binary 0/1 opacity, no fade | 300ms smooth fade, opacity interpolation |
| Placement | No cross-tile dedup | `CrossTileSymbolIndex` with KDBush spatial matching |
| Placement | Point-only collision boxes | Line labels use circular collision along path |
| Line text | `symbolMinDistance` is a rough guess | MapLibre evaluates `symbol-spacing` expression per feature |
| Line text | `alongLine: false` in `buildGlyphQuads` | MapLibre projects glyphs along path at render time |
| Rendering | No dynamic vertex buffer updates | MapLibre updates `a_projected_pos` every frame for line labels |
| Rendering | No halo rendering | MapLibre does two-pass: halo then fill |
| Rendering | Single draw per tile | MapLibre uses segments for partial buffer draws |
| Size | Fixed fontSize, no zoom interpolation | MapLibre packs min/max sizes, interpolates in shader |
| Texture | RGBA atlas (4x memory) | MapLibre uses ALPHA format (1 byte/pixel) |

---

## Biggest Gaps (Priority Order)

### 1. Line Label Projection (HIGH — visible regression)

**Current**: Glyphs are placed as horizontal point labels at anchor positions along lines. Each character gets a fixed screen-space offset from the anchor.

**MapLibre**: Glyphs are individually projected along the line path *at render time*. Each frame, `updateLineLabels()` walks the polyline and positions each glyph tangent to the curve. This happens in the vertex shader via `a_projected_pos` (dynamic vertex buffer updated every frame).

**Impact**: Our line labels appear as straight horizontal text at anchor points. MapLibre's curve along the road/river geometry.

**Fix approach**:
- Import `PathInterpolator` (already in vendor/)
- Add dynamic layout buffer (Float32, 3 floats per vertex: projX, projY, angle)
- Update it each frame using `updateLineLabels()` or equivalent
- Modify vertex shader to use projected position instead of anchor+offset

### 2. Cross-Tile Symbol Deduplication (HIGH — visible regression)

**Current**: Each tile independently places labels. Adjacent tiles place the same label text, causing duplicates at tile boundaries.

**MapLibre**: `CrossTileSymbolIndex` maintains a spatial index of all placed symbols. When a new tile loads, it matches symbols by text + position (rounded to 4px grid) against existing tiles. Matched symbols get the same `crossTileID`, ensuring only one is shown.

**Impact**: "Tropic of Cancer" appears 4x in our demo, 1x in MapLibre's.

**Fix approach**:
- The CrossTileSymbolIndex is ~300 lines and relatively self-contained
- Could be adapted to work with our PlacementParticipant interface
- Key: it needs to run BEFORE placement, to assign IDs that placement uses

### 3. Text Halo (MEDIUM — missing feature)

**Current**: No halo/outline around text.

**MapLibre**: Two-pass rendering — first renders the halo (wider SDF threshold), then renders the fill on top.

**Fix approach**:
- Add `u_halo_color`, `u_halo_width`, `u_halo_blur` uniforms
- Render text twice: once with halo edge threshold, once with fill edge
- Or use single-pass with the SDF distance to compute both

### 4. Zoom-Dependent Text Size (MEDIUM — missing feature)

**Current**: Fixed `fontSize` passed at construction time.

**MapLibre**: Text size is an expression evaluated at multiple zoom stops. The vertex buffer stores packed min/max sizes. The shader interpolates between them based on current zoom.

**Fix approach**:
- Store `lowerSize` and `upperSize` per vertex (2 extra uint16)
- Add `u_size_t` uniform for zoom interpolation factor
- Compute effective size in vertex shader: `mix(lowerSize, upperSize, u_size_t)`

### 5. ALPHA Texture Format (LOW — perf optimization)

**Current**: We expand SDF data to RGBA (4 bytes/pixel) because ALPHA format had issues with SwiftShader.

**MapLibre**: Uses `gl.ALPHA` format (1 byte/pixel), samples `.a` channel.

**Fix approach**:
- The ALPHA issue was specific to headless SwiftShader testing
- Real browsers with real GPUs handle ALPHA fine
- Could runtime-detect and use ALPHA on real hardware, RGBA on SwiftShader

---

## Recommended Strategy: Maximum Piggyback

The guiding principle should be: **import MapLibre's battle-tested code, wrap it in our modular interfaces**.

### Phase 1: Use More MapLibre Code (immediate wins)

1. **Import `symbol_size.ts`** — zoom-dependent size evaluation is ~200 lines, well-isolated
2. **Import `collision_feature.ts`** — proper collision box creation for line labels
3. **Import `projection.ts`** functions — `updateLineLabels()`, `getPitchedLabelPlaneMatrix()`

### Phase 2: Adapt Larger Systems (medium effort)

4. **Port `CrossTileSymbolIndex`** (~300 lines) — adapt to our PlacementParticipant interface
5. **Port dynamic layout buffer** — add `a_projected_pos` attribute, update per frame
6. **Two-pass halo rendering** — straightforward shader change

### Phase 3: Consider Using SymbolBucket Directly (big refactor)

The most radical approach: instead of our custom StructArray vertex format, use MapLibre's `SymbolBucket` directly. This would give us:
- All 6 vertex attribute arrays (layout, dynamic, opacity, collision, placed, instance)
- Proper size packing
- Segment-based drawing
- Full feature compatibility

**Trade-off**: We'd lose our clean 12-byte vertex format and simple draw calls, but gain compatibility with MapLibre's full symbol feature set.

---

## Files We Should Import Next

| File | Lines | What it gives us |
|------|-------|-----------------|
| `src/symbol/symbol_size.ts` | ~200 | Zoom-dependent size evaluation |
| `src/symbol/collision_feature.ts` | ~150 | Proper collision boxes for placement |
| `src/symbol/projection.ts` | ~400 | Line label projection, pitch correction |
| `src/symbol/cross_tile_symbol_index.ts` | ~300 | Cross-tile deduplication |
| `src/symbol/path_interpolator.ts` | ~80 | Already in vendor/, just needs wiring |

Total: ~1,130 lines of imports to close the biggest visual gaps.

---

## Conclusion

Our modular symbol implementation is architecturally sound — the separation into workers, managers, layers, and placement is clean and tree-shakeable. The main visual regressions come from missing *integration plumbing*, not missing algorithms. Since we already import MapLibre's core layout code, importing the remaining ~1,100 lines of projection/collision/cross-tile code would close 80% of the visual gap with minimal architectural disruption.
