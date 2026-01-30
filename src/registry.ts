import type { ImageSource } from './source/image_source';
import type { CanvasSource } from './source/canvas_source';
import type { GeoJSONSource } from './source/geojson_source';
import type { VideoSource } from './source/video_source';
import type { RasterTileSource } from './source/raster_tile_source';
import type { RasterDEMTileSource } from './source/raster_dem_tile_source';
import type { VectorTileSource } from './source/vector_tile_source';
import type { BackgroundStyleLayer } from './style/style_layer/background_style_layer';
import type { drawBackground } from './render/draw_background';
import type { CircleStyleLayer } from './style/style_layer/circle_style_layer';
import type { CircleBucket } from './data/bucket/circle_bucket';
import type { drawCircles } from './render/draw_circle';
import type { FillStyleLayer } from './style/style_layer/fill_style_layer';
import type { FillBucket } from './data/bucket/fill_bucket';
import type { drawFill } from './render/draw_fill';
import type { FillExtrusionStyleLayer } from './style/style_layer/fill_extrusion_style_layer';
import type { FillExtrusionBucket } from './data/bucket/fill_extrusion_bucket';
import type { drawFillExtrusion } from './render/draw_fill_extrusion';
import type { HeatmapStyleLayer } from './style/style_layer/heatmap_style_layer';
import type { HeatmapBucket } from './data/bucket/heatmap_bucket';
import type { drawHeatmap } from './render/draw_heatmap';
import type { HillshadeStyleLayer } from './style/style_layer/hillshade_style_layer';
import type { drawHillshade } from './render/draw_hillshade';
import type { LineStyleLayer } from './style/style_layer/line_style_layer';
import type { LineBucket } from './data/bucket/line_bucket';
import type { drawLine } from './render/draw_line';
import type { RasterStyleLayer } from './style/style_layer/raster_style_layer';
import type { drawRaster } from './render/draw_raster';
import type { SymbolStyleLayer } from './style/style_layer/symbol_style_layer';
import type { SymbolBucket, SymbolBuffers } from './data/bucket/symbol_bucket';
import type { drawSymbols } from './render/draw_symbol';
import type { CrossTileSymbolIndex } from './symbol/cross_tile_symbol_index';
import type { PauseablePlacement } from './style/pauseable_placement';
import type { performSymbolLayout } from './symbol/symbol_layout';
import type { ColorReliefStyleLayer } from './style/style_layer/color_relief_style_layer';
import type { drawColorRelief } from './render/draw_color_relief';
import type { MercatorProjection } from './geo/projection/mercator_projection';
import type { MercatorTransform } from './geo/projection/mercator_transform';
import type { MercatorCameraHelper } from './geo/projection/mercator_camera_helper';
import type { GlobeProjection } from './geo/projection/globe_projection';
import type { GlobeTransform } from './geo/projection/globe_transform';
import type { GlobeCameraHelper } from './geo/projection/globe_camera_helper';
import type { VerticalPerspectiveProjection } from './geo/projection/vertical_perspective_projection';
import type { VerticalPerspectiveTransform } from './geo/projection/vertical_perspective_transform';
import type { VerticalPerspectiveCameraHelper } from './geo/projection/vertical_perspective_camera_helper';
import type { drawTerrain, drawDepth, drawCoords } from './render/draw_terrain';

type HarvestRegistry = {
 './source/image_source#ImageSource': typeof ImageSource,
 './source/canvas_source#CanvasSource': typeof CanvasSource,
 './source/geojson_source#GeoJSONSource': typeof GeoJSONSource,
 './source/video_source#VideoSource': typeof VideoSource,
 './source/raster_tile_source#RasterTileSource': typeof RasterTileSource,
 './source/raster_dem_tile_source#RasterDEMTileSource': typeof RasterDEMTileSource,
 './source/vector_tile_source#VectorTileSource': typeof VectorTileSource,
 './style/style_layer/background_style_layer#BackgroundStyleLayer': typeof BackgroundStyleLayer,
 './render/draw_background#drawBackground': typeof drawBackground,
 './style/style_layer/circle_style_layer#CircleStyleLayer': typeof CircleStyleLayer,
 './data/bucket/circle_bucket#CircleBucket': typeof CircleBucket,
 './render/draw_circle#drawCircles': typeof drawCircles,
 './style/style_layer/fill_style_layer#FillStyleLayer': typeof FillStyleLayer,
 './data/bucket/fill_bucket#FillBucket': typeof FillBucket,
 './render/draw_fill#drawFill': typeof drawFill,
 './style/style_layer/fill_extrusion_style_layer#FillExtrusionStyleLayer': typeof FillExtrusionStyleLayer,
 './data/bucket/fill_extrusion_bucket#FillExtrusionBucket': typeof FillExtrusionBucket,
 './render/draw_fill_extrusion#drawFillExtrusion': typeof drawFillExtrusion,
 './style/style_layer/heatmap_style_layer#HeatmapStyleLayer': typeof HeatmapStyleLayer,
 './data/bucket/heatmap_bucket#HeatmapBucket': typeof HeatmapBucket,
 './render/draw_heatmap#drawHeatmap': typeof drawHeatmap,
 './style/style_layer/hillshade_style_layer#HillshadeStyleLayer': typeof HillshadeStyleLayer,
 './render/draw_hillshade#drawHillshade': typeof drawHillshade,
 './style/style_layer/line_style_layer#LineStyleLayer': typeof LineStyleLayer,
 './data/bucket/line_bucket#LineBucket': typeof LineBucket,
 './render/draw_line#drawLine': typeof drawLine,
 './style/style_layer/raster_style_layer#RasterStyleLayer': typeof RasterStyleLayer,
 './render/draw_raster#drawRaster': typeof drawRaster,
 './style/style_layer/symbol_style_layer#SymbolStyleLayer': typeof SymbolStyleLayer,
 './data/bucket/symbol_bucket#SymbolBucket': typeof SymbolBucket,
 './data/bucket/symbol_bucket#SymbolBuffers': typeof SymbolBuffers,
 './render/draw_symbol#drawSymbols': typeof drawSymbols,
 './symbol/cross_tile_symbol_index#CrossTileSymbolIndex': typeof CrossTileSymbolIndex,
 './style/pauseable_placement#PauseablePlacement': typeof PauseablePlacement,
 './symbol/symbol_layout#performSymbolLayout': typeof performSymbolLayout,
 './style/style_layer/color_relief_style_layer#ColorReliefStyleLayer': typeof ColorReliefStyleLayer,
 './render/draw_color_relief#drawColorRelief': typeof drawColorRelief,
 './geo/projection/mercator_projection#MercatorProjection': typeof MercatorProjection,
 './geo/projection/mercator_transform#MercatorTransform': typeof MercatorTransform,
 './geo/projection/mercator_camera_helper#MercatorCameraHelper': typeof MercatorCameraHelper,
 './geo/projection/globe_projection#GlobeProjection': typeof GlobeProjection,
 './geo/projection/globe_transform#GlobeTransform': typeof GlobeTransform,
 './geo/projection/globe_camera_helper#GlobeCameraHelper': typeof GlobeCameraHelper,
 './geo/projection/vertical_perspective_projection#VerticalPerspectiveProjection': typeof VerticalPerspectiveProjection,
 './geo/projection/vertical_perspective_transform#VerticalPerspectiveTransform': typeof VerticalPerspectiveTransform,
 './geo/projection/vertical_perspective_camera_helper#VerticalPerspectiveCameraHelper': typeof VerticalPerspectiveCameraHelper,
 './render/draw_terrain#drawTerrain': typeof drawTerrain,
 './render/draw_terrain#drawDepth': typeof drawDepth,
 './render/draw_terrain#drawCoords': typeof drawCoords
};

