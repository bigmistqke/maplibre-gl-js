/**
 * Full MapLibre bundle with all default sources, layers, handlers, draws, and shaders registered.
 * For tree-shaking, use 'maplibre-gl/core' and set registry manually.
 */

import {registry} from './registry';

// Sources
import {CanvasSource} from './source/canvas_source';
import {GeoJSONSource} from './source/geojson_source';
import {ImageSource} from './source/image_source';
import {RasterDEMTileSource} from './source/raster_dem_tile_source';
import {RasterTileSource} from './source/raster_tile_source';
import {VectorTileSource} from './source/vector_tile_source';
import {VideoSource} from './source/video_source';

// Layers
import {BackgroundStyleLayer} from './style/style_layer/background_style_layer';
import {CircleStyleLayer} from './style/style_layer/circle_style_layer';
import {ColorReliefStyleLayer} from './style/style_layer/color_relief_style_layer';
import {FillExtrusionStyleLayer} from './style/style_layer/fill_extrusion_style_layer';
import {FillStyleLayer} from './style/style_layer/fill_style_layer';
import {HeatmapStyleLayer} from './style/style_layer/heatmap_style_layer';
import {HillshadeStyleLayer} from './style/style_layer/hillshade_style_layer';
import {LineStyleLayer} from './style/style_layer/line_style_layer';
import {RasterStyleLayer} from './style/style_layer/raster_style_layer';
import {SymbolStyleLayer} from './style/style_layer/symbol_style_layer';
import {SymbolBucket} from './data/bucket/symbol_bucket';
import {CrossTileSymbolIndex} from './symbol/cross_tile_symbol_index';
import {PauseablePlacement} from './style/pauseable_placement';
import {performSymbolLayout} from './symbol/symbol_layout';

// Handlers
import {BoxZoomHandler} from './ui/handler/box_zoom';
import {ClickZoomHandler} from './ui/handler/click_zoom';
import {CooperativeGesturesHandler} from './ui/handler/cooperative_gestures';
import {DoubleClickZoomHandler} from './ui/handler/shim/dblclick_zoom';
import {DragPanHandler} from './ui/handler/shim/drag_pan';
import {DragRotateHandler} from './ui/handler/shim/drag_rotate';
import {KeyboardHandler} from './ui/handler/keyboard';
import {generateMousePanHandler, generateMousePitchHandler, generateMouseRollHandler, generateMouseRotationHandler} from './ui/handler/mouse';
import {ScrollZoomHandler} from './ui/handler/scroll_zoom';
import {TapDragZoomHandler} from './ui/handler/tap_drag_zoom';
import {TapZoomHandler} from './ui/handler/tap_zoom';
import {TouchPanHandler} from './ui/handler/touch_pan';
import {TwoFingersTouchPitchHandler, TwoFingersTouchRotateHandler, TwoFingersTouchZoomHandler} from './ui/handler/two_fingers_touch';
import {TwoFingersTouchZoomRotateHandler} from './ui/handler/shim/two_fingers_touch';
import type {MousePanHandler, MousePitchHandler, MouseRollHandler, MouseRotateHandler} from './ui/handler/mouse';
import type {TapDragZoomHandler as TapDragZoomHandlerType} from './ui/handler/tap_drag_zoom';

// Draw functions
import {drawBackground} from './render/draw_background';
import {drawCircles} from './render/draw_circle';
import {drawFillExtrusion} from './render/draw_fill_extrusion';
import {drawFill} from './render/draw_fill';
import {drawHeatmap} from './render/draw_heatmap';
import {drawHillshade} from './render/draw_hillshade';
import {drawLine} from './render/draw_line';
import {drawRaster} from './render/draw_raster';
import {drawSymbols} from './render/draw_symbol';

