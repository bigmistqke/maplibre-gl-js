# Assertion Audit: TypeScript Strict Mode Migration (5fe57f5ed)

This audit classifies every `assertedNotNullish` / `assertNotNullish` call added during the
TypeScript strict mode migration. Each assertion falls into one of three categories:

| Category | Meaning | Action |
|---|---|---|
| **CRASHED** | Correct assertion. Pre-migration code would have thrown TypeError or produced NaN/corrupt results. | Keep the assertion. |
| **HANDLED** | Wrong assertion. The code already handles undefined via guards, optional chaining, or falsy-is-valid semantics. | Remove assertion; keep the type as optional. |
| **NEVER_UNDEFINED** | Wrong assertion AND wrong type widening. The value is always defined at runtime (set in constructor body or field initializer). | Remove assertion AND revert type to non-optional. |

---

## Summary

| Category | Production | Tests | Total |
|---|---|---|---|
| **CRASHED** | ~670 | ~115 | ~785 |
| **HANDLED** | ~25 | ~5 | ~30 |
| **NEVER_UNDEFINED** | ~35 | ~340 | ~375 |
| **Total** | ~730 | ~460 | ~1190 |

**Reclassification note:** Many patterns originally marked NEVER_UNDEFINED have been moved to CRASHED because they are set in methods other than the constructor body (e.g., `setup()`, `onAdd()`, `recalculate()`, `_load()`, `_calcMatrices()`, `performSymbolLayout()`, `prepareForRender()`). Only properties directly set in the constructor body or with field initializers qualify as NEVER_UNDEFINED.

---

## Special Bugs

| File | Value | Issue | Status |
|---|---|---|---|
| `src/ui/handler_manager.ts:~732` | `assertedNotNullish(handleEvent result)` | `handleEvent` returns `void`; wrapping in `assertedNotNullish` is semantically wrong (does not crash since return value is unused). | Remaining |

---

## HANDLED Assertions (Remove assertion, keep type optional)

These assertions are wrong because the surrounding code already handles `undefined`/`null` safely.

### `src/render/` directory

| File | Value | Reason |
|---|---|---|
| `fill_large_mesh_arrays.ts` | `lineIndicesStart` | Guarded by `if (hasLines)` which also controls initialization |
| `fill_large_mesh_arrays.ts` | `lineSegment` | Same `if (hasLines)` guard |
| `uniform_binding.ts` | `this.current` (~12 sites across Uniform1i, Uniform1f, Uniform2f, Uniform4f, UniformColor, UniformMatrix4f) | `undefined[0]` returns `undefined` in JS; comparison `v !== undefined` works correctly on first call. Assertion breaks first-call behavior where pre-migration code worked. |
| `image_manager.ts:~2272` | `size` | `_validateStretch` returns early if `!stretch`; `size` only used when stretch is defined |
| `image_manager.ts:~2362` | `image` | Guarded by `if (!image)` with `warnOnce` on line above |
| `image_manager.ts:~2365` | `image` | Same `if (!image)` guard |
| `subdivision.ts:~3710` | `this._vertexDictionary.get(key)` | Guarded by `if (this._vertexDictionary.has(key))` on line above |
| `program/terrain_program.ts` | `sky.properties` (x4) | Guarded by `sky ?` ternary expression |

### `src/symbol/` directory

| File | Value | Reason |
|---|---|---|
| `symbol_layout.ts:~2369` | `bucket.allowVerticalPlacement` | Used as boolean; `undefined` is falsy, same as `false` |
| `symbol_layout.ts:~2518-2521` | `textCollisionFeature`, `verticalTextCollisionFeature`, `iconCollisionFeature`, `verticalIconCollisionFeature` | `getCollisionCircleHeight` guards with `if(feature && feature.circleDiameter)` |

### `src/style/` directory

| File | Value | Reason |
|---|---|---|
| `style.ts:~400` | `paintAffectingGlobalStateRefs.get(ref)` | Guarded by `.has(ref)` check on previous line |
| `style.ts:~1646` | `this.map.terrain` | Guarded by ternary `this.map.terrain ? ... : undefined` |

### `src/ui/` directory

