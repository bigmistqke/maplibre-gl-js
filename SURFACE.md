# Surface Abstraction - Implementation Progress

## What's Done

### New files created
- `src/core/surface.ts` — `Surface` interface, `FlatSurface` class, `FLAT_SURFACE` singleton
- `src/render/terrain_surface.ts` — `TerrainSurface` class wrapping existing `Terrain`

### Files fully migrated to Surface
- `src/ui/camera.ts` — `surface: Surface = FLAT_SURFACE` field added; all `this.terrain.*` elevation calls → `this.surface.*`; `queryTerrainElevation` uses surface
- `src/ui/map.ts` — `setTerrain()` sets `this.surface`; `_render()` elevation branch unified; `project()`/`unproject()` pass surface; `calculateCameraOptionsFromTo` uses surface
- `src/render/painter.ts` — `surface` field set in `render()`; `useProgram()` uses `surface.hasTerrain`; `_renderTileMasks`/`_renderTilesDepthBuffer` use `surface.getBindings()`; globe depth check uses `surface.hasTerrain`
- `src/geo/transform_interface.ts` — 5 methods changed from `terrain?: Terrain` to `surface?: Surface`
- `src/geo/projection/mercator_transform.ts` — all 5 methods use Surface API
- `src/geo/projection/globe_transform.ts` — all 5 methods delegated with Surface
- `src/geo/projection/vertical_perspective_transform.ts` — all 5 methods use Surface API
- `src/ui/handler_manager.ts` — `MapControlsScenarioOptions.terrain` → `.surface: Surface`; all terrain checks → `surface.hasTerrain`
- `src/ui/handler/transform-provider.ts` — `this._map.terrain` → `this._map.surface`
- `src/symbol/placement.ts` — `terrain: Terrain` → `surface: Surface`; `_getTerrainElevationFunc` uses surface
- `src/style/pauseable_placement.ts` — constructor takes `surface: Surface`
- `src/style/style.ts` — placement receives `this.map.surface`; query elevation uses `surface.getElevationForTile`; `_updateSources` passes `this.map.surface`

### Draw functions migrated (all use `painter.surface.getBindings(coord)`)
- `draw_fill.ts`, `draw_circle.ts`, `draw_line.ts`, `draw_debug.ts`
- `draw_hillshade.ts`, `draw_color_relief.ts`, `draw_collision_debug.ts` (2 sites)
- `draw_background.ts` (getBindings + `coveringTiles` call both use `painter.surface`)
- `draw_raster.ts` (`isTerrain` uses `surface.hasTerrain`; getBindings migrated)
- `draw_heatmap.ts` (terrain check + getBindings migrated)
- `draw_fill_extrusion.ts` (getBindings + centroid buffer check migrated)
- `draw_symbol.ts` (getBindings + both `getElevation` callbacks migrated to `surface.getElevationForTile`)

### Covering tiles fully migrated to Surface
- `src/geo/projection/covering_tiles.ts` — `CoveringTilesOptionsInternal.terrain: Terrain` → `.surface: Surface`
- `src/geo/projection/mercator_covering_tiles_details_provider.ts` — uses `options.surface.getMinMaxElevation()` returning `{min, max}`
- `src/geo/projection/globe_covering_tiles_details_provider.ts` — same
- `src/util/primitives/bounding_volume_cache.ts` — cache key uses `options.surface?.hasTerrain`
- `src/tile/tile_manager.ts` — `terrain: Terrain` → `surface: Surface`; `update()` takes `Surface?`; `coveringTiles` and `screenPointToMercatorCoordinate` pass surface; raster fade check uses `surface?.hasTerrain`

### Test files migrated
- `src/ui/handler_manager.test.ts` — `terrain` → `surface` with Surface mocks
- `src/geo/projection/mercator_transform.test.ts` — Terrain mock → Surface mock

### Terrain-internal files updated to use TerrainSurface wrapper
- `src/render/terrain.ts` — `getElevationForLngLat` creates `TerrainSurface(this)` for `coveringTiles` call
- `src/tile/terrain_tile_manager.ts` — `update()` creates `TerrainSurface(terrain)` for both `tileManager.update()` and `coveringTiles` calls

## Deliberately left using `Terrain` directly (by design, not in scope)
- `src/render/painter.ts` `maybeDrawDepthAndCoords()` — terrain-specific FBO management
- `src/ui/map.ts` `_terrainDataCallback` — terrain-specific RTT lifecycle
- `src/render/terrain.ts` — the Terrain class itself
- `src/render/draw_terrain.ts` — takes Terrain directly
- `src/tile/terrain_tile_manager.ts` — manages terrain tiles (wraps Terrain → Surface at boundaries)
- `src/render/render_to_texture.ts` — RTT system
- `src/ui/marker.ts` — uses `terrain.depthAtPoint()` (could migrate later)
- `src/ui/popup.ts` — checks `map.terrain`
- `src/ui/control/terrain_control.ts` — terrain toggle UI
- `src/source/image_source.ts` — `terrainTileRanges`

## Status
All Surface-related type errors are resolved. Remaining type errors in the codebase are from the feature registry refactoring (TileManager constructor arity, MapOptions `_featureRegistry` required), not from Surface.