// Shaders
import {prepare} from './shaders/shaders';
import atmosphereFrag from './shaders/atmosphere.fragment.glsl.g';
import atmosphereVert from './shaders/atmosphere.vertex.glsl.g';
import backgroundFrag from './shaders/background.fragment.glsl.g';
import backgroundVert from './shaders/background.vertex.glsl.g';
import backgroundPatternFrag from './shaders/background_pattern.fragment.glsl.g';
import backgroundPatternVert from './shaders/background_pattern.vertex.glsl.g';
import circleFrag from './shaders/circle.fragment.glsl.g';
import circleVert from './shaders/circle.vertex.glsl.g';
import clippingMaskFrag from './shaders/clipping_mask.fragment.glsl.g';
import clippingMaskVert from './shaders/clipping_mask.vertex.glsl.g';
import collisionBoxFrag from './shaders/collision_box.fragment.glsl.g';
import collisionBoxVert from './shaders/collision_box.vertex.glsl.g';
import collisionCircleFrag from './shaders/collision_circle.fragment.glsl.g';
import collisionCircleVert from './shaders/collision_circle.vertex.glsl.g';
import debugFrag from './shaders/debug.fragment.glsl.g';
import debugVert from './shaders/debug.vertex.glsl.g';
import depthVert from './shaders/depth.vertex.glsl.g';
import fillExtrusionFrag from './shaders/fill_extrusion.fragment.glsl.g';
import fillExtrusionVert from './shaders/fill_extrusion.vertex.glsl.g';
import fillExtrusionPatternFrag from './shaders/fill_extrusion_pattern.fragment.glsl.g';
import fillExtrusionPatternVert from './shaders/fill_extrusion_pattern.vertex.glsl.g';
import fillFrag from './shaders/fill.fragment.glsl.g';
import fillVert from './shaders/fill.vertex.glsl.g';
import fillOutlineFrag from './shaders/fill_outline.fragment.glsl.g';
import fillOutlineVert from './shaders/fill_outline.vertex.glsl.g';
import fillPatternFrag from './shaders/fill_pattern.fragment.glsl.g';
import fillPatternVert from './shaders/fill_pattern.vertex.glsl.g';
import fillOutlinePatternFrag from './shaders/fill_outline_pattern.fragment.glsl.g';
import fillOutlinePatternVert from './shaders/fill_outline_pattern.vertex.glsl.g';
import heatmapFrag from './shaders/heatmap.fragment.glsl.g';
import heatmapVert from './shaders/heatmap.vertex.glsl.g';
import heatmapTextureFrag from './shaders/heatmap_texture.fragment.glsl.g';
import heatmapTextureVert from './shaders/heatmap_texture.vertex.glsl.g';
import hillshadeFrag from './shaders/hillshade.fragment.glsl.g';
import hillshadeVert from './shaders/hillshade.vertex.glsl.g';
import hillshadePrepareFrag from './shaders/hillshade_prepare.fragment.glsl.g';
import hillshadePrepareVert from './shaders/hillshade_prepare.vertex.glsl.g';
import lineFrag from './shaders/line.fragment.glsl.g';
import lineVert from './shaders/line.vertex.glsl.g';
import lineGradientFrag from './shaders/line_gradient.fragment.glsl.g';
import lineGradientVert from './shaders/line_gradient.vertex.glsl.g';
import linePatternFrag from './shaders/line_pattern.fragment.glsl.g';
import linePatternVert from './shaders/line_pattern.vertex.glsl.g';
import lineSDFFrag from './shaders/line_sdf.fragment.glsl.g';
import lineSDFVert from './shaders/line_sdf.vertex.glsl.g';
import preludeFrag from './shaders/_prelude.fragment.glsl.g';
import preludeVert from './shaders/_prelude.vertex.glsl.g';
import projectionErrorMeasurementFrag from './shaders/projection_error_measurement.fragment.glsl.g';
import projectionErrorMeasurementVert from './shaders/projection_error_measurement.vertex.glsl.g';
import projectionMercatorVert from './shaders/_projection_mercator.vertex.glsl.g';
import projectionGlobeVert from './shaders/_projection_globe.vertex.glsl.g';
import rasterFrag from './shaders/raster.fragment.glsl.g';
import rasterVert from './shaders/raster.vertex.glsl.g';
import colorReliefFrag from './shaders/color_relief.fragment.glsl.g';
import colorReliefVert from './shaders/color_relief.vertex.glsl.g';
import skyFrag from './shaders/sky.fragment.glsl.g';
import skyVert from './shaders/sky.vertex.glsl.g';
import symbolIconFrag from './shaders/symbol_icon.fragment.glsl.g';
import symbolIconVert from './shaders/symbol_icon.vertex.glsl.g';
import symbolSDFFrag from './shaders/symbol_sdf.fragment.glsl.g';
import symbolSDFVert from './shaders/symbol_sdf.vertex.glsl.g';
import symbolTextAndIconFrag from './shaders/symbol_text_and_icon.fragment.glsl.g';
import symbolTextAndIconVert from './shaders/symbol_text_and_icon.vertex.glsl.g';
import terrainFrag from './shaders/terrain.fragment.glsl.g';
import terrainVert from './shaders/terrain.vertex.glsl.g';
import terrainDepthFrag from './shaders/terrain_depth.fragment.glsl.g';
import terrainVertDepth from './shaders/terrain_depth.vertex.glsl.g';
import terrainCoordsFrag from './shaders/terrain_coords.fragment.glsl.g';
import terrainVertCoords from './shaders/terrain_coords.vertex.glsl.g';