| File | Value | Reason |
|---|---|---|
| `map.ts:~720-729` | `resolvedOptions.minZoom`, `maxZoom`, `minPitch`, `maxPitch` (x4) | Inside `!== undefined` checks which already guarantee defined |
| `map.ts:~1437` | `renderWorldCopies` (`setRenderWorldCopies`) | Function accepts `null` to revert to default; asserting non-null is wrong |
| `map.ts:~1961` | `parameters` (`querySourceFeatures`) | `parameters` is optional with null default; original code handled null fine |

### `src/data/` directory

| File | Value | Reason |
|---|---|---|
| `bucket/fill_extrusion_bucket.ts:~452,456` | `this.indexBuffer`, `this.centroidVertexBuffer` | Behind `if (!this.layoutVertexBuffer) return;` guard |
| `bucket/line_bucket.ts:~743` | `this.indexBuffer` | Behind `if (!this.layoutVertexBuffer) return;` guard |
| `bucket/symbol_bucket.ts:~948,953,954,982,985` | `this.indexBuffer`, `this.dynamicLayoutVertexBuffer`, `this.opacityVertexBuffer`, `this.collisionVertexBuffer` (x5) | Behind `if (!this.layoutVertexBuffer) return;` guard |
| `feature_index.ts:~1749` | `this.vtLayers` | `loadVTLayers()` is called just above; vtLayers is always set by this point |
| `vertex_buffer.ts:~2433` | `dynamicDraw` | Optional boolean; `undefined` is falsy which is the intended default |

### `src/source/` directory

| File | Value | Reason |
|---|---|---|
| `geojson_source.ts:~3098` | `options.clusterMaxZoom` | `_getClusterMaxZoom` already handles undefined with `this.maxzoom` fallback |
| `geojson_worker_source.ts:~3885` | `getSuperclusterOptions(params)` | Returns valid options in cluster path; undefined only when clustering disabled |
| `query_features.ts:~4315` | `tiles[i]` | Iterating array with `for` loop using `i < tiles.length`; element always defined |
| `worker_tile.ts:~122` | `features` | Result of `sourceLayer` iteration; always an array from the loop |

---

## NEVER_UNDEFINED Assertions (Remove assertion AND revert type to non-optional)

These values are always defined at the point of use because they are set **directly in the constructor body or with field initializers**. The type should not include `| undefined`.

### Pattern 7: Map constructor-initialized properties (~15 sites)

`_canvas`, `_canvasContainer`, `_controlContainer`, `_controlPositions`, `painter`, `handlers`, `_maxCanvasSize` -- set in constructor, never nullified.

**File**: `map.ts`

### Pattern 18: Miscellaneous NEVER_UNDEFINED (constructor-set or truly always-defined)

| File | Value | Reason |
|---|---|---|
| `draw_symbol.ts:~1406` | `updateTextFitIcon` | Boolean expression, never nullish |
| `draw_symbol.ts:~1525` | `isSDF` | Boolean expression, never nullish |
| `draw_symbol.ts:~1631,1637,1643` | `shaderVariableAnchor` | Boolean expression, never nullish |
| `symbol_layout.ts:~2555,2558` | `compareText` | Already asserted on line 2552; double assertion |
| `cross_tile_symbol_index.ts:~63` | `entry.positions` | Assigned on immediately preceding line |
| `grid_index.ts:~180,215` | `this._queryCell`, `this._queryCellCircle` | Class methods, always exist |
| `shaping.ts:~2061` | `sectionAttributes` | Guarded by `if (!sectionAttributes) continue` above |
| `mercator_transform.ts:~416,433,443` | `cache.get(key)` | Preceded by `cache.has(key)` check |
| `mercator_utils.ts:~78` | `unwrappedTileID.wrap` | All callers pass `UnwrappedTileID` which always has `wrap` |
| `gl/render_pool.ts:~2215` | `extTextureFilterAnisotropicMax` | Inside `if (extTextureFilterAnisotropic)` guard |
| `gl/vertex_buffer.ts:~2432` | `array.bytesPerElement` | Always defined on `StructArray` instances |
| `geojson_source.ts` | `workerOptions.superclusterOptions`, `workerOptions.geojsonVtOptions`, `buffer`, `extent` | Always set in constructor |
| `geojson_worker_source.ts:~3858` | `params.source` | Always provided by callers |
| `vector_tile_worker_source.ts` | `overzoomParameters` | Only called when exists |
| `worker_tile.ts:~82` | `layerIndex.familiesBySource` | Always initialized |
| `query_features.ts:~4333` | `layer.source` | Always set on concrete style layers |
| `tile_bounds.ts:~10` | `LngLatBounds.convert()` | Always returns for valid input |
| `terrain_tile_manager.ts` | `tileID.terrainRttPosMatrix32f` | Assigned on line above |
| `tile.ts:~prepare` | `this.imageAtlasTexture` | Created in same upload flow as imageAtlas |
| `pauseable_placement.ts:~114` | `layer.source` | Symbol layers always have a source |
| `style.ts:~396,516,1387,1853,1904` | `layer.source` / `styledLayer.source` | Only reached for layer types that have sources |

