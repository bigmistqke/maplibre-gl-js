# MapLibre Modular — Feature Coverage

Tracking which MapLibre GL JS features are supported in maplibre-modular.
`[x]` = supported · `[~]` = partial / in progress · `[ ]` = not yet implemented

---

## Layer Types

- [x] `background` — solid/pattern fill for the whole map
- [x] `raster` — raster tile imagery (OSM, satellite, etc.)
- [x] `fill` — polygon fill (earcut tessellation)
- [x] `line` — polyline rendering (`gl.LINES`)
- [ ] `circle` — point circles
- [x] `symbol` (point text) — SDF text labels at point positions
- [x] `symbol` (point icons) — sprite-atlas icon rendering at point positions
- [~] `symbol` (line text) — SDF text labels placed along line geometry (see Symbol section)
- [ ] `symbol` (line icons) — icons along lines
- [ ] `fill-extrusion` — 3D extruded polygons
- [ ] `heatmap` — density heatmap
- [ ] `hillshade` — DEM-based hillshading
- [ ] `color-relief` — elevation color ramp
- [x] `custom` — user-supplied WebGL layer (draw callback)

---

## Source Types

- [x] `raster` — raster tile source (XYZ template URL)
- [x] `raster-dem` — terrain-RGB DEM source (via `TerrainPlugin.createDEMSource()`)
- [x] `vector` — vector tile source (MVT/PBF)
- [ ] `geojson` — inline GeoJSON data
- [ ] `image` — single image draped over bounds
- [ ] `canvas` — HTML canvas as texture
- [ ] `video` — HTML video as texture

---

## Projections

- [x] Mercator — standard web mercator (EPSG:3857)
- [x] Globe — 3D sphere with zoom-based mercator ↔ globe crossfade (zoom 5→7)
- [ ] Vertical perspective — tilted/angled orthographic globe

---

## Camera

- [x] Center (lng/lat)
- [x] Zoom
- [x] Bearing (rotation)
- [x] Pitch (tilt)
- [x] Ground elevation offset
- [ ] Camera animations / easing (`flyTo`, `easeTo`, `panTo`)
- [ ] `fitBounds` / `fitScreenCoordinates`
- [ ] Edge insets / padding
- [ ] `cameraForBounds`

---

## Terrain / 3D

- [x] 3D terrain mesh (32×32 grid, CCW winding)
- [x] DEM decoded in worker (port of MapLibre's `DEMData` + 1px border padding)
- [x] RTT pipeline — raster draped over terrain via per-tile FBOs
- [x] Exaggeration factor (runtime-adjustable)
- [x] Back-face culling + painter's sort at high pitch
- [x] `getElevation(lngLat)` — bilinear CPU sampling (port of `getDEMElevation()`)
- [x] minZoom / maxZoom clamping on DEM source
- [ ] Horizon / sky rendering above terrain
- [ ] Fog over terrain
- [ ] Ground-clamped camera (elevation-aware `groundElevation`)

---

## Rendering Pipeline

- [x] Stencil tile clipping (ALWAYS+REPLACE per tile, EQUAL per layer)
- [x] Depth buffer (for terrain pass)
- [x] WebGL 1 (flat rendering)
- [x] WebGL 2 (terrain, required for `UNSIGNED_INT` index buffers)
- [x] Pluggable `Surface` interface (flat vs terrain render loops)
- [x] `RenderExtension` hooks (before/after tile pass)
- [x] Frame loop with dirty-flag (only renders when needed)
- [ ] Atmosphere / sky shader
- [ ] Depth pre-pass (symbol occlusion by terrain)
- [ ] Anti-aliasing beyond browser default
- [ ] MSAA

---

## Tile Management

- [x] `TileManager` — request, cancel, retain, evict
- [x] Overzooming (parent fallback, up to 10 levels)
- [x] Underzooming (child fallback, up to 3 levels)
- [x] Cache size based on viewport
- [x] minZoom / maxZoom per source
- [x] Raster worker (`WorkerRasterTileService`) — `ImageBitmap` via Comlink
- [x] Vector worker (`WorkerVectorTileService`) — PBF via Comlink
- [x] DEM worker (`WorkerDEMTileService`) — decoded `ArrayBuffer` via Comlink
- [ ] `TileJSON` / `tilejson.json` auto-loading (bounds, minzoom, maxzoom)
- [ ] Tile expiry / cache-control headers
- [ ] Protocol handlers (custom URL schemes)
- [ ] Request transformation hook

---

## Style

- [ ] Style JSON loading (MapLibre style spec)
- [x] Sprite / image atlas loading (`ImageManager` — fetches sprite sheet + JSON)
- [x] Glyph / font loading (`GlyphManager` — fetches SDF glyph PBFs, builds atlas)
- [ ] Expression evaluation (zoom, feature, interpolate, match, …)
- [ ] Data-driven paint properties
- [ ] Layer ordering from style
- [x] Runtime `addLayer` / `removeLayer` / `setLayerPaint` / `setLayerVisibility`
- [x] Runtime `addSource` / `removeSource`

---

## Interactions & Controls

- [ ] Drag pan
- [ ] Scroll zoom
- [ ] Double-click zoom
- [ ] Box zoom
- [ ] Drag rotate (right-click)
- [ ] Pinch zoom / rotate / pitch (touch)
- [ ] Keyboard navigation
- [ ] Cooperative gestures
- [ ] Navigation control (zoom/rotate buttons)
- [ ] Scale control
- [ ] Attribution control
- [ ] Geolocate control
- [ ] Fullscreen control
- [ ] Terrain control
- [ ] Globe control

---

## Events

- [x] `move` (camera state change)
- [ ] `zoom`, `rotate`, `pitch` (individual camera events)
- [ ] `click`, `dblclick`, `mousemove`, `mouseenter`, `mouseleave`
- [ ] `touchstart`, `touchend`, `touchmove`
- [ ] `load`, `idle`, `error`
- [ ] `sourcedata`, `styledataloading`
- [ ] Layer-specific events (click/hover per layer)

---

## Query & Features

- [ ] `queryRenderedFeatures` (stub — always returns `[]`)
- [ ] `querySourceFeatures`
- [ ] Feature state (`setFeatureState`, `getFeatureState`)

---

## Plugin & Extension API

- [x] `Plugin<R>` — typed plugin with `onAdd(map, renderer)` lifecycle
- [x] `CustomLayer` — user WebGL with projection uniforms
- [x] `RenderExtension` — before/after tile hooks
- [x] `Surface` — replaceable render loop (flat → terrain)
- [x] `TileService` — injectable tile fetching (for testing / custom sources)
- [x] `ElevationProvider` — duck-typed elevation query interface

---

## Symbol Rendering

Symbols are a project-within-a-project. The current state: algorithms are vendored from MapLibre and verified correct per-tile, but the integration layer (how our renderer calls the vendored code) has remaining issues.

### Architecture
- [x] `SymbolLayerBase` — abstract base class for all symbol layers
- [x] `SymbolEngine` — shared per-renderer, composes LayoutEngine + ResourceManager
- [x] `LayoutEngine` — collision detection with vendored `CollisionIndex`
- [x] `ResourceManager` — deduplicates `GlyphManager` and `ImageManager` across layers
- [x] `TileFetcher<T>` — generic async tile lifecycle
- [x] `StructArray` — MapLibre-compatible typed arrays with alignment, accessors, get(i) proxy
- [x] `SymbolBucketAdapter` — wraps StructArrays into shape vendored code expects

### Vendored from MapLibre (verbatim algorithms)
- [x] `projection.ts` — placeGlyphAlongLine, updateLineLabels, label flipping, vertical text detection
- [x] `collision_index.ts` — full CollisionIndex with grid spatial queries
- [x] `grid_index.ts` — spatial grid for collision detection
- [x] `cross_tile_symbol_index.ts` — persistent crossTileIDs across zoom levels
- [x] `placement.ts` — Placement class (vendored but not yet wired into SymbolEngine)
- [x] `symbol_size.ts` — font size evaluation
- [x] `clip_line.ts`, `merge_lines.ts`, `check_max_angle.ts` — line processing
- [x] `symbol_layout_helpers.ts` — wraps shapeText, getAnchors, getGlyphQuads

### Text
- [x] SDF glyph atlas with potpack bin-packing
- [x] Text shaping via MapLibre's shapeText
- [x] Glyph quads via MapLibre's getGlyphQuads
- [x] Point text placement at feature centroids
- [x] Line text anchors via MapLibre's getAnchors (per-tile parity verified: 53=53)
- [x] Line label projection via vendored updateLineLabels
- [x] Label flipping / keepUpright (vendored — handles all edge cases)
- [x] Worker-based layout with StructArray output
- [x] anchorIsTooClose dedup (vendored from MapLibre)

### Icons
- [x] Icon rendering — sprite atlas with `ImageManager`

### Collision & Placement
- [x] Grid-based collision detection (vendored CollisionIndex)
- [x] Per-label opacity
- [x] Cross-tile symbol dedup (vendored CrossTileSymbolIndex)

### Known Issues (integration bugs, not algorithm bugs)
- [ ] GL_INVALID_OPERATION on tile load — dynamic buffer timing mismatch when new tiles arrive mid-frame
- [ ] Labels disappear at zoom 13 — vendored projection may not handle zoom transitions correctly
- [ ] Density gap vs MapLibre original — 296 vs 295 symbol instances (nearly identical), but collision/rendering produces visually fewer labels. Likely in how dynamic buffers are bound or how the shader reads them
- [ ] Vendored Placement class not yet wired into SymbolEngine — still using simplified LayoutEngine

### Not Yet Implemented
- [ ] Text halo rendering
- [ ] Opacity fade transitions (currently binary 0/1)
- [ ] Zoom-dependent text size
- [ ] Roll support in TransformAdapter (7 projection tests skipped)
- [ ] Pitch correction for font scaling
- [ ] Variable anchor placement
- [ ] Icon-text combined symbols
- [ ] Formatted text (multi-font, multi-color)
- [ ] RTL text support

---

## Demos & Testing

- [x] Phase 1: Background layer
- [x] Phase 2: Raster tiles (main-thread fetch)
- [x] Phase 3: Tile eviction stats
- [x] Phase 4: Worker raster tiles (Comlink)
- [x] Phase 5: Vector fill + line layers
- [x] Phase 6: Globe projection with markers
- [x] Phase 7: 3D terrain with exaggeration
- [x] Phase 8: SDF text labels
- [x] Phase 8-icons: Icon layer
- [x] Phase 9: Placement / collision avoidance
- [x] Phase 10: Line text labels
- [x] Phase 10-roads: Road name labels (A/B comparison with MapLibre original)
- [x] canvas.html variant for clean screenshots (no GUI)
- [x] Demo CLI with `list`, `open`, `zoom`, `screenshot`, `eval` commands
- [x] A/B comparison demos (phases 2, 5, 8, 10)

---

## Architecture / Non-Functional

- [x] Tree-shakeable — terrain/symbols add 0 kB to core bundle when unused
- [x] No runtime dependencies (Comlink only in workers)
- [~] TypeScript strict (`tsconfig.modular.json` with `strict: true` — 2041 errors to fix)
- [x] TypeScript with `@modular/*` path alias
- [x] `allowImportingTsExtensions` enabled
- [x] ESLint autofix before commits
- [x] Vitest unit test suite (352 tests across 45 files)
- [x] MapLibre projection tests ported (8 pass, 7 skipped for roll)
- [x] Worker parity test (per-tile anchor count matches MapLibre exactly)
- [ ] Browser integration tests
- [ ] Benchmark suite
- [ ] Style-spec conformance tests
