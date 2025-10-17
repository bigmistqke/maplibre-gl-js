import { prepare } from './shaders/shaders';
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
import { registry } from './registry';
import { drawBackground } from './render/draw_background';
import { drawCircles } from './render/draw_circle';
import { drawFill } from './render/draw_fill';
import { drawFillExtrusion } from './render/draw_fill_extrusion';
import { drawHeatmap } from './render/draw_heatmap';
import { drawHillshade } from './render/draw_hillshade';
import { drawLine } from './render/draw_line';
import { drawRaster } from './render/draw_raster';
import { drawSymbols } from './render/draw_symbol';
import { drawTerrain, drawDepth, drawCoords } from './render/draw_terrain';
import { CanvasSource } from './source/canvas_source';
import { GeoJSONSource } from './source/geojson_source';
import { ImageSource } from './source/image_source';
import { RasterDEMTileSource } from './source/raster_dem_tile_source';
import { RasterTileSource } from './source/raster_tile_source';
import { VectorTileSource } from './source/vector_tile_source';
import { VideoSource } from './source/video_source';
import { PauseablePlacement } from './style/pauseable_placement';
import { CrossTileSymbolIndex } from './symbol/cross_tile_symbol_index';
import { performSymbolLayout } from './symbol/symbol_layout';
import { MercatorProjection } from './geo/projection/mercator_projection';
import { MercatorTransform } from './geo/projection/mercator_transform';
import { MercatorCameraHelper } from './geo/projection/mercator_camera_helper';
import { GlobeProjection } from './geo/projection/globe_projection';
import { GlobeTransform } from './geo/projection/globe_transform';
import { GlobeCameraHelper } from './geo/projection/globe_camera_helper';
import { VerticalPerspectiveProjection } from './geo/projection/vertical_perspective_projection';
import { VerticalPerspectiveTransform } from './geo/projection/vertical_perspective_transform';
import { VerticalPerspectiveCameraHelper } from './geo/projection/vertical_perspective_camera_helper';
import { SymbolBucket, SymbolBuffers, CollisionBuffers } from './data/bucket/symbol_bucket';
import { BackgroundStyleLayer } from './style/style_layer/background_style_layer';
import { CircleStyleLayer } from './style/style_layer/circle_style_layer';
import { ColorReliefStyleLayer } from './style/style_layer/color_relief_style_layer';
import { FillExtrusionStyleLayer } from './style/style_layer/fill_extrusion_style_layer';
import { FillStyleLayer } from './style/style_layer/fill_style_layer';
import { HeatmapStyleLayer } from './style/style_layer/heatmap_style_layer';
import { HillshadeStyleLayer } from './style/style_layer/hillshade_style_layer';
import { LineStyleLayer } from './style/style_layer/line_style_layer';
import { RasterStyleLayer } from './style/style_layer/raster_style_layer';
import { SymbolStyleLayer } from './style/style_layer/symbol_style_layer';
import { CircleBucket } from './data/bucket/circle_bucket';
import { FillBucket } from './data/bucket/fill_bucket';
import { FillExtrusionBucket } from './data/bucket/fill_extrusion_bucket';
import { HeatmapBucket } from './data/bucket/heatmap_bucket';
import { LineBucket } from './data/bucket/line_bucket';
import { register } from './util/web_worker_transfer';
export function registerBackground() {
    registry.layer.background = BackgroundStyleLayer;
    registry.draw.background = drawBackground;
    registry.shader.background = prepare(backgroundFrag, backgroundVert);
    registry.shader.backgroundPattern = prepare(backgroundPatternFrag, backgroundPatternVert);
}
export function registerCircle() {
    registry.layer.circle = CircleStyleLayer;
    registry.draw.circle = drawCircles;
    registry.shader.circle = prepare(circleFrag, circleVert);
    registry.bucket.circle = CircleBucket;
    register('CircleBucket', CircleBucket, { omit: ['layers'] });
}
export function registerFill() {
    registry.layer.fill = FillStyleLayer;
    registry.draw.fill = drawFill;
    registry.shader.fill = prepare(fillFrag, fillVert);
    registry.shader.fillOutline = prepare(fillOutlineFrag, fillOutlineVert);
    registry.shader.fillPattern = prepare(fillPatternFrag, fillPatternVert);
    registry.shader.fillOutlinePattern = prepare(fillOutlinePatternFrag, fillOutlinePatternVert);
    registry.bucket.fill = FillBucket;
    register('FillBucket', FillBucket, { omit: ['layers', 'patternFeatures'] });
}
export function registerFillExtrusion() {
    registry.layer['fill-extrusion'] = FillExtrusionStyleLayer;
    registry.draw['fill-extrusion'] = drawFillExtrusion;
    registry.shader.fillExtrusion = prepare(fillExtrusionFrag, fillExtrusionVert);
    registry.shader.fillExtrusionPattern = prepare(fillExtrusionPatternFrag, fillExtrusionPatternVert);
    registry.bucket['fill-extrusion'] = FillExtrusionBucket;
    register('FillExtrusionBucket', FillExtrusionBucket, { omit: ['layers', 'features'] });
}
export function registerHeatmap() {
    registry.layer.heatmap = HeatmapStyleLayer;
    registry.draw.heatmap = drawHeatmap;
    registry.shader.heatmap = prepare(heatmapFrag, heatmapVert);
    registry.shader.heatmapTexture = prepare(heatmapTextureFrag, heatmapTextureVert);
    registry.bucket.heatmap = HeatmapBucket;
    register('HeatmapBucket', HeatmapBucket, { omit: ['layers'] });
}
export function registerHillshade() {
    registry.layer.hillshade = HillshadeStyleLayer;
    registry.draw.hillshade = drawHillshade;
    registry.shader.hillshade = prepare(hillshadeFrag, hillshadeVert);
    registry.shader.hillshadePrepare = prepare(hillshadePrepareFrag, hillshadePrepareVert);
}
export function registerLine() {
    registry.layer.line = LineStyleLayer;
    registry.draw.line = drawLine;
    registry.shader.line = prepare(lineFrag, lineVert);
    registry.shader.lineGradient = prepare(lineGradientFrag, lineGradientVert);
    registry.shader.linePattern = prepare(linePatternFrag, linePatternVert);
    registry.shader.lineSDF = prepare(lineSDFFrag, lineSDFVert);
    registry.bucket.line = LineBucket;
    register('LineBucket', LineBucket, { omit: ['layers', 'patternFeatures'] });
}
export function registerRaster() {
    registry.layer.raster = RasterStyleLayer;
    registry.draw.raster = drawRaster;
    registry.shader.raster = prepare(rasterFrag, rasterVert);
}
export function registerColorRelief() {
    registry.layer['color-relief'] = ColorReliefStyleLayer;
    registry.draw['color-relief'] = drawRaster;
    registry.shader['colorRelief'] = prepare(colorReliefFrag, colorReliefVert);
}
export function registerSymbol() {
    registry.layer.symbol = SymbolStyleLayer;
    registry.draw.symbol = (painter, sourceCache, layer, coords, renderOptions) => {
        var _a, _b;
        const variableOffsets = (_b = (_a = painter.style) === null || _a === void 0 ? void 0 : _a.placement) === null || _b === void 0 ? void 0 : _b.variableOffsets;
        if (variableOffsets) {
            drawSymbols(painter, sourceCache, layer, coords, variableOffsets, renderOptions);
        }
    };
    registry.shader.symbolIcon = prepare(symbolIconFrag, symbolIconVert);
    registry.shader.symbolSDF = prepare(symbolSDFFrag, symbolSDFVert);
    registry.shader.symbolTextAndIcon = prepare(symbolTextAndIconFrag, symbolTextAndIconVert);
    registry.shader.collisionBox = prepare(collisionBoxFrag, collisionBoxVert);
    registry.shader.collisionCircle = prepare(collisionCircleFrag, collisionCircleVert);
    registry.bucket.symbol = SymbolBucket;
    register('SymbolBuffers', SymbolBuffers);
    register('CollisionBuffers', CollisionBuffers);
    register('SymbolBucket', SymbolBucket, {
        omit: ['layers', 'collisionBoxArray', 'features', 'compareText']
    });
    registry.symbol.SymbolBucket = SymbolBucket;
    registry.symbol.CrossTileSymbolIndex = CrossTileSymbolIndex;
    registry.symbol.PauseablePlacement = PauseablePlacement;
    registry.symbol.performSymbolLayout = performSymbolLayout;
}
export function registerTerrain() {
    registry.shader.terrain = prepare(terrainFrag, terrainVert);
    registry.shader.terrainDepth = prepare(terrainDepthFrag, terrainVertDepth);
    registry.shader.terrainCoords = prepare(terrainCoordsFrag, terrainVertCoords);
    registry.terrain.drawTerrain = drawTerrain;
    registry.terrain.drawDepth = drawDepth;
    registry.terrain.drawCoords = drawCoords;
}
export function registerUtilityShaders() {
    registry.shader.atmosphere = prepare(atmosphereFrag, atmosphereVert);
    registry.shader.clippingMask = prepare(clippingMaskFrag, clippingMaskVert);
    registry.shader.debug = prepare(debugFrag, debugVert);
    registry.shader.depth = prepare(clippingMaskFrag, depthVert);
    registry.shader.prelude = prepare(preludeFrag, preludeVert);
    registry.shader.projectionErrorMeasurement = prepare(projectionErrorMeasurementFrag, projectionErrorMeasurementVert);
    registry.shader.projectionMercator = prepare('', projectionMercatorVert);
    registry.shader.projectionGlobe = prepare('', projectionGlobeVert);
    registry.shader.sky = prepare(skyFrag, skyVert);
}
export function registerCanvasSource() {
    registry.source.canvas = CanvasSource;
}
export function registerGeoJSONSource() {
    registry.source.geojson = GeoJSONSource;
}
export function registerImageSource() {
    registry.source.image = ImageSource;
}
export function registerRasterDEMSource() {
    registry.source['raster-dem'] = RasterDEMTileSource;
}
export function registerRasterSource() {
    registry.source.raster = RasterTileSource;
}
export function registerVectorSource() {
    registry.source.vector = VectorTileSource;
}
export function registerVideoSource() {
    registry.source.video = VideoSource;
}
export function registerMercatorProjection() {
    registry.projection.mercator = {
        projection: MercatorProjection,
        transform: MercatorTransform,
        cameraHelper: MercatorCameraHelper,
    };
}
export function registerVerticalPerspectiveProjection() {
    registry.projection['vertical-perspective'] = {
        projection: VerticalPerspectiveProjection,
        transform: VerticalPerspectiveTransform,
        cameraHelper: VerticalPerspectiveCameraHelper,
    };
}
export function registerGlobeProjection() {
    registerMercatorProjection();
    registerVerticalPerspectiveProjection();
    registry.projection.globe = {
        projection: GlobeProjection,
        transform: GlobeTransform,
        cameraHelper: GlobeCameraHelper
    };
}
//# sourceMappingURL=features.js.map