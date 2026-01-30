import { ImageSource } from './source/image_source';
import { CanvasSource } from './source/canvas_source';
import { GeoJSONSource } from './source/geojson_source';
import { VideoSource } from './source/video_source';
import { RasterTileSource } from './source/raster_tile_source';
import { RasterDEMTileSource } from './source/raster_dem_tile_source';
import { VectorTileSource } from './source/vector_tile_source';
import { BackgroundStyleLayer } from './style/style_layer/background_style_layer';
import { drawBackground } from './render/draw_background';
import { CircleStyleLayer } from './style/style_layer/circle_style_layer';
import { CircleBucket } from './data/bucket/circle_bucket';
import { drawCircles } from './render/draw_circle';
import { FillStyleLayer } from './style/style_layer/fill_style_layer';
import { FillBucket } from './data/bucket/fill_bucket';
import { drawFill } from './render/draw_fill';
import { FillExtrusionStyleLayer } from './style/style_layer/fill_extrusion_style_layer';
import { FillExtrusionBucket } from './data/bucket/fill_extrusion_bucket';
import { drawFillExtrusion } from './render/draw_fill_extrusion';
import { HeatmapStyleLayer } from './style/style_layer/heatmap_style_layer';
import { HeatmapBucket } from './data/bucket/heatmap_bucket';
import { drawHeatmap } from './render/draw_heatmap';
import { HillshadeStyleLayer } from './style/style_layer/hillshade_style_layer';
import { drawHillshade } from './render/draw_hillshade';
import { LineStyleLayer } from './style/style_layer/line_style_layer';
import { LineBucket } from './data/bucket/line_bucket';
import { drawLine } from './render/draw_line';
import { RasterStyleLayer } from './style/style_layer/raster_style_layer';
import { drawRaster } from './render/draw_raster';
import { SymbolStyleLayer } from './style/style_layer/symbol_style_layer';
import { SymbolBucket, SymbolBuffers } from './data/bucket/symbol_bucket';
import { drawSymbols } from './render/draw_symbol';
import { CrossTileSymbolIndex } from './symbol/cross_tile_symbol_index';
import { PauseablePlacement } from './style/pauseable_placement';
import { performSymbolLayout } from './symbol/symbol_layout';
import { ColorReliefStyleLayer } from './style/style_layer/color_relief_style_layer';
import { drawColorRelief } from './render/draw_color_relief';
import { MercatorProjection } from './geo/projection/mercator_projection';
import { MercatorTransform } from './geo/projection/mercator_transform';
import { MercatorCameraHelper } from './geo/projection/mercator_camera_helper';
import { GlobeProjection } from './geo/projection/globe_projection';
import { GlobeTransform } from './geo/projection/globe_transform';
import { GlobeCameraHelper } from './geo/projection/globe_camera_helper';
import { VerticalPerspectiveProjection } from './geo/projection/vertical_perspective_projection';
import { VerticalPerspectiveTransform } from './geo/projection/vertical_perspective_transform';
import { VerticalPerspectiveCameraHelper } from './geo/projection/vertical_perspective_camera_helper';
import { drawTerrain, drawDepth, drawCoords } from './render/draw_terrain';
import { registry } from "./registry";

export function registerImageSourceFeature(){
  registry['./source/image_source#ImageSource'] = ImageSource
}
export function registerCanvasSourceFeature(){
  registry['./source/canvas_source#CanvasSource'] = CanvasSource
}
export function registerGeojsonSourceFeature(){
  registry['./source/geojson_source#GeoJSONSource'] = GeoJSONSource
}
export function registerVideoSourceFeature(){
  registry['./source/video_source#VideoSource'] = VideoSource
}
export function registerRasterSourceFeature(){
  registry['./source/raster_tile_source#RasterTileSource'] = RasterTileSource
}
export function registerRasterDemSourceFeature(){
  registry['./source/raster_dem_tile_source#RasterDEMTileSource'] = RasterDEMTileSource
}
export function registerVectorSourceFeature(){
  registry['./source/vector_tile_source#VectorTileSource'] = VectorTileSource
}
export function registerBackgroundLayerFeature(){
  registry['./style/style_layer/background_style_layer#BackgroundStyleLayer'] = BackgroundStyleLayer
  registry['./render/draw_background#drawBackground'] = drawBackground
}
export function registerCircleLayerFeature(){
  registry['./style/style_layer/circle_style_layer#CircleStyleLayer'] = CircleStyleLayer
  registry['./data/bucket/circle_bucket#CircleBucket'] = CircleBucket
  registry['./render/draw_circle#drawCircles'] = drawCircles
}
export function registerFillLayerFeature(){
  registry['./style/style_layer/fill_style_layer#FillStyleLayer'] = FillStyleLayer
  registry['./data/bucket/fill_bucket#FillBucket'] = FillBucket
  registry['./render/draw_fill#drawFill'] = drawFill
}
export function registerFillExtrusionLayerFeature(){
  registry['./style/style_layer/fill_extrusion_style_layer#FillExtrusionStyleLayer'] = FillExtrusionStyleLayer
  registry['./data/bucket/fill_extrusion_bucket#FillExtrusionBucket'] = FillExtrusionBucket
  registry['./render/draw_fill_extrusion#drawFillExtrusion'] = drawFillExtrusion
}
export function registerHeatmapLayerFeature(){
  registry['./style/style_layer/heatmap_style_layer#HeatmapStyleLayer'] = HeatmapStyleLayer
  registry['./data/bucket/heatmap_bucket#HeatmapBucket'] = HeatmapBucket
  registry['./render/draw_heatmap#drawHeatmap'] = drawHeatmap
}
export function registerHillshadeLayerFeature(){
  registry['./style/style_layer/hillshade_style_layer#HillshadeStyleLayer'] = HillshadeStyleLayer
  registry['./render/draw_hillshade#drawHillshade'] = drawHillshade
}
export function registerLineLayerFeature(){
  registry['./style/style_layer/line_style_layer#LineStyleLayer'] = LineStyleLayer
  registry['./data/bucket/line_bucket#LineBucket'] = LineBucket
  registry['./render/draw_line#drawLine'] = drawLine
}
export function registerRasterLayerFeature(){
  registry['./style/style_layer/raster_style_layer#RasterStyleLayer'] = RasterStyleLayer
  registry['./render/draw_raster#drawRaster'] = drawRaster
}
export function registerSymbolLayerFeature(){
  registry['./style/style_layer/symbol_style_layer#SymbolStyleLayer'] = SymbolStyleLayer
  registry['./data/bucket/symbol_bucket#SymbolBucket'] = SymbolBucket
  registry['./data/bucket/symbol_bucket#SymbolBuffers'] = SymbolBuffers
  registry['./render/draw_symbol#drawSymbols'] = drawSymbols
  registry['./symbol/cross_tile_symbol_index#CrossTileSymbolIndex'] = CrossTileSymbolIndex
  registry['./style/pauseable_placement#PauseablePlacement'] = PauseablePlacement
  registry['./symbol/symbol_layout#performSymbolLayout'] = performSymbolLayout
}
export function registerColorReliefLayerFeature(){
  registry['./style/style_layer/color_relief_style_layer#ColorReliefStyleLayer'] = ColorReliefStyleLayer
  registry['./render/draw_color_relief#drawColorRelief'] = drawColorRelief
}
export function registerMercatorProjectionFeature(){
  registry['./geo/projection/mercator_projection#MercatorProjection'] = MercatorProjection
  registry['./geo/projection/mercator_transform#MercatorTransform'] = MercatorTransform
  registry['./geo/projection/mercator_camera_helper#MercatorCameraHelper'] = MercatorCameraHelper
}
export function registerGlobeProjectionFeature(){
  registry['./geo/projection/globe_projection#GlobeProjection'] = GlobeProjection
  registry['./geo/projection/globe_transform#GlobeTransform'] = GlobeTransform
  registry['./geo/projection/globe_camera_helper#GlobeCameraHelper'] = GlobeCameraHelper
}
export function registerVerticalPerspectiveProjectionFeature(){
  registry['./geo/projection/vertical_perspective_projection#VerticalPerspectiveProjection'] = VerticalPerspectiveProjection
  registry['./geo/projection/vertical_perspective_transform#VerticalPerspectiveTransform'] = VerticalPerspectiveTransform
  registry['./geo/projection/vertical_perspective_camera_helper#VerticalPerspectiveCameraHelper'] = VerticalPerspectiveCameraHelper
}
export function registerTerrainFeature(){
  registry['./render/draw_terrain#drawTerrain'] = drawTerrain
  registry['./render/draw_terrain#drawDepth'] = drawDepth
  registry['./render/draw_terrain#drawCoords'] = drawCoords
}

/********************************************************************************
 *                                 All Features                                 *
 ********************************************************************************/

