import type {PreparedShader} from './shaders/shaders';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {StyleLayer} from './style/style_layer';
import type {Painter, RenderOptions} from './render/painter';
import type {SourceCache} from './source/source_cache';
import type {OverscaledTileID} from './source/tile_id';

/**
 * Draw function type - handles rendering for a specific layer type
 */
export type DrawFunction = (
    painter: Painter,
    sourceCache: SourceCache,
    layer: StyleLayer,
    coords: Array<OverscaledTileID>,
    renderOptions: RenderOptions
) => void;

/**
 * Symbol system function type for lazy initialization
 */
export type PerformSymbolLayoutFunction = (args: any) => void;

// Source types
import type {CanvasSource} from './source/canvas_source';
import type {GeoJSONSource} from './source/geojson_source';
import type {ImageSource} from './source/image_source';
import type {RasterDEMTileSource} from './source/raster_dem_tile_source';
import type {RasterTileSource} from './source/raster_tile_source';
import type {VectorTileSource} from './source/vector_tile_source';
import type {VideoSource} from './source/video_source';

// Layer types
import type {BackgroundStyleLayer} from './style/style_layer/background_style_layer';
import type {CircleStyleLayer} from './style/style_layer/circle_style_layer';
import type {ColorReliefStyleLayer} from './style/style_layer/color_relief_style_layer';
import type {FillExtrusionStyleLayer} from './style/style_layer/fill_extrusion_style_layer';
import type {FillStyleLayer} from './style/style_layer/fill_style_layer';
import type {HeatmapStyleLayer} from './style/style_layer/heatmap_style_layer';
import type {HillshadeStyleLayer} from './style/style_layer/hillshade_style_layer';
import type {LineStyleLayer} from './style/style_layer/line_style_layer';
import type {RasterStyleLayer} from './style/style_layer/raster_style_layer';
import type {SymbolStyleLayer} from './style/style_layer/symbol_style_layer';

// Symbol types
import type {CrossTileSymbolIndex} from './symbol/cross_tile_symbol_index';
import type {PauseablePlacement} from './style/pauseable_placement';
import type {SymbolBucket} from './data/bucket/symbol_bucket';

/**
 * Layer factory function type for registry
 * Factory receives layer spec and global state, returns a StyleLayer instance
 */
export type LayerFactory = (layer: LayerSpecification, globalState: Record<string, any>) => StyleLayer;

/**
 * Source registry type with specific source type keys
 */
export interface SourceRegistry {
    canvas?: typeof CanvasSource;
    geojson?: typeof GeoJSONSource;
    image?: typeof ImageSource;
    'raster-dem'?: typeof RasterDEMTileSource;
    raster?: typeof RasterTileSource;
    vector?: typeof VectorTileSource;
    video?: typeof VideoSource;
};

/**
 * Layer registry type with specific layer type keys
 */
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
};

/**
 * Draw function registry type with specific layer type keys
 */
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
};

/**
 * Shader registry type with specific shader keys
 */
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
};

/**
 * Symbol dependencies registry type
 */
export interface SymbolRegistry {
    SymbolBucket?: typeof SymbolBucket;
    CrossTileSymbolIndex?: typeof CrossTileSymbolIndex;
    PauseablePlacement?: typeof PauseablePlacement;
    performSymbolLayout?: PerformSymbolLayoutFunction;
};

/**
 * Global registries for tree-shaking
 * Set these to register sources, layers, draws, and shaders
 */
export const registry = {
    source: {} as SourceRegistry,
    layer: {} as LayerRegistry,
    draw: {} as DrawFunctionRegistry,
    shader: {} as ShaderRegistry,
    symbol: {} as SymbolRegistry
};