const dependencyRegisterFunctionNames: Record<string, string[]> = {
  './source/image_source#ImageSource': ['registerImageSourceFeature'],
  './source/canvas_source#CanvasSource': ['registerCanvasSourceFeature'],
  './source/geojson_source#GeoJSONSource': ['registerGeojsonSourceFeature'],
  './source/video_source#VideoSource': ['registerVideoSourceFeature'],
  './source/raster_tile_source#RasterTileSource': ['registerRasterSourceFeature'],
  './source/raster_dem_tile_source#RasterDEMTileSource': ['registerRasterDemSourceFeature'],
  './source/vector_tile_source#VectorTileSource': ['registerVectorSourceFeature'],
  './style/style_layer/background_style_layer#BackgroundStyleLayer': ['registerBackgroundLayerFeature'],
  './render/draw_background#drawBackground': ['registerBackgroundLayerFeature'],
  './style/style_layer/circle_style_layer#CircleStyleLayer': ['registerCircleLayerFeature'],
  './data/bucket/circle_bucket#CircleBucket': ['registerCircleLayerFeature'],
  './render/draw_circle#drawCircles': ['registerCircleLayerFeature'],
  './style/style_layer/fill_style_layer#FillStyleLayer': ['registerFillLayerFeature'],
  './data/bucket/fill_bucket#FillBucket': ['registerFillLayerFeature'],
  './render/draw_fill#drawFill': ['registerFillLayerFeature'],
  './style/style_layer/fill_extrusion_style_layer#FillExtrusionStyleLayer': ['registerFillExtrusionLayerFeature'],
  './data/bucket/fill_extrusion_bucket#FillExtrusionBucket': ['registerFillExtrusionLayerFeature'],
  './render/draw_fill_extrusion#drawFillExtrusion': ['registerFillExtrusionLayerFeature'],
  './style/style_layer/heatmap_style_layer#HeatmapStyleLayer': ['registerHeatmapLayerFeature'],
  './data/bucket/heatmap_bucket#HeatmapBucket': ['registerHeatmapLayerFeature'],
  './render/draw_heatmap#drawHeatmap': ['registerHeatmapLayerFeature'],
  './style/style_layer/hillshade_style_layer#HillshadeStyleLayer': ['registerHillshadeLayerFeature'],
  './render/draw_hillshade#drawHillshade': ['registerHillshadeLayerFeature'],
  './style/style_layer/line_style_layer#LineStyleLayer': ['registerLineLayerFeature'],
  './data/bucket/line_bucket#LineBucket': ['registerLineLayerFeature'],
  './render/draw_line#drawLine': ['registerLineLayerFeature'],
  './style/style_layer/raster_style_layer#RasterStyleLayer': ['registerRasterLayerFeature'],
  './render/draw_raster#drawRaster': ['registerRasterLayerFeature'],
  './style/style_layer/symbol_style_layer#SymbolStyleLayer': ['registerSymbolLayerFeature'],
  './data/bucket/symbol_bucket#SymbolBucket': ['registerSymbolLayerFeature'],
  './data/bucket/symbol_bucket#SymbolBuffers': ['registerSymbolLayerFeature'],
  './render/draw_symbol#drawSymbols': ['registerSymbolLayerFeature'],
  './symbol/cross_tile_symbol_index#CrossTileSymbolIndex': ['registerSymbolLayerFeature'],
  './style/pauseable_placement#PauseablePlacement': ['registerSymbolLayerFeature'],
  './symbol/symbol_layout#performSymbolLayout': ['registerSymbolLayerFeature'],
  './style/style_layer/color_relief_style_layer#ColorReliefStyleLayer': ['registerColorReliefLayerFeature'],
  './render/draw_color_relief#drawColorRelief': ['registerColorReliefLayerFeature'],
  './geo/projection/mercator_projection#MercatorProjection': ['registerMercatorProjectionFeature'],
  './geo/projection/mercator_transform#MercatorTransform': ['registerMercatorProjectionFeature'],
  './geo/projection/mercator_camera_helper#MercatorCameraHelper': ['registerMercatorProjectionFeature'],
  './geo/projection/globe_projection#GlobeProjection': ['registerGlobeProjectionFeature'],
  './geo/projection/globe_transform#GlobeTransform': ['registerGlobeProjectionFeature'],
  './geo/projection/globe_camera_helper#GlobeCameraHelper': ['registerGlobeProjectionFeature'],
  './geo/projection/vertical_perspective_projection#VerticalPerspectiveProjection': ['registerVerticalPerspectiveProjectionFeature'],
  './geo/projection/vertical_perspective_transform#VerticalPerspectiveTransform': ['registerVerticalPerspectiveProjectionFeature'],
  './geo/projection/vertical_perspective_camera_helper#VerticalPerspectiveCameraHelper': ['registerVerticalPerspectiveProjectionFeature'],
  './render/draw_terrain#drawTerrain': ['registerTerrainFeature'],
  './render/draw_terrain#drawDepth': ['registerTerrainFeature'],
  './render/draw_terrain#drawCoords': ['registerTerrainFeature']
};

export function getFromHarvestRegistry<T extends keyof HarvestRegistry>(key: T): HarvestRegistry[T] | undefined {
  const value = registry[key];
  if (value === undefined) {
    const registerFns = dependencyRegisterFunctionNames[key];
    if (registerFns) {
      console.warn(`[harvestry] Accessing unregistered feature '${key}'. Call ${registerFns.join(' or ')} to register it.`);
    } else {
      console.warn(`[harvestry] Accessing unknown feature '${key}'.`);
    }
  }
  return value;
}

export const registry = {} as HarvestRegistry;