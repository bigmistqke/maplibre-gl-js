import type {StyleLayer} from '../style/style_layer';
import type {SourceClass} from '../source/source';
import type {Painter, RenderOptions} from '../render/painter';
import type {TileManager} from '../tile/tile_manager';
import type {OverscaledTileID} from '../tile/tile_id';
import type {Context} from '../gl/context';
import type {UniformLocations} from '../render/uniform_binding';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {PreparedShader} from '../shaders/shaders';
import type {Style} from '../style/style';
import {ImageManager} from '../render/image_manager';
import {GlyphManager} from '../render/glyph_manager';
import {LineAtlas} from '../render/line_atlas';
import {CrossTileSymbolIndex} from '../symbol/cross_tile_symbol_index';

// Re-export for features to use as keys
export {ImageManager, GlyphManager, LineAtlas, CrossTileSymbolIndex};

// ============================================================================
// Definition types
// ============================================================================

export type DrawFunction = (painter: Painter, tileManager: TileManager, layer: StyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) => void;

export interface LayerDefinition {
    StyleLayer: new (layer: LayerSpecification | any, globalState: Record<string, any>) => StyleLayer;
    Bucket?: any;
    draw: DrawFunction;
}

export interface SourceDefinition {
    Source: SourceClass;
}

export interface ProgramDefinition {
    uniforms: (context: Context, locations: UniformLocations) => any;
    shaderSource: PreparedShader;
}

export type RenderPhase = 'beforeLayers' | 'afterLayers' | 'afterTranslucent';

export interface RenderHook {
    phase: RenderPhase;
    render: (painter: Painter, style: Style) => void;
}

export interface WorkerSourceDefinition {
    WorkerSource: any;
}

export interface TileProcessorDefinition {
    process: (workerTile: any, buckets: any, actor: any) => Promise<any>;
}

// ============================================================================
// Registry type maps - maps string keys to their return types
// ============================================================================

/** Layer type name to definition mapping */
export interface LayerMap {
    background: LayerDefinition;
    fill: LayerDefinition;
    line: LayerDefinition;
    circle: LayerDefinition;
    symbol: LayerDefinition;
    raster: LayerDefinition;
    heatmap: LayerDefinition;
    'fill-extrusion': LayerDefinition;
    hillshade: LayerDefinition;
    'color-relief': LayerDefinition;
}
export type LayerName = keyof LayerMap;

/** Source type name to definition mapping */
export interface SourceMap {
    vector: SourceDefinition;
    geojson: SourceDefinition;
    raster: SourceDefinition;
    'raster-dem': SourceDefinition;
    image: SourceDefinition;
    video: SourceDefinition;
    canvas: SourceDefinition;
}
export type SourceName = keyof SourceMap;

/** Program name to definition mapping */
export interface ProgramMap {
    [name: string]: ProgramDefinition;
}
export type ProgramName = string;

/** Worker source type name to definition mapping */
export interface WorkerSourceMap {
    vector: WorkerSourceDefinition;
    geojson: WorkerSourceDefinition;
    'raster-dem': WorkerSourceDefinition;
}
export type WorkerSourceName = keyof WorkerSourceMap;

/** Manager name to class type mapping */
export interface ManagerMap {
    ImageManager: typeof ImageManager;
    GlyphManager: typeof GlyphManager;
    LineAtlas: typeof LineAtlas;
    CrossTileSymbolIndex: typeof CrossTileSymbolIndex;
}
export type ManagerName = keyof ManagerMap;

export interface Feature {
    sources?: {[K in SourceName]?: SourceMap[K]};
    layers?: {[K in LayerName]?: LayerMap[K]};
    programs?: {[name: string]: ProgramDefinition};
    workerSources?: {[K in WorkerSourceName]?: WorkerSourceMap[K]};
    tileProcessors?: TileProcessorDefinition[];
    renderHooks?: RenderHook[];
    managers?: {[K in ManagerName]?: ManagerMap[K]};
}

/**
 * Maps type names to the feature function that provides them.
 * Used for helpful error messages when a type is not registered.
 */
const featureHints: Record<string, string> = {
    raster: 'raster()',
    background: 'background()',
    fill: 'fill()',
    line: 'line()',
    circle: 'circle()',
    symbol: 'labels()',
    heatmap: 'heatmap()',
    'fill-extrusion': 'fillExtrusion()',
    hillshade: 'elevation(hillshade)',
    'color-relief': 'elevation(colorRelief)',
    sky: 'sky()',
    vector: 'vectorTiles()',
    geojson: 'geojson()',
    'raster-dem': 'elevation()',
    image: 'raster(image)',
    video: 'raster(video)',
    canvas: 'raster(canvas)',
};