---

## CRASHED Assertions (Correct -- keep these)

Brief reference list of correct assertions. These guard genuinely nullable values.
Includes patterns reclassified from the original NEVER_UNDEFINED where the property is
set in a method other than the constructor body.

### `src/render/`

- `draw_background.ts`: `layer.getCrossfadeParameters()`
- `draw_circle.ts`: `layoutVertexBuffer`, `indexBuffer`, `terrainData`
- `draw_collision_debug.ts`: `buffers.layoutVertexBuffer`, `buffers.indexBuffer`
- `draw_color_relief.ts`: `dem`, `elevationTexture.size`, `textureStride`, `painter.getTileTexture(...)`, `tile.dem`
- `draw_custom.ts`: `transform.farZ`, `transform.nearZ`
- `draw_debug.ts`: `tileManager.getTileByID(...)`, `canvas.getContext('2d')`
- `draw_fill.ts`: `tile.imageAtlasTexture`, `crossfade` (x2), `bucket.layoutVertexBuffer`
- `draw_fill_extrusion.ts`: `tile.imageAtlasTexture`, `crossfade`, `bucket.layoutVertexBuffer`
- `draw_heatmap.ts`: `bucket.layoutVertexBuffer` (x2), `map.terrain`, `layer.colorRamp`
- `draw_hillshade.ts`: `textureStride`, `tileSize` (x8)
- `draw_line.ts`: `tile.imageAtlasTexture`, `gradientTexture` (x2), `lineAtlas.getDash` (x2), `crossfade` (x6)
- `draw_raster.ts`: `source.tileCoords`, `fadeValues.parentTileOpacity`, `extTextureFilterAnisotropicMax`
- `draw_sky.ts`: `mesh.vertexBuffer`, `mesh.indexBuffer`
- `draw_symbol.ts`: `tileManager.map`, `bucket.text/icon`, `transform.cameraToCenterDistance`, `bucket.tilePixelRatio`, `tile.glyphAtlasTexture`, `tile.imageAtlasTexture`, `transform.clipSpaceToPixelsMatrix`
- `draw_terrain.ts`: `painter.renderToTexture`, `painterStyle.sky`
- `glyph_manager.ts`: `char.data`, `match`
- `image_atlas.ts`: `src.data` (x3), `iconPositions[name]`, `patternPositions[name]`, `image.data`
- `image_manager.ts`: `spriteData.context.getImageData(...)`, `image.data` (x5), `oldImage`, `this.atlasTexture`, `bin.x`, `bin.y`
- `mesh.ts`: `this.vertexBuffer`, `this.indexBuffer`, `this.segments`
- `painter.ts`: `this.style._order`, `style.placement`, `layer.source`, `style.sky`, `style.light`, `texture.size`
- `program.ts`: `gl.createShader(...)` (x2), `terrain[name]`, `projectionData[fieldName]`, `uniformValues`, `zoom`, `segments`
- `program/line_program.ts`: `transform.pixelsToGLUnits` (x4), `tile.imageAtlasTexture`
- `program/pattern.ts`: `tile.imageAtlasTexture`
- `render_to_texture.ts`: `this._prevType`
- `terrain.ts`: `u_terrain_matrix`, `dem.dim`, `dem.stride`, `demTexture`, `fboCoordsTexture`, `fbo.depthAttachment`, `tile.dem.min/max`
- `vertex_array_object.ts`: `layoutVertexBuffer`, `this.context` (x2)

#### Painter properties (~55 sites)

Properties set in `painter.setup()` or `painter.render()`, NOT in constructor.

