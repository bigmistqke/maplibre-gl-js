import { Evented } from '../util/evented';
import { type StyleLayer } from './style_layer';
import { ImageManager } from '../render/image_manager';
import { GlyphManager } from '../render/glyph_manager';
import { Light } from './light';
import { Sky } from './sky';
import { LineAtlas } from '../render/line_atlas';
import { Dispatcher } from '../util/dispatcher';
import { type Source } from '../source/source';
import { type QueryRenderedFeaturesOptions, type QueryRenderedFeaturesResults, type QuerySourceFeatureOptions } from '../source/query_features';
import { SourceCache } from '../source/source_cache';
import { type DiffCommand } from '@maplibre/maplibre-gl-style-spec';
import { ZoomHistory } from './zoom_history';
import type { MapGeoJSONFeature } from '../util/vectortile_to_geojson';
import type Point from '@mapbox/point-geometry';
import type { Map } from '../ui/map';
import type { IReadonlyTransform, ITransform } from '../geo/transform_interface';
import type { StyleImage } from './style_image';
import type { EvaluationParameters } from './evaluation_parameters';
import type { LayerSpecification, FilterSpecification, StyleSpecification, LightSpecification, SourceSpecification, SpriteSpecification, DiffOperations, ProjectionSpecification, SkySpecification, StateSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { CanvasSourceSpecification } from '../source/canvas_source';
import type { CustomLayerInterface } from './style_layer/custom_style_layer';
import type { Validator } from './validate_style';
import { type GetGlyphsParameters, type GetGlyphsResponse, type GetImagesParameters, type GetImagesResponse } from '../util/actor_messages';
import { type Projection } from '../geo/projection/projection';
export type FeatureIdentifier = {
    id?: string | number | undefined;
    source: string;
    sourceLayer?: string | undefined;
};
export type StyleOptions = {
    validate?: boolean;
    localIdeographFontFamily?: string | false;
};
export type StyleSetterOptions = {
    validate?: boolean;
};
export type TransformStyleFunction = (previous: StyleSpecification | undefined, next: StyleSpecification) => StyleSpecification;
export type StyleSwapOptions = {
    diff?: boolean;
    transformStyle?: TransformStyleFunction;
};
export type AddLayerObject = LayerSpecification | (Omit<LayerSpecification, 'source'> & {
    source: SourceSpecification;
}) | CustomLayerInterface;
export declare class Style extends Evented {
    map: Map;
    stylesheet: StyleSpecification;
    dispatcher: Dispatcher;
    imageManager: ImageManager;
    glyphManager: GlyphManager;
    lineAtlas: LineAtlas;
    light: Light;
    projection: Projection | undefined;
    sky: Sky;
    _frameRequest: AbortController;
    _loadStyleRequest: AbortController;
    _spriteRequest: AbortController;
    _layers: {
        [_: string]: StyleLayer;
    };
    _serializedLayers: {
        [_: string]: LayerSpecification;
    };
    _order: Array<string>;
    sourceCaches: {
        [_: string]: SourceCache;
    };
    zoomHistory: ZoomHistory;
    _loaded: boolean;
    _changed: boolean;
    _updatedSources: {
        [_: string]: 'clear' | 'reload';
    };
    _updatedLayers: {
        [_: string]: true;
    };
    _removedLayers: {
        [_: string]: StyleLayer;
    };
    _changedImages: {
        [_: string]: true;
    };
    _glyphsDidChange: boolean;
    _updatedPaintProps: {
        [layer: string]: true;
    };
    _layerOrderChanged: boolean;
    _spritesImagesIds: {
        [spriteId: string]: string[];
    };
    _availableImages: Array<string>;
    _globalState: Record<string, any>;
    crossTileSymbolIndex: any;
    pauseablePlacement: any;
    placement: any;
    z: number;
    constructor(map: Map, options?: StyleOptions);
    _rtlPluginLoaded: () => void;
    setGlobalStateProperty(name: string, value: any): this;
    getGlobalState(): Record<string, any>;
    setGlobalState(newStylesheetState: StateSpecification): void;
    _applyGlobalStateChanges(globalStateRefs: string[]): void;
    loadURL(url: string, options?: StyleSwapOptions & StyleSetterOptions, previousStyle?: StyleSpecification): void;
    loadJSON(json: StyleSpecification, options?: StyleSetterOptions & StyleSwapOptions, previousStyle?: StyleSpecification): void;
    loadEmpty(): void;
    _load(json: StyleSpecification, options: StyleSwapOptions & StyleSetterOptions, previousStyle?: StyleSpecification): void;
    private _createLayers;
    _loadSprite(sprite: SpriteSpecification, isUpdate?: boolean, completion?: (err: Error) => void): void;
    _unloadSprite(): void;
    _validateLayer(layer: StyleLayer): void;
    loaded(): boolean;
    private _serializeByIds;
    private _serializedAllLayers;
    hasTransitions(): boolean;
    _checkLoaded(): void;
    update(parameters: EvaluationParameters): void;
    _updateTilesForChangedImages(): void;
    _updateTilesForChangedGlyphs(): void;
    _updateWorkerLayers(updatedIds: Array<string>, removedIds: Array<string>): void;
    _resetUpdates(): void;
    setState(nextState: StyleSpecification, options?: StyleSwapOptions & StyleSetterOptions): boolean;
    _getOperationsToPerform(diff: DiffCommand<DiffOperations>[]): {
        operations: Function[];
        unimplemented: string[];
    };
    addImage(id: string, image: StyleImage): this;
    updateImage(id: string, image: StyleImage): void;
    getImage(id: string): StyleImage;
    removeImage(id: string): this;
    _afterImageUpdated(id: string): void;
    listImages(): string[];
    addSource(id: string, source: SourceSpecification | CanvasSourceSpecification, options?: StyleSetterOptions): void;
    removeSource(id: string): this;
    setGeoJSONSourceData(id: string, data: GeoJSON.GeoJSON | string): void;
    getSource(id: string): Source | undefined;
    addLayer(layerObject: AddLayerObject, before?: string, options?: StyleSetterOptions): this;
    moveLayer(id: string, before?: string): void;
    removeLayer(id: string): void;
    getLayer(id: string): StyleLayer | undefined;
    getLayersOrder(): string[];
    hasLayer(id: string): boolean;
    setLayerZoomRange(layerId: string, minzoom?: number | null, maxzoom?: number | null): void;
    setFilter(layerId: string, filter?: FilterSpecification | null, options?: StyleSetterOptions): void;
    getFilter(layer: string): FilterSpecification | void;
    setLayoutProperty(layerId: string, name: string, value: any, options?: StyleSetterOptions): void;
    getLayoutProperty(layerId: string, name: string): any;
    setPaintProperty(layerId: string, name: string, value: any, options?: StyleSetterOptions): void;
    _updatePaintProperty(layer: StyleLayer, name: string, value: any, options?: StyleSetterOptions): void;
    getPaintProperty(layer: string, name: string): unknown;
    setFeatureState(target: FeatureIdentifier, state: any): void;
    removeFeatureState(target: FeatureIdentifier, key?: string): void;
    getFeatureState(target: FeatureIdentifier): import("@maplibre/maplibre-gl-style-spec").FeatureState;
    getTransition(): {
        duration: number;
        delay: number;
    } & import("@maplibre/maplibre-gl-style-spec").TransitionSpecification;
    serialize(): StyleSpecification | undefined;
    _updateLayer(layer: StyleLayer): void;
    _flattenAndSortRenderedFeatures(sourceResults: QueryRenderedFeaturesResults[]): MapGeoJSONFeature[];
    queryRenderedFeatures(queryGeometry: Point[], params: QueryRenderedFeaturesOptions, transform: IReadonlyTransform): MapGeoJSONFeature[];
    querySourceFeatures(sourceID: string, params?: QuerySourceFeatureOptions): import("..").GeoJSONFeature[];
    getLight(): LightSpecification;
    setLight(lightOptions: LightSpecification, options?: StyleSetterOptions): void;
    getProjection(): ProjectionSpecification;
    setProjection(projection: ProjectionSpecification): void;
    getSky(): SkySpecification;
    setSky(skyOptions?: SkySpecification, options?: StyleSetterOptions): void;
    _setProjectionInternal(name: ProjectionSpecification['type']): void;
    _validate(validate: Validator, key: string, value: any, props: any, options?: {
        validate?: boolean;
    }): boolean;
    _remove(mapRemoved?: boolean): void;
    _clearSource(id: string): void;
    _reloadSource(id: string): void;
    _updateSources(transform: ITransform): void;
    _generateCollisionBoxes(): void;
    _updatePlacement(transform: ITransform, showCollisionBoxes: boolean, fadeDuration: number, crossSourceCollisions: boolean, forceFullPlacement?: boolean): any;
    _releaseSymbolFadeTiles(): void;
    getImages(mapId: string | number, params: GetImagesParameters): Promise<GetImagesResponse>;
    getGlyphs(mapId: string | number, params: GetGlyphsParameters): Promise<GetGlyphsResponse>;
    getGlyphsUrl(): string;
    setGlyphs(glyphsUrl: string | null, options?: StyleSetterOptions): void;
    addSprite(id: string, url: string, options?: StyleSetterOptions, completion?: (err: Error) => void): void;
    removeSprite(id: string): void;
    getSprite(): {
        id: string;
        url: string;
    }[];
    setSprite(sprite: SpriteSpecification, options?: StyleSetterOptions, completion?: (err: Error) => void): void;
}
//# sourceMappingURL=style.d.ts.map