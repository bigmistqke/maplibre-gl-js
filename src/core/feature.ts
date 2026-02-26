import type {StyleLayer} from '../style/style_layer';
import type {SourceClass} from '../source/source';
import type {Painter, RenderOptions} from '../render/painter';
import type {TileManager} from '../tile/tile_manager';
import type {OverscaledTileID} from '../tile/tile_id';
import type {Context} from '../gl/context';
import type {UniformLocations} from '../render/uniform_binding';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';

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
}

export interface WorkerSourceDefinition {
    WorkerSource: any;
}

export interface TileProcessorDefinition {
    process: (workerTile: any, buckets: any, actor: any) => Promise<any>;
}

export interface Feature {
    sources?: Record<string, SourceDefinition>;
    layers?: Record<string, LayerDefinition>;
    programs?: Record<string, ProgramDefinition>;
    workerSources?: Record<string, WorkerSourceDefinition>;
    tileProcessors?: TileProcessorDefinition[];
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
    private _sources: Record<string, SourceDefinition>;
    private _layers: Record<string, LayerDefinition>;
    private _programs: Record<string, ProgramDefinition>;
    private _workerSources: Record<string, WorkerSourceDefinition>;
    private _tileProcessors: TileProcessorDefinition[];

    constructor(features: Feature[]) {
        this._sources = {};
        this._layers = {};
        this._programs = {};
        this._workerSources = {};
        this._tileProcessors = [];

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
        }
    }

    getLayer(type: string): LayerDefinition {
        const def = this._layers[type];
        if (!def) throw new Error(hintMessage('Layer type', type));
        return def;
    }

    getSource(type: string): SourceDefinition {
        const def = this._sources[type];
        if (!def) throw new Error(hintMessage('Source type', type));
        return def;
    }

    getProgram(name: string): ProgramDefinition {
        const def = this._programs[name];
        if (!def) throw new Error(`Program "${name}" is not registered by any feature.`);
        return def;
    }

    get tileProcessors(): TileProcessorDefinition[] {
        return this._tileProcessors;
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
    }

    return merged;
}