`style`, `options`, `pixelRatio`, `lineAtlas`, `imageManager`, `viewportBuffer`, `rasterBoundsBuffer`, `quadTriangleIndexBuffer`, `debugBuffer`, `debugOverlayCanvas`, `debugOverlayTexture`, `tileBorderIndexBuffer`, `depthRangeFor3D`, `opaquePassCutoff`, `stencilClearMode`.

**Files**: `draw_background.ts`, `draw_circle.ts`, `draw_collision_debug.ts`, `draw_color_relief.ts`, `draw_custom.ts`, `draw_debug.ts`, `draw_fill.ts`, `draw_fill_extrusion.ts`, `draw_heatmap.ts`, `draw_hillshade.ts`, `draw_line.ts`, `draw_raster.ts`, `draw_sky.ts`, `draw_symbol.ts`, `draw_terrain.ts`, `render_to_texture.ts`, `painter.ts`, `program.ts`, `program/fill_extrusion_program.ts`, `program/pattern.ts`, `program/symbol_program.ts`, `terrain.ts`

#### RenderToTexture internal state (~12 sites)

`_stacks`, `_renderableLayerIds`, `_renderableTiles`, `_rttTiles`, `_coordsAscending`, `_rttFingerprints` -- set in `prepareForRender()`, NOT constructor.

**File**: `render_to_texture.ts`

### `src/symbol/`

- `check_max_angle.ts`: `recentCorners.shift()`
- `collision_index.ts`: `transform.cameraToCenterDistance` (x5)
- `cross_tile_symbol_index.ts`: `bucket.symbolInstances` (x7), `bucket.bucketInstanceId`
- `grid_index.ts`: `queryArgs` (x2), `overlapMode` (x4), `circle`
- `merge_lines.ts`: `mergedFeatures[i].geometry` (x4)
- `placement.ts`: ~60 sites (bucket properties, `placedGlyphBoxes`, `placedIconBoxes`, `prevZoomAdjustment`, `lastPlacementChangeTime`)
- `projection.ts`: `transform.pixelsToClipSpaceMatrix`, bucket text/icon (x8), `projectionContext.*` (x6), `currentLineSegment`
- `quads.ts`: `layer.layout`
- `shaping.ts`: `sectionAttributes?.imageOffset`, `content`
- `symbol_layout.ts`: `layout` (~25), `bucket.tilePixelRatio` (x5), `shapedTextOrientations` (x2), `lineArray` (x2), various bucket properties
- `transform_text.ts`: `layer.layout`

#### SymbolBucket properties (~40 sites)

`text`, `icon`, `symbolInstances`, `lineVertexArray`, `glyphOffsetArray`, `textCollisionBox`, `iconCollisionBox`, `collisionArrays`, `bucketInstanceId`, `tilePixelRatio`, `compareText`, `textAnchorOffsets` -- set in `performSymbolLayout()`, NOT constructor.

**File**: `symbol_bucket.ts`

### `src/style/`

- `style.ts`: `serializedStyle`, `styledLayer.source`, `_removedLayers` (x2), `getLayer(layer)` (x2), `stylesheet` (serialize/getGlyphsUrl/getSprite), `placement`, `map.terrain`, `tileManager.getTileByID()`, `map.transformConstrain`
- `style_layer_index.ts`: `globalState` parameter
- `properties.ts`: `prior.possiblyEvaluate(...)`
- `query_utils.ts`: `transform.cameraToCenterDistance` (x2)
- `style_image.ts`: `image.data`
- `custom_style_layer.ts`: `map.painter` (x2)
- `fill_extrusion_style_layer.ts`: `a.z`, `b.z`, `c.z`, `p.z`

#### StyleLayer paint/layout/transition properties (~100 sites)

`paint`, `layout`, `_unevaluatedLayout`, `_transitionablePaint`, `_transitioningPaint` -- set during `recalculate()`, NOT directly in constructor body.

**Files**: All `src/style/style_layer/*.ts`, all `src/render/draw_*.ts`, all `src/render/program/*_program.ts`, `src/symbol/symbol_layout.ts`, `src/symbol/placement.ts`, `src/data/bucket/*.ts`, `src/data/program_configuration.ts`

#### Style projection (~15 sites)

Set in `Style._load()` via `_setProjectionInternal`, NOT in constructor.

**Files**: `draw_background.ts`, `draw_color_relief.ts`, `draw_custom.ts`, `draw_hillshade.ts`, `draw_raster.ts`, `painter.ts`

