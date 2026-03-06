# Test Refactor Status

After the modular feature architecture refactor, 59 of 191 unit test files were failing. The root causes fall into three categories.

## Fixed (35 files, ~740 tests)

Added `FeatureRegistry` + `allFeatures()` to the test infrastructure:
- `src/util/test/util.ts` — `createMap()` helper and `StubMap` now provide `_featureRegistry` and `surface`
- `test/unit/lib/web_worker_mock.ts` — calls `createWorker(allFeatures())` so worker registry is initialized
- `src/ui/map.ts` — `Map` constructor falls back to `new FeatureRegistry([])` when `_featureRegistry` is not provided

## Remaining Failures (19 files, ~67 tests)

### OUTDATED — Tests Removed APIs (delete)

| File | Tests | Error | Action |
|------|-------|-------|--------|
| `src/source/source.test.ts` | 3 | `addSourceType is not a function` | Delete — `addSourceType` was removed, sources go through FeatureRegistry |

### MOCK UPDATE — Real Functionality, Mocks Missing New Properties

| File | Tests | Error | Action |
|------|-------|-------|--------|
| `src/render/terrain.test.ts` | all | `tileManager.addTileDataLayer is not a function` | Add `addTileDataLayer`/`removeTileDataLayer` stubs to TileManager mocks |
| `src/render/render_to_texture.test.ts` | all | `tileManager.addTileDataLayer is not a function` | Same as above |
| `src/data/bucket/symbol_bucket.test.ts` | 1/7 | `Cannot read 'hasTerrain' of undefined` | Pass `FLAT_SURFACE` instead of `undefined` to Placement constructor |
| `src/symbol/placement.test.ts` | 1 | `Cannot read 'hasTerrain' of undefined` | Same — needs surface mock |
| `src/geo/projection/mercator_transform.test.ts` | 4/33 | `surface.screenToCoordinate is not a function` | Pass proper Surface mock instead of partial object |
| `src/render/draw_symbol.test.ts` | 2/3 | `Cannot read 'getBindings' of undefined` | Add `surface = FLAT_SURFACE` to painter mock |
| `src/source/query_features.test.ts` | 1/2 | `Cannot read 'getSource' of undefined` | Add `getSource()` stub to featureRegistry mock |
| `src/ui/handler/cooperative_gestures.test.ts` | 10 | `Cannot read 'setEventedParent' of undefined` | `imageManager` is undefined during Style cleanup — conditional check needed |
| `src/ui/handler/scroll_zoom.test.ts` | 23 | Same as above | Same `imageManager` cleanup issue |

### BEHAVIOR CHANGE — Assertions Changed Due to Refactor

| File | Tests | Error | Notes |
|------|-------|-------|-------|
| `src/ui/camera.test.ts` | 4/292 | Elevation event count/value mismatches | Elevation events may fire differently with Surface abstraction |
| `src/ui/marker.test.ts` | 6/64 | Terrain opacity/visibility assertions | Marker terrain occlusion behavior may differ |
| `src/ui/map_tests/map_events.test.ts` | 1/83 | Timeout on "emits load event after a style is set" | Creates `new Map()` without style, then calls `setStyle()` |
| `src/ui/map_tests/map_style.test.ts` | 2/31 | Timeout on style transform tests | Style initialization may hang without features |
| `src/ui/map_tests/map_layer.test.ts` | 2/17 | Timeout on image/video layer visibility | Layer property updates hanging |
| `src/ui/map_tests/map_terrain.test.ts` | 1/4 | Pitch constraint assertion | `toBeLessThan(45)` fails — pitch stays at 45 |
| `src/ui/map_tests/map_zoom.test.ts` | 1/14 | Zoom precision mismatch | Expected 0.200077 but got 0.2 |
| `src/ui/map_tests/map_calculate_camera_options.test.ts` | 4/6 | Pitch assertions + same from/to error | Camera calculation affected by refactor |

## Priority Order

1. **imageManager cleanup** (33 tests) — Style._remove() crashes when imageManager is undefined. Add conditional check.
2. **addTileDataLayer stubs** (~10 tests) — Simple mock fix for terrain/RTT tests.
3. **Surface mocks** (~8 tests) — Pass `FLAT_SURFACE` where tests pass `undefined` for surface/terrain.
4. **Behavior changes** (~15 tests) — Need individual investigation.
5. **Outdated tests** (3 tests) — Delete `addSourceType` tests.
