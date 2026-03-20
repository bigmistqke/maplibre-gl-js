# MapLibre Mini — Feature Coverage

Tracking which MapLibre GL JS features are supported in maplibre-mini.
`[x]` = supported · `[ ]` = not yet implemented

---

## Layer Types

- [x] `background` — solid/pattern fill for the whole map
- [x] `raster` — raster tile imagery (OSM, satellite, etc.)
- [x] `fill` — polygon fill (earcut tessellation)
- [x] `line` — polyline rendering (`gl.LINES`)
- [ ] `circle` — point circles
- [ ] `symbol` — text labels and icon sprites
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
- [x] Globe — 3D sphere with mercator ↔ globe interpolation
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
- [ ] Sprite / image atlas loading
- [ ] Glyph / font loading
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

## Architecture / Non-Functional

- [x] Tree-shakeable — terrain adds 0 kB to core bundle when unused
- [x] No runtime dependencies (Comlink only in workers)
- [x] TypeScript strict
- [x] Vitest unit test suite (139 tests)
- [ ] Browser integration tests
- [ ] Benchmark suite
- [ ] Style-spec conformance tests
