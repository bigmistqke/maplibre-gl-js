import type {SourceClass} from './source/source';
import type {StyleLayerClass} from './style/style_layer';
import type {HandlerFactory} from './ui/handler_manager';
import type {DrawFunction} from './render/draw_registry';
import type {PreparedShader} from './shaders/shaders';
import type {CrossTileSymbolIndexConstructor, PauseablePlacementConstructor} from './symbol/symbol_registry';

/**
 * Source registry type with specific source type keys
 */
export interface SourceRegistry {
    canvas?: SourceClass;
    geojson?: SourceClass;
    image?: SourceClass;
    'raster-dem'?: SourceClass;
    raster?: SourceClass;
    vector?: SourceClass;
    video?: SourceClass;
};

/**
 * Layer registry type with specific layer type keys
 */
export interface LayerRegistry {
    background?: StyleLayerClass;
    circle?: StyleLayerClass;
    'color-relief'?: StyleLayerClass;
    'fill-extrusion'?: StyleLayerClass;
    fill?: StyleLayerClass;
    heatmap?: StyleLayerClass;
    hillshade?: StyleLayerClass;
    line?: StyleLayerClass;
    raster?: StyleLayerClass;
    symbol?: StyleLayerClass;
};

/**
 * Handler registry type with specific handler keys
 */
export interface HandlerRegistry {
    mousePan?: HandlerFactory;
    mousePitch?: HandlerFactory;
    mouseRoll?: HandlerFactory;
    mouseRotate?: HandlerFactory;
    touchPan?: HandlerFactory;
    touchRotate?: HandlerFactory;
    touchZoom?: HandlerFactory;
    clickZoom?: HandlerFactory;
    tapZoom?: HandlerFactory;
    tapDragZoom?: HandlerFactory;
    boxZoom?: HandlerFactory;
    cooperativeGestures?: HandlerFactory;
    doubleClickZoom?: HandlerFactory;
    dragPan?: HandlerFactory;
    dragRotate?: HandlerFactory;
    touchZoomRotate?: HandlerFactory;
    touchPitch?: HandlerFactory;
    scrollZoom?: HandlerFactory;
    keyboard?: HandlerFactory;
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
    CrossTileSymbolIndex?: CrossTileSymbolIndexConstructor;
    PauseablePlacement?: PauseablePlacementConstructor;
};

/**
 * Global registries for tree-shaking
 * Set these to register sources, layers, handlers, draws, and shaders
 */
export const registry = {
    source: {} as SourceRegistry,
    layer: {} as LayerRegistry,
    handler: {} as HandlerRegistry,
    drawFunction: {} as DrawFunctionRegistry,
    shader: {} as ShaderRegistry,
    symbol: {} as SymbolRegistry
};