function hintMessage(kind: string, type: string): string {
    const hint = featureHints[type];
    if (hint) {
        return `${kind} "${type}" is not available. Add ${hint} to createMap({ use: [${hint}, ...] }).`;
    }
    return `${kind} "${type}" is not available. Add the corresponding feature to createMap({ use: [...] }).`;
}

/**
 * FeatureRegistry is the single access point for all feature-provided definitions.
 * All lookups go through typed getters that produce helpful error messages.
 */
export class FeatureRegistry {
    private _sources: {[K in SourceName]?: SourceMap[K]};
    private _layers: {[K in LayerName]?: LayerMap[K]};
    private _programs: {[name: string]: ProgramDefinition};
    private _workerSources: {[K in WorkerSourceName]?: WorkerSourceMap[K]};
    private _tileProcessors: TileProcessorDefinition[];
    private _renderHooks: RenderHook[];
    private _managers: {[K in ManagerName]?: ManagerMap[K]};

    constructor(features: Feature[]) {
        this._sources = {};
        this._layers = {};
        this._programs = {};
        this._workerSources = {};
        this._tileProcessors = [];
        this._renderHooks = [];
        this._managers = {};

        for (const feature of features) {
            if (feature.sources) Object.assign(this._sources, feature.sources);
            if (feature.layers) Object.assign(this._layers, feature.layers);
            if (feature.programs) Object.assign(this._programs, feature.programs);
            if (feature.workerSources) Object.assign(this._workerSources, feature.workerSources);
            if (feature.tileProcessors) {
                for (const proc of feature.tileProcessors) {
                    if (!this._tileProcessors.includes(proc)) this._tileProcessors.push(proc);
                }
            }
            if (feature.renderHooks) {
                this._renderHooks.push(...feature.renderHooks);
            }
            if (feature.managers) {
                Object.assign(this._managers, feature.managers);
            }
        }
    }

    getLayer<K extends LayerName>(type: K): LayerMap[K] {
        const def = this._layers[type];
        if (!def) throw new Error(hintMessage('Layer type', type));
        return def as LayerMap[K];
    }

    getSource<K extends SourceName>(type: K): SourceMap[K] {
        const def = this._sources[type];
        if (!def) throw new Error(hintMessage('Source type', type));
        return def as SourceMap[K];
    }

    getProgram(name: ProgramName): ProgramDefinition {
        const def = this._programs[name];
        if (!def) throw new Error(`Program "${name}" is not registered by any feature.`);
        return def;
    }

    hasProgram(name: ProgramName): boolean {
        return name in this._programs;
    }

    getWorkerSource<K extends WorkerSourceName>(type: K): WorkerSourceMap[K] {
        const def = this._workerSources[type];
        if (!def) throw new Error(hintMessage('Worker source', type));
        return def as WorkerSourceMap[K];
    }

    hasWorkerSource(type: string): boolean {
        return type in this._workerSources;
    }

    getBucket<K extends LayerName>(layerType: K): LayerMap[K]['Bucket'] | undefined {
        return this._layers[layerType]?.Bucket;
    }

    getRenderHooks(phase: RenderPhase): RenderHook[] {
        return this._renderHooks.filter(h => h.phase === phase);
    }

    get tileProcessors(): TileProcessorDefinition[] {
        return this._tileProcessors;
    }

    getManager<K extends ManagerName>(name: K): ManagerMap[K] | undefined {
        return this._managers[name] as ManagerMap[K] | undefined;
    }
}

/**
 * Merge multiple features into a single feature.
 */
export function merge(...features: Feature[]): Feature {
    const merged: Feature = {};

    for (const feature of features) {
        if (feature.sources) {
            merged.sources = merged.sources || {};
            Object.assign(merged.sources, feature.sources);
        }
        if (feature.layers) {
            merged.layers = merged.layers || {};
            Object.assign(merged.layers, feature.layers);
        }
        if (feature.programs) {
            merged.programs = merged.programs || {};
            Object.assign(merged.programs, feature.programs);
        }
        if (feature.workerSources) {
            merged.workerSources = merged.workerSources || {};
            Object.assign(merged.workerSources, feature.workerSources);
        }
        if (feature.tileProcessors) {
            merged.tileProcessors = merged.tileProcessors || [];
            for (const proc of feature.tileProcessors) {
                if (!merged.tileProcessors.includes(proc)) merged.tileProcessors.push(proc);
            }
        }
        if (feature.renderHooks) {
            merged.renderHooks = merged.renderHooks || [];
            merged.renderHooks.push(...feature.renderHooks);
        }
        if (feature.managers) {
            merged.managers = merged.managers || {};
            Object.assign(merged.managers, feature.managers);
        }
    }

    return merged;
}