// ===== REGISTER SOURCES =====
registry.source = {
    'canvas': CanvasSource,
    'geojson': GeoJSONSource,
    'image': ImageSource,
    'raster-dem': RasterDEMTileSource,
    'raster': RasterTileSource,
    'vector': VectorTileSource,
    'video': VideoSource,
};

// ===== REGISTER LAYERS =====
registry.layer = {
    'background': BackgroundStyleLayer,
    'circle': CircleStyleLayer,
    'color-relief': ColorReliefStyleLayer,
    'fill-extrusion': FillExtrusionStyleLayer,
    'fill': FillStyleLayer,
    'heatmap': HeatmapStyleLayer,
    'hillshade': HillshadeStyleLayer,
    'line': LineStyleLayer,
    'raster': RasterStyleLayer,
    'symbol': SymbolStyleLayer,
};

// ===== REGISTER SYMBOL DEPENDENCIES =====
registry.symbol = {
    SymbolBucket,
    CrossTileSymbolIndex,
    PauseablePlacement,
    performSymbolLayout,
};

// ===== REGISTER HANDLERS =====
registry.handler = {
    // Base mouse handlers
    'mousePan': (_map, options, manager) => {
        const mousePan = generateMousePanHandler(options);
        manager._add('mousePan', mousePan);
    },

    'mousePitch': (map, options, manager) => {
        const mousePitch = generateMousePitchHandler(options);
        manager._add('mousePitch', mousePitch, ['mouseRotate', 'mouseRoll']);
    },

    'mouseRoll': (map, options, manager) => {
        const getCenter = () => map.project(map.getCenter());
        const mouseRoll = generateMouseRollHandler(options, getCenter);
        manager._add('mouseRoll', mouseRoll, ['mousePitch']);
    },

    'mouseRotate': (map, options, manager) => {
        const getCenter = () => map.project(map.getCenter());
        const mouseRotate = generateMouseRotationHandler(options, getCenter);
        manager._add('mouseRotate', mouseRotate, ['mousePitch']);
    },

    // Base touch handlers
    'touchPan': (map, options, manager) => {
        const touchPan = new TouchPanHandler(options, map);
        manager._add('touchPan', touchPan, ['touchZoom', 'touchRotate']);
    },

    'touchRotate': (map, options, manager) => {
        const touchRotate = new TwoFingersTouchRotateHandler();
        manager._add('touchRotate', touchRotate, ['touchPan', 'touchZoom']);
    },

    'touchZoom': (map, options, manager) => {
        const touchZoom = new TwoFingersTouchZoomHandler();
        manager._add('touchZoom', touchZoom, ['touchPan', 'touchRotate']);
    },

    // Click/tap handlers
    'clickZoom': (map, options, manager) => {
        const clickZoom = new ClickZoomHandler(map);
        manager._add('clickZoom', clickZoom);
    },

    'tapZoom': (map, options, manager) => {
        const tapZoom = new TapZoomHandler(map);
        manager._add('tapZoom', tapZoom);
    },

    'tapDragZoom': (map, options, manager) => {
        const tapDragZoom = new TapDragZoomHandler();
        manager._add('tapDragZoom', tapDragZoom);
    },

    // Composite handlers
    'boxZoom': (map, options, manager) => {
        const boxZoom = map.boxZoom = new BoxZoomHandler(map, options);
        manager._add('boxZoom', boxZoom);
        if (options.interactive && options.boxZoom) {
            boxZoom.enable();
        }
    },

    'cooperativeGestures': (map, options, manager) => {
        const cooperativeGestures = map.cooperativeGestures = new CooperativeGesturesHandler(map, options.cooperativeGestures);
        manager._add('cooperativeGestures', cooperativeGestures);
        if (options.cooperativeGestures) {
            cooperativeGestures.enable();
        }
    },

    'doubleClickZoom': (map, options, manager) => {
        const clickZoom = manager._handlersById['clickZoom'] as ClickZoomHandler | undefined;
        const tapZoom = manager._handlersById['tapZoom'] as typeof TapZoomHandler.prototype | undefined;

        map.doubleClickZoom = new DoubleClickZoomHandler(clickZoom, tapZoom);

        if (options.interactive && options.doubleClickZoom) {
            map.doubleClickZoom.enable();
        }
    },

    'dragPan': (map, options, manager) => {
        const el = map.getCanvasContainer();
        const mousePan = manager._handlersById['mousePan'] as MousePanHandler | undefined;
        const touchPan = manager._handlersById['touchPan'] as TouchPanHandler | undefined;

        map.dragPan = new DragPanHandler(el, mousePan, touchPan);

        if (options.interactive && options.dragPan) {
            map.dragPan.enable(options.dragPan);
        }
    },

    'dragRotate': (map, options, manager) => {
        const mouseRotate = manager._handlersById['mouseRotate'] as MouseRotateHandler | undefined;
        const mousePitch = manager._handlersById['mousePitch'] as MousePitchHandler | undefined;
        const mouseRoll = manager._handlersById['mouseRoll'] as MouseRollHandler | undefined;

        map.dragRotate = new DragRotateHandler(options, mouseRotate, mousePitch, mouseRoll);

        if (options.interactive && options.dragRotate) {
            map.dragRotate.enable();
        }
    },

    'touchZoomRotate': (map, options, manager) => {
        const el = map.getCanvasContainer();
        const touchRotate = manager._handlersById['touchRotate'] as typeof TwoFingersTouchRotateHandler.prototype | undefined;
        const touchZoom = manager._handlersById['touchZoom'] as typeof TwoFingersTouchZoomHandler.prototype | undefined;
        const tapDragZoom = manager._handlersById['tapDragZoom'] as TapDragZoomHandlerType | undefined;

        map.touchZoomRotate = new TwoFingersTouchZoomRotateHandler(el, touchZoom, touchRotate, tapDragZoom);

        if (options.interactive && options.touchZoomRotate) {
            map.touchZoomRotate.enable(options.touchZoomRotate);
        }
    },

    'touchPitch': (map, options, manager) => {
        const touchPitch = map.touchPitch = new TwoFingersTouchPitchHandler(map);
        manager._add('touchPitch', touchPitch);
        if (options.interactive && options.touchPitch) {
            map.touchPitch.enable(options.touchPitch);
        }
    },

    'scrollZoom': (map, options, manager) => {
        const scrollZoom = map.scrollZoom = new ScrollZoomHandler(map, () => manager._triggerRenderFrame());
        manager._add('scrollZoom', scrollZoom, ['mousePan']);
        if (options.interactive && options.scrollZoom) {
            map.scrollZoom.enable(options.scrollZoom);
        }
    },

    'keyboard': (map, options, manager) => {
        const keyboard = map.keyboard = new KeyboardHandler(map);
        manager._add('keyboard', keyboard);
        if (options.interactive && options.keyboard) {
            map.keyboard.enable();
        }
    },
};