#### light.properties / sky.properties (~10 sites)

Set via `recalculate()`, NOT in constructor.

**Files**: `draw_sky.ts`, `program/fill_extrusion_program.ts`, `program/sky_program.ts`

#### Style bookkeeping set in `_load()` (~15 sites)

`stylesheet`, `light`, `sky`, `projection`, `placement`, `lineAtlas` -- set in `_load()`, NOT in constructor.

**Files**: `style.ts`, `style_layer_index.ts`

#### ZoomHistory properties (~5 sites)

`lastFloorZoom`, `lastIntegerZoom`, `lastIntegerZoomTime` -- set on first `update()` call, NOT in constructor.

**Files**: `evaluation_parameters.ts`, `properties.ts`, `zoom_history.ts`

### `src/geo/`

- `lng_lat_bounds.ts`: `this._sw` (x3), `this._ne` (x3), `LngLatBounds.convert(other)`
- `globe_covering_tiles_details_provider.ts`: `threePlaneIntersection(...)` (x12)
- `globe_projection_error_measurement.ts`: post-destroy fields (x11)
- `mercator_camera_helper.ts`: `options.aroundPoint`
- `vertical_perspective_camera_helper.ts`: `cameraForBoxAndBearing result`, `padding.*` (x4), `options.aroundPoint`
- `vertical_perspective_projection.ts`: `_errorQueryLatitudeDegrees`, `options.granularity`
- `vertical_perspective_transform.ts`: `altitude`

#### Transform matrices and distances (~45 sites)

`cameraToCenterDistance`, `_pixelPerMeter`, `_nearZ`, `_farZ`, `_viewProjMatrix`, `_pixelMatrix`, `_projectionMatrix`, `_invProjMatrix`, `_mercatorMatrix`, `_invViewProjMatrix`, `_pixelsToGLUnits`, `_clipSpaceToPixelsMatrix`, `_rotationMatrix`, `_cameraPosition`, `_fogMatrix`, `_alignedProjMatrix`, `_cachedFrustum` -- set by `_calcMatrices()` via `resize()`, NOT in constructor.

**Files**: `mercator_transform.ts`, `vertical_perspective_transform.ts`, `transform_helper.ts`, `mercator_utils.ts`, `covering_tiles.ts`

### `src/ui/`

- `camera.ts`: `LngLatBounds.convert(bounds)`, `transform.cameraToCenterDistance`, `options.offset` (x2), `rho` (x8), `options.speed`
- `map.ts`: `this.style` (~35 sites on public methods), `positionContainer` (x2), `style.projection` (x2), `this.terrain` (x5), `existingImage.data`, `data`, `spriteUrl`, `delegate`
- `handler_manager.ts`: `options.bearingSnap`, `options.clickTolerance`, `options.pitchWithRotate`, `options.rollEnabled`
- `drag_move_state_manager.ts`: `e` (x3)
- `tap_recognizer.ts`: `this.lastTime`, `this.count`
- `scale_control.ts`: `this._map`, `this._container` (setUnit -- public API callable after onRemove)

#### UI control this._map, this._container, this._xxxButton (~155 sites)

Set in `onAdd()`, NOT in constructor.

| File | Approx sites |
|---|---|
| `attribution_control.ts` | ~30 |
| `fullscreen_control.ts` | ~20 |
| `geolocate_control.ts` | ~30 |
| `globe_control.ts` | ~7 |
| `logo_control.ts` | ~4 |
| `navigation_control.ts` | ~15 |
| `scale_control.ts` | ~3 |
| `terrain_control.ts` | ~12 |
| `hash.ts` | ~10 |
| `handler_inertia.ts` | ~5 |
| `handler_manager.ts` | ~4 |
| `box_zoom.ts` | ~8 |
| `cooperative_gestures.ts` | ~2 |
| `drag_move_state_manager.ts` | 1 |
| `tap_drag_zoom.ts` | 1 |
| `tap_recognizer.ts` | 1 |
| `touch_pan.ts` | ~4 |
| `two_fingers_touch.ts` | 1 |
| `scroll_zoom.ts` | ~6 |

#### Camera elevation/ease state (~15 sites)

`_elevationStart`, `_elevationTarget`, `_elevationCenter`, `_easeStart`, `_easeOptions`, `_onEaseFrame`, `terrain` -- set in `_prepareElevation`/`easeTo`/`flyTo`, NOT in constructor.

**File**: `camera.ts`

#### Source this.map (~20 sites)

Set in `onAdd()`, NOT in constructor.

**Files**: `canvas_source.ts`, `geojson_source.ts`, `image_source.ts`, `raster_tile_source.ts`, `raster_dem_tile_source.ts`, `vector_tile_source.ts`, `video_source.ts`

### `src/data/`

- `feature_index.ts`: `args.params`, `styleLayer.queryIntersectsFeature`, `bucketLayerIDs` (x2), `sourceLayerCoder`
- `bucket/line_bucket.ts`: `prevNormal`, `nextNormal`, `prevVertex`, `nextVertex`
- `gl/index_buffer.ts`: `array.arrayBuffer` (x2)
- `gl/vertex_buffer.ts`: `array.arrayBuffer` (x2), `program.attributes` (x2)
- `gl/render_pool.ts`: `fbo.depthAttachment`
- `shaders/shaders.ts`: `fragmentUniforms`, `vertexAttributes`, `shaderUniforms`

#### Non-constructor set items

| File | Value | Reason |
|---|---|---|
| `canvas_source.ts` | `this.canvas` (x6), `this.play` | Set in `load()` called from `onAdd()`, not constructor |
| `image_source.ts:~4196` | `this.tileID` | Set in `_finishLoading()`, not constructor |
| `fill_extrusion_bucket.ts:~433` | `this.features` | Set in `populate()`, not constructor |
| All buckets | `this.stateDependentLayers` (x5) | Set via deserialization, not constructor |

### `src/source/`

- `canvas_source.ts`: `this.canvas` (public API), `this.pause`, `map.painter`
- `geojson_source.ts`: `_data.updateable`, `options`, `map.style`, `map.style.projection`, `_data.url || _data.geojson`
- `geojson_source_diff.ts`: `feature.properties`
- `geojson_worker_source.ts`: `workerTile.vectorTile`, `_geoJSONIndex` (x4)
- `image_source.ts`: `map.painter`
- `raster_dem_tile_source.ts`: `sendAsync result`, `map.painter`
- `raster_tile_source.ts`: `map.painter` (x3)
- `rtl_text_plugin_worker.ts`: `incomingState.pluginURL`
- `vector_tile_source.ts`: `map.style`, `map.style.projection`, `map.painter`
- `vector_tile_worker_source.ts`: `params.request` (x2), `workerTile.vectorTile`
- `video_source.ts`: `this.video` (x4), `map.painter`

### Test files (~115 CRASHED sites)

- DOM queries via `querySelector` returning null (~20)
- `spy.mock.calls[N]` / `mock.lastCall` access (~8)
- `canvas.getContext('webgl')` returning null (~6)
- GeoJSON `feature.id` being optional (~20)
- `updateable.get(...)` / `merged.add` / `merged.update` (~26)
- Event-callback assigned variables (`startTime`, `tile`, `endMs`) (~7)
- `terrain.pointCoordinate(...)` returning null (~4)
- `worker.actor.messageHandlers[...]` partial record (~12)
- Other async/lookup patterns (~12)

---

## Recommended Remediation Order

### Immediate: Fix remaining runtime bug (1 item)

1. **`handler_manager.ts`**: Remove `assertedNotNullish` around void `handleEvent` return

### Phase 1: Revert remaining type widenings (~35 NEVER_UNDEFINED assertions)

For each remaining NEVER_UNDEFINED pattern, revert the property type from `T | undefined` back to `T`.

**Priority order by impact:**
1. Map constructor-initialized properties (~15 sites)
2. Miscellaneous always-defined values (~20 sites)

### Phase 2: Remove remaining HANDLED assertions (~30 assertions)

Delete HANDLED assertions where existing guards already ensure non-nullish. Key targets:
- `uniform_binding.ts` Uniform.current (~12 sites)
- Remaining bucket destroy guards (~5 sites)
- Remaining style/source guards

### Phase 3: Keep CRASHED assertions (~785 assertions)

These are correct. Consider improving them by:
- Creating typed wrappers for DOM/WebGL APIs that throw descriptively
- Using `mapGetOrThrow()` for `Map.get()` patterns
- Adding `assertStyleLoaded()` helper for `Map` public methods accessing `this.style`
