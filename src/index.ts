/**
 * Full MapLibre bundle with all default sources, layers, handlers, draws, and shaders registered.
 * For tree-shaking, use 'maplibre-gl/core' and set registry manually.
 */

import {
    registry,
    // Sources
    CanvasSource,
    GeoJSONSource,
    ImageSource,
    RasterDEMTileSource,
    RasterTileSource,
    VectorTileSource,
    VideoSource,
    // Layers
    BackgroundStyleLayer,
    CircleStyleLayer,
    ColorReliefStyleLayer,
    FillExtrusionStyleLayer,
    FillStyleLayer,
    HeatmapStyleLayer,
    HillshadeStyleLayer,
    LineStyleLayer,
    RasterStyleLayer,
    SymbolStyleLayer,
    // Symbol dependencies
    SymbolBucket,
    CrossTileSymbolIndex,
    PauseablePlacement,
    performSymbolLayout,
    // Draw functions
    drawBackground,
    drawCircles,
    drawFillExtrusion,
    drawFill,
    drawHeatmap,
    drawHillshade,
    drawLine,
    drawRaster,
    drawSymbols,
    // Shaders
    prepare,
    atmosphereFrag,
    atmosphereVert,
    backgroundFrag,
    backgroundVert,
    backgroundPatternFrag,
    backgroundPatternVert,
    circleFrag,
    circleVert,
    clippingMaskFrag,
    clippingMaskVert,
    collisionBoxFrag,
    collisionBoxVert,
    collisionCircleFrag,
    collisionCircleVert,
    debugFrag,
    debugVert,
    depthVert,
    fillExtrusionFrag,
    fillExtrusionVert,
    fillExtrusionPatternFrag,
    fillExtrusionPatternVert,
    fillFrag,
    fillVert,
    fillOutlineFrag,
    fillOutlineVert,
    fillPatternFrag,
    fillPatternVert,
    fillOutlinePatternFrag,
    fillOutlinePatternVert,
    heatmapFrag,
    heatmapVert,
    heatmapTextureFrag,
    heatmapTextureVert,
    hillshadeFrag,
    hillshadeVert,
    hillshadePrepareFrag,
    hillshadePrepareVert,
    lineFrag,
    lineVert,
    lineGradientFrag,
    lineGradientVert,
    linePatternFrag,
    linePatternVert,
    lineSDFFrag,
    lineSDFVert,
    preludeFrag,
    preludeVert,
    projectionErrorMeasurementFrag,
    projectionErrorMeasurementVert,
    projectionMercatorVert,
    projectionGlobeVert,
    rasterFrag,
    rasterVert,
    colorReliefFrag,
    colorReliefVert,
    skyFrag,
    skyVert,
    symbolIconFrag,
    symbolIconVert,
    symbolSDFFrag,
    symbolSDFVert,
    symbolTextAndIconFrag,
    symbolTextAndIconVert,
    terrainFrag,
    terrainVert,
    terrainDepthFrag,
    terrainVertDepth,
    terrainCoordsFrag,
    terrainVertCoords,
} from './core';

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

// ===== REGISTER DRAW FUNCTIONS =====
registry.draw = {
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