// ===== REGISTER DRAW FUNCTIONS =====
registry.drawFunction = {
    'background': drawBackground,
    'circle': drawCircles,
    'fill-extrusion': drawFillExtrusion,
    'fill': drawFill,
    'heatmap': drawHeatmap,
    'hillshade': drawHillshade,
    'line': drawLine,
    'raster': drawRaster,
    'color-relief': drawRaster, // color-relief uses raster drawing
    // Symbol draw function needs special handling with variable offsets
    'symbol': (painter, sourceCache, layer, coords, renderOptions) => {
        const variableOffsets = painter.style?.placement?.variableOffsets;
        if (variableOffsets) {
            drawSymbols(painter, sourceCache, layer as any, coords, variableOffsets, renderOptions);
        }
    }
};

// ===== REGISTER SHADERS =====
registry.shader = {
    'atmosphere': prepare(atmosphereFrag, atmosphereVert),
    'background': prepare(backgroundFrag, backgroundVert),
    'backgroundPattern': prepare(backgroundPatternFrag, backgroundPatternVert),
    'circle': prepare(circleFrag, circleVert),
    'clippingMask': prepare(clippingMaskFrag, clippingMaskVert),
    'collisionBox': prepare(collisionBoxFrag, collisionBoxVert),
    'collisionCircle': prepare(collisionCircleFrag, collisionCircleVert),
    'debug': prepare(debugFrag, debugVert),
    'depth': prepare(clippingMaskFrag, depthVert),
    'fillExtrusion': prepare(fillExtrusionFrag, fillExtrusionVert),
    'fillExtrusionPattern': prepare(fillExtrusionPatternFrag, fillExtrusionPatternVert),
    'fill': prepare(fillFrag, fillVert),
    'fillOutline': prepare(fillOutlineFrag, fillOutlineVert),
    'fillPattern': prepare(fillPatternFrag, fillPatternVert),
    'fillOutlinePattern': prepare(fillOutlinePatternFrag, fillOutlinePatternVert),
    'heatmap': prepare(heatmapFrag, heatmapVert),
    'heatmapTexture': prepare(heatmapTextureFrag, heatmapTextureVert),
    'hillshade': prepare(hillshadeFrag, hillshadeVert),
    'hillshadePrepare': prepare(hillshadePrepareFrag, hillshadePrepareVert),
    'line': prepare(lineFrag, lineVert),
    'lineGradient': prepare(lineGradientFrag, lineGradientVert),
    'linePattern': prepare(linePatternFrag, linePatternVert),
    'lineSDF': prepare(lineSDFFrag, lineSDFVert),
    'prelude': prepare(preludeFrag, preludeVert),
    'projectionErrorMeasurement': prepare(projectionErrorMeasurementFrag, projectionErrorMeasurementVert),
    'projectionMercator': prepare('', projectionMercatorVert),
    'projectionGlobe': prepare('', projectionGlobeVert),
    'raster': prepare(rasterFrag, rasterVert),
    'colorRelief': prepare(colorReliefFrag, colorReliefVert),
    'sky': prepare(skyFrag, skyVert),
    'symbolIcon': prepare(symbolIconFrag, symbolIconVert),
    'symbolSDF': prepare(symbolSDFFrag, symbolSDFVert),
    'symbolTextAndIcon': prepare(symbolTextAndIconFrag, symbolTextAndIconVert),
    'terrain': prepare(terrainFrag, terrainVert),
    'terrainDepth': prepare(terrainDepthFrag, terrainVertDepth),
    'terrainCoords': prepare(terrainCoordsFrag, terrainVertCoords),
};

// Re-export everything from core
export * from './core';
