import type { PreparedShader } from './shaders/shaders';
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { StyleLayer } from './style/style_layer';
import type { Painter, RenderOptions } from './render/painter';
import type { SourceCache } from './source/source_cache';
import type { OverscaledTileID } from './source/tile_id';
import type { CanvasSource } from './source/canvas_source';
import type { GeoJSONSource } from './source/geojson_source';
import type { ImageSource } from './source/image_source';
import type { RasterDEMTileSource } from './source/raster_dem_tile_source';
import type { RasterTileSource } from './source/raster_tile_source';
import type { VectorTileSource } from './source/vector_tile_source';
import type { VideoSource } from './source/video_source';
import type { BackgroundStyleLayer } from './style/style_layer/background_style_layer';
import type { CircleStyleLayer } from './style/style_layer/circle_style_layer';
import type { ColorReliefStyleLayer } from './style/style_layer/color_relief_style_layer';
import type { FillExtrusionStyleLayer } from './style/style_layer/fill_extrusion_style_layer';
import type { FillStyleLayer } from './style/style_layer/fill_style_layer';
import type { HeatmapStyleLayer } from './style/style_layer/heatmap_style_layer';
import type { HillshadeStyleLayer } from './style/style_layer/hillshade_style_layer';
import type { LineStyleLayer } from './style/style_layer/line_style_layer';
import type { RasterStyleLayer } from './style/style_layer/raster_style_layer';
import type { SymbolStyleLayer } from './style/style_layer/symbol_style_layer';
import type { CircleBucket } from './data/bucket/circle_bucket';
import type { FillBucket } from './data/bucket/fill_bucket';
import type { FillExtrusionBucket } from './data/bucket/fill_extrusion_bucket';
import type { HeatmapBucket } from './data/bucket/heatmap_bucket';
import type { LineBucket } from './data/bucket/line_bucket';
import type { SymbolBucket } from './data/bucket/symbol_bucket';
import type { CrossTileSymbolIndex } from './symbol/cross_tile_symbol_index';
import type { PauseablePlacement } from './style/pauseable_placement';
import type { Terrain } from './render/terrain';
import type { Tile } from './source/tile';
import type { Projection } from './geo/projection/projection';
import type { ITransform } from './geo/transform_interface';
import type { ICameraHelper } from './geo/projection/camera_helper';
import { type MercatorProjection } from './geo/projection/mercator_projection';
import { type MercatorCameraHelper, type MercatorTransform } from './core';
import { type GlobeTransform } from './geo/projection/globe_transform';
import { type GlobeCameraHelper } from './geo/projection/globe_camera_helper';
import { type GlobeProjection } from './geo/projection/globe_projection';
import { type VerticalPerspectiveProjection } from './geo/projection/vertical_perspective_projection';
import { type VerticalPerspectiveTransform } from './geo/projection/vertical_perspective_transform';
import { type VerticalPerspectiveCameraHelper } from './geo/projection/vertical_perspective_camera_helper';
export type DrawFunction = (painter: Painter, sourceCache: SourceCache, layer: StyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) => void;
export type DrawTerrainFunction = (painter: Painter, terrain: Terrain, tiles: Array<Tile>, renderOptions: RenderOptions) => void;
export type DrawTerrainDepthFunction = (painter: Painter, terrain: Terrain) => void;
export type DrawTerrainCoordsFunction = (painter: Painter, terrain: Terrain) => void;
export type PerformSymbolLayoutFunction = (args: any) => void;
export type LayerFactory = (layer: LayerSpecification, globalState: Record<string, any>) => StyleLayer;
export interface SourceRegistry {
    canvas?: typeof CanvasSource;
    geojson?: typeof GeoJSONSource;
    image?: typeof ImageSource;
    'raster-dem'?: typeof RasterDEMTileSource;
    raster?: typeof RasterTileSource;
    vector?: typeof VectorTileSource;
    video?: typeof VideoSource;
}
export interface LayerRegistry {
    background?: typeof BackgroundStyleLayer;
    circle?: typeof CircleStyleLayer;
    'color-relief'?: typeof ColorReliefStyleLayer;
    'fill-extrusion'?: typeof FillExtrusionStyleLayer;
    fill?: typeof FillStyleLayer;
    heatmap?: typeof HeatmapStyleLayer;
    hillshade?: typeof HillshadeStyleLayer;
    line?: typeof LineStyleLayer;
    raster?: typeof RasterStyleLayer;
    symbol?: typeof SymbolStyleLayer;
}
export interface DrawFunctionRegistry {
    background?: DrawFunction;
    circle?: DrawFunction;
    'fill-extrusion'?: DrawFunction;
    fill?: DrawFunction;
    heatmap?: DrawFunction;
    hillshade?: DrawFunction;
    line?: DrawFunction;
    raster?: DrawFunction;
    'color-relief'?: DrawFunction;
    symbol?: DrawFunction;
}
export interface ShaderRegistry {
    atmosphere?: PreparedShader;
    background?: PreparedShader;
    backgroundPattern?: PreparedShader;
    circle?: PreparedShader;
    clippingMask?: PreparedShader;
    collisionBox?: PreparedShader;
    collisionCircle?: PreparedShader;
    debug?: PreparedShader;
    depth?: PreparedShader;
    fillExtrusion?: PreparedShader;
    fillExtrusionPattern?: PreparedShader;
    fill?: PreparedShader;
    fillOutline?: PreparedShader;
    fillPattern?: PreparedShader;
    fillOutlinePattern?: PreparedShader;
    heatmap?: PreparedShader;
    heatmapTexture?: PreparedShader;
    hillshade?: PreparedShader;
    hillshadePrepare?: PreparedShader;
    line?: PreparedShader;
    lineGradient?: PreparedShader;
    linePattern?: PreparedShader;
    lineSDF?: PreparedShader;
    prelude?: PreparedShader;
    projectionErrorMeasurement?: PreparedShader;
    projectionMercator?: PreparedShader;
    projectionGlobe?: PreparedShader;
    raster?: PreparedShader;
    colorRelief?: PreparedShader;
    sky?: PreparedShader;
    symbolIcon?: PreparedShader;
    symbolSDF?: PreparedShader;
    symbolTextAndIcon?: PreparedShader;
    terrain?: PreparedShader;
    terrainDepth?: PreparedShader;
    terrainCoords?: PreparedShader;
}
export interface BucketRegistry {
    circle?: typeof CircleBucket;
    fill?: typeof FillBucket;
    'fill-extrusion'?: typeof FillExtrusionBucket;
    heatmap?: typeof HeatmapBucket;
    line?: typeof LineBucket;
    symbol?: typeof SymbolBucket;
}
export interface SymbolRegistry {
    SymbolBucket?: typeof SymbolBucket;
    CrossTileSymbolIndex?: typeof CrossTileSymbolIndex;
    PauseablePlacement?: typeof PauseablePlacement;
    performSymbolLayout?: PerformSymbolLayoutFunction;
}
export interface TerrainRegistry {
    drawTerrain?: DrawTerrainFunction;
    drawDepth?: DrawTerrainDepthFunction;
    drawCoords?: DrawTerrainCoordsFunction;
}
export type ProjectionKind = {
    projection: new () => Projection;
    transform: new () => ITransform;
    cameraHelper: new () => ICameraHelper;
};
export interface ProjectionRegistry {
    mercator?: {
        projection: typeof MercatorProjection;
        transform: typeof MercatorTransform;
        cameraHelper: typeof MercatorCameraHelper;
    };
    globe?: {
        projection: typeof GlobeProjection;
        transform: typeof GlobeTransform;
        cameraHelper: typeof GlobeCameraHelper;
    };
    'vertical-perspective'?: {
        projection: typeof VerticalPerspectiveProjection;
        transform: typeof VerticalPerspectiveTransform;
        cameraHelper: typeof VerticalPerspectiveCameraHelper;
    };
}
export declare const registry: {
    source: SourceRegistry;
    layer: LayerRegistry;
    draw: DrawFunctionRegistry;
    shader: ShaderRegistry;
    bucket: BucketRegistry;
    symbol: SymbolRegistry;
    terrain: TerrainRegistry;
    projection: ProjectionRegistry;
};
//# sourceMappingURL=registry.d.ts.map