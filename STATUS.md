# MapLibre Modular — Feature Coverage

Tracking which MapLibre GL JS features are supported in maplibre-modular.
`[x]` = supported · `[ ]` = not yet implemented

---

## Layer Types

- [x] `background` — solid/pattern fill for the whole map
- [x] `raster` — raster tile imagery (OSM, satellite, etc.)
- [x] `fill` — polygon fill (earcut tessellation)
- [x] `line` — polyline rendering (`gl.LINES`)
- [ ] `circle` — point circles
- [x] `symbol` (point text) — SDF text labels at point positions
- [x] `symbol` (point icons) — sprite-atlas icon rendering at point positions
- [x] `symbol` (line text) — SDF text labels placed along line geometry
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

### Architecture
- [x] `SymbolLayerBase` — abstract base class for all symbol layers
- [x] `SymbolEngine` — shared per-renderer (via WeakMap), composes LayoutEngine + ResourceManager
- [x] `LayoutEngine` — collision detection with shared `CollisionIndex`, visible-tile filtering
- [x] `ResourceManager` — deduplicates `GlyphManager` and `ImageManager` across layers
- [x] `TileFetcher<T>` — generic async tile lifecycle (fetch/pending/ready/invalidate/evict)

### Text
- [x] SDF glyph atlas — `GlyphAtlas` with potpack bin-packing, RGBA GPU texture
- [x] Text shaping — `shapeText` (port of MapLibre's shaping pipeline)
- [x] Glyph quads — `buildGlyphQuads` for per-character quad geometry
- [x] Point text placement — anchored at feature centroids
- [x] Line text placement — `getLineAnchors` + `clipLine` + `mergeLines` along polylines
- [x] Line label projection — per-frame glyph placement along projected line geometry (dynamic vertex buffer)
- [x] Worker-based layout — `SymbolWorkerLine` (Comlink) for line text, `SymbolWorkerPoint` for point text
- [x] Live font size updates — `setFontSize()` triggers worker re-layout

### Icons
- [x] Icon rendering — sprite atlas with `ImageManager`, per-feature icon quads

### Collision & Placement
- [x] Collision detection — `LayoutEngine` with grid-based `CollisionIndex`
- [x] Per-label opacity — binary 0/1 via `setLabelOpacity()`
- [x] Visible-tile filtering — collision data scoped to currently rendered tiles
- [x] Cross-tile symbol dedup — `CrossTileIndex` with position tolerance + zoom-level matching, persistent crossTileIDs

### Known Issues
- [ ] Line label density ~3% vs MapLibre's dense labels — at z14, projected segment distances are tiny (0.0625 px/tile-unit), so many labels need more backward space than available from the clip boundary to the anchor. Needs investigation: MapLibre may use `getCenterAnchor` for short lines, or different anchor offset strategy

### Not Yet Implemented
- [ ] Text halo rendering — MapLibre two-pass: halo then fill (same geometry, different SDF threshold)
- [ ] KDBush spatial index for cross-tile dedup — currently linear search, add when >128 symbols per key
- [ ] Opacity fade transitions — smooth 300ms fade in/out (currently binary 0/1)
- [ ] Zoom-dependent text size — pack min/max sizes in vertex, interpolate in shader
- [ ] Label flipping / keep-upright — reverse glyph order when line reads R→L on screen
- [ ] First/last glyph check — early-exit if label doesn't fit on screen
- [ ] Projection cache — cache projected line vertices per bucket (performance)
- [ ] Pitch correction — adjust font scale based on camera distance
- [ ] Perpendicular line offset — `text-offset` for labels parallel-but-offset from line
- [ ] Variable anchor placement — test up to 9 positions per label
- [ ] Icon-text combined symbols
- [ ] Formatted text (multi-font, multi-color)
- [ ] ALPHA atlas format — 1 byte/pixel instead of RGBA 4 bytes/pixel (saves GPU memory)
- [ ] Expression evaluation for symbol properties

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
- [x] A/B comparison demos (phases 2, 5, 8, 10) — MapLibre-original vs modular

---

## Architecture / Non-Functional

- [x] Tree-shakeable — terrain adds 0 kB to core bundle when unused
- [x] No runtime dependencies (Comlink only in workers)
- [x] TypeScript strict
- [x] Vitest unit test suite (139 tests)
- [ ] Browser integration tests
- [ ] Benchmark suite
- [ ] Style-spec conformance tests