export function registerAllFeatures(){
 registry['./source/image_source#ImageSource'] = ImageSource;
 registry['./source/canvas_source#CanvasSource'] = CanvasSource;
 registry['./source/geojson_source#GeoJSONSource'] = GeoJSONSource;
 registry['./source/video_source#VideoSource'] = VideoSource;
 registry['./source/raster_tile_source#RasterTileSource'] = RasterTileSource;
 registry['./source/raster_dem_tile_source#RasterDEMTileSource'] = RasterDEMTileSource;
 registry['./source/vector_tile_source#VectorTileSource'] = VectorTileSource;
 registry['./style/style_layer/background_style_layer#BackgroundStyleLayer'] = BackgroundStyleLayer;
 registry['./render/draw_background#drawBackground'] = drawBackground;
 registry['./style/style_layer/circle_style_layer#CircleStyleLayer'] = CircleStyleLayer;
 registry['./data/bucket/circle_bucket#CircleBucket'] = CircleBucket;
 registry['./render/draw_circle#drawCircles'] = drawCircles;
 registry['./style/style_layer/fill_style_layer#FillStyleLayer'] = FillStyleLayer;
 registry['./data/bucket/fill_bucket#FillBucket'] = FillBucket;
 registry['./render/draw_fill#drawFill'] = drawFill;
 registry['./style/style_layer/fill_extrusion_style_layer#FillExtrusionStyleLayer'] = FillExtrusionStyleLayer;
 registry['./data/bucket/fill_extrusion_bucket#FillExtrusionBucket'] = FillExtrusionBucket;
 registry['./render/draw_fill_extrusion#drawFillExtrusion'] = drawFillExtrusion;
 registry['./style/style_layer/heatmap_style_layer#HeatmapStyleLayer'] = HeatmapStyleLayer;
 registry['./data/bucket/heatmap_bucket#HeatmapBucket'] = HeatmapBucket;
 registry['./render/draw_heatmap#drawHeatmap'] = drawHeatmap;
 registry['./style/style_layer/hillshade_style_layer#HillshadeStyleLayer'] = HillshadeStyleLayer;
 registry['./render/draw_hillshade#drawHillshade'] = drawHillshade;
 registry['./style/style_layer/line_style_layer#LineStyleLayer'] = LineStyleLayer;
 registry['./data/bucket/line_bucket#LineBucket'] = LineBucket;
 registry['./render/draw_line#drawLine'] = drawLine;
 registry['./style/style_layer/raster_style_layer#RasterStyleLayer'] = RasterStyleLayer;
 registry['./render/draw_raster#drawRaster'] = drawRaster;
 registry['./style/style_layer/symbol_style_layer#SymbolStyleLayer'] = SymbolStyleLayer;
 registry['./data/bucket/symbol_bucket#SymbolBucket'] = SymbolBucket;
 registry['./data/bucket/symbol_bucket#SymbolBuffers'] = SymbolBuffers;
 registry['./render/draw_symbol#drawSymbols'] = drawSymbols;
 registry['./symbol/cross_tile_symbol_index#CrossTileSymbolIndex'] = CrossTileSymbolIndex;
 registry['./style/pauseable_placement#PauseablePlacement'] = PauseablePlacement;
 registry['./symbol/symbol_layout#performSymbolLayout'] = performSymbolLayout;
 registry['./style/style_layer/color_relief_style_layer#ColorReliefStyleLayer'] = ColorReliefStyleLayer;
 registry['./render/draw_color_relief#drawColorRelief'] = drawColorRelief;
 registry['./geo/projection/mercator_projection#MercatorProjection'] = MercatorProjection;
 registry['./geo/projection/mercator_transform#MercatorTransform'] = MercatorTransform;
 registry['./geo/projection/mercator_camera_helper#MercatorCameraHelper'] = MercatorCameraHelper;
 registry['./geo/projection/globe_projection#GlobeProjection'] = GlobeProjection;
 registry['./geo/projection/globe_transform#GlobeTransform'] = GlobeTransform;
 registry['./geo/projection/globe_camera_helper#GlobeCameraHelper'] = GlobeCameraHelper;
 registry['./geo/projection/vertical_perspective_projection#VerticalPerspectiveProjection'] = VerticalPerspectiveProjection;
 registry['./geo/projection/vertical_perspective_transform#VerticalPerspectiveTransform'] = VerticalPerspectiveTransform;
 registry['./geo/projection/vertical_perspective_camera_helper#VerticalPerspectiveCameraHelper'] = VerticalPerspectiveCameraHelper;
 registry['./render/draw_terrain#drawTerrain'] = drawTerrain;
 registry['./render/draw_terrain#drawDepth'] = drawDepth;
 registry['./render/draw_terrain#drawCoords'] = drawCoords;
}