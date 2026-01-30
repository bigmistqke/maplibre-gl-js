/**
 * Capabilities Configuration
 *
 * Single source of truth for all tree-shakeable capabilities.
 * Uses harvestry's ExportKey format: "path#exportName"
 */

import type {Config} from '@harvestry/cli';

export const config: Config = {
    root: 'src/',
    exclude: ['**/*.test.ts', '**/test/**'],
    features: {
        // Sources
        'image-source': [
            './source/image_source#ImageSource',
        ],
        'canvas-source': [
            './source/canvas_source#CanvasSource',
        ],
        'geojson-source': [
            './source/geojson_source#GeoJSONSource',
        ],
        'video-source': [
            './source/video_source#VideoSource',
        ],
        'raster-source': [
            './source/raster_tile_source#RasterTileSource',
        ],
        'raster-dem-source': [
            './source/raster_dem_tile_source#RasterDEMTileSource',
        ],
        'vector-source': [
            './source/vector_tile_source#VectorTileSource',
        ],

        // Layers
        'background-layer': [
            './style/style_layer/background_style_layer#BackgroundStyleLayer',
            './render/draw_background#drawBackground',
        ],
        'circle-layer': [
            './style/style_layer/circle_style_layer#CircleStyleLayer',
            './data/bucket/circle_bucket#CircleBucket',
            './render/draw_circle#drawCircles',
        ],
        'fill-layer': [
            './style/style_layer/fill_style_layer#FillStyleLayer',
            './data/bucket/fill_bucket#FillBucket',
            './render/draw_fill#drawFill',
        ],
        'fill-extrusion-layer': [
            './style/style_layer/fill_extrusion_style_layer#FillExtrusionStyleLayer',
            './data/bucket/fill_extrusion_bucket#FillExtrusionBucket',
            './render/draw_fill_extrusion#drawFillExtrusion',
        ],
        'heatmap-layer': [
            './style/style_layer/heatmap_style_layer#HeatmapStyleLayer',
            './data/bucket/heatmap_bucket#HeatmapBucket',
            './render/draw_heatmap#drawHeatmap',
        ],
        'hillshade-layer': [
            './style/style_layer/hillshade_style_layer#HillshadeStyleLayer',
            './render/draw_hillshade#drawHillshade',
        ],
        'line-layer': [
            './style/style_layer/line_style_layer#LineStyleLayer',
            './data/bucket/line_bucket#LineBucket',
            './render/draw_line#drawLine',
        ],
        'raster-layer': [
            './style/style_layer/raster_style_layer#RasterStyleLayer',
            './render/draw_raster#drawRaster',
        ],
        'symbol-layer': [
            './style/style_layer/symbol_style_layer#SymbolStyleLayer',
            './data/bucket/symbol_bucket#SymbolBucket',
            './data/bucket/symbol_bucket#SymbolBuffers',
            './render/draw_symbol#drawSymbols',
            './symbol/cross_tile_symbol_index#CrossTileSymbolIndex',
            './style/pauseable_placement#PauseablePlacement',
            './symbol/symbol_layout#performSymbolLayout',
        ],
        'color-relief-layer': [
            './style/style_layer/color_relief_style_layer#ColorReliefStyleLayer',
            './render/draw_color_relief#drawColorRelief',
        ],

        // Projections
        'mercator-projection': [
            './geo/projection/mercator_projection#MercatorProjection',
            './geo/projection/mercator_transform#MercatorTransform',
            './geo/projection/mercator_camera_helper#MercatorCameraHelper',
        ],
        'globe-projection': [
            './geo/projection/globe_projection#GlobeProjection',
            './geo/projection/globe_transform#GlobeTransform',
            './geo/projection/globe_camera_helper#GlobeCameraHelper',
        ],
        'vertical-perspective-projection': [
            './geo/projection/vertical_perspective_projection#VerticalPerspectiveProjection',
            './geo/projection/vertical_perspective_transform#VerticalPerspectiveTransform',
            './geo/projection/vertical_perspective_camera_helper#VerticalPerspectiveCameraHelper',
        ],

        // Terrain
        terrain: [
            './render/draw_terrain#drawTerrain',
            './render/draw_terrain#drawDepth',
            './render/draw_terrain#drawCoords',
        ],
    },
};
