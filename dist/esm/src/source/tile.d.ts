import '../data/feature_index';
import { GeoJSONFeature } from '../util/vectortile_to_geojson';
import { CollisionBoxArray } from '../data/array_types.g';
import { Texture } from '../render/texture';
import { type SourceFeatureState } from '../source/source_state';
import type { Bucket } from '../data/bucket';
import type { StyleLayer } from '../style/style_layer';
import type { WorkerTileResult } from './worker_source';
import type { Actor } from '../util/actor';
import type { DEMData } from '../data/dem_data';
import type { AlphaImage } from '../util/image';
import type { ImageAtlas } from '../render/image_atlas';
import type { ImageManager } from '../render/image_manager';
import type { Context } from '../gl/context';
import type { OverscaledTileID } from './tile_id';
import type { Framebuffer } from '../gl/framebuffer';
import type { IReadonlyTransform } from '../geo/transform_interface';
import type { LayerFeatureStates } from './source_state';
import type Point from '@mapbox/point-geometry';
import type { mat4 } from 'gl-matrix';
import type { VectorTileLayer } from '@mapbox/vector-tile';
import type { ExpiryData } from '../util/ajax';
import type { QueryRenderedFeaturesOptionsStrict, QuerySourceFeatureOptionsStrict } from './query_features';
import type { FeatureIndex, QueryResults } from '../data/feature_index';
export type TileState = 'loading' | 'loaded' | 'reloading' | 'unloaded' | 'errored' | 'expired';
export declare class Tile {
    tileID: OverscaledTileID;
    uid: number;
    uses: number;
    tileSize: number;
    buckets: {
        [_: string]: Bucket;
    };
    latestFeatureIndex: FeatureIndex;
    latestRawTileData: ArrayBuffer;
    imageAtlas: ImageAtlas;
    imageAtlasTexture: Texture;
    glyphAtlasImage: AlphaImage;
    glyphAtlasTexture: Texture;
    expirationTime: any;
    expiredRequestCount: number;
    state: TileState;
    timeAdded: number;
    fadeEndTime: number;
    collisionBoxArray: CollisionBoxArray;
    redoWhenDone: boolean;
    showCollisionBoxes: boolean;
    placementSource: any;
    actor: Actor;
    vtLayers: {
        [_: string]: VectorTileLayer;
    };
    neighboringTiles: any;
    dem: DEMData;
    demMatrix: mat4;
    aborted: boolean;
    needsHillshadePrepare: boolean;
    needsTerrainPrepare: boolean;
    abortController: AbortController;
    texture: any;
    fbo: Framebuffer;
    demTexture: Texture;
    refreshedUponExpiration: boolean;
    reloadPromise: {
        resolve: () => void;
        reject: () => void;
    };
    resourceTiming: Array<PerformanceResourceTiming>;
    queryPadding: number;
    symbolFadeHoldUntil: number;
    hasSymbolBuckets: boolean;
    hasRTLText: boolean;
    dependencies: any;
    rtt: Array<{
        id: number;
        stamp: number;
    }>;
    rttCoords: {
        [_: string]: string;
    };
    constructor(tileID: OverscaledTileID, size: number);
    registerFadeDuration(duration: number): void;
    wasRequested(): boolean;
    clearTextures(painter: any): void;
    loadVectorData(data: WorkerTileResult, painter: any, justReloaded?: boolean | null): void;
    unloadVectorData(): void;
    getBucket(layer: StyleLayer): Bucket;
    upload(context: Context): void;
    prepare(imageManager: ImageManager): void;
    queryRenderedFeatures(layers: {
        [_: string]: StyleLayer;
    }, serializedLayers: {
        [_: string]: any;
    }, sourceFeatureState: SourceFeatureState, queryGeometry: Array<Point>, cameraQueryGeometry: Array<Point>, scale: number, params: Pick<QueryRenderedFeaturesOptionsStrict, 'filter' | 'layers' | 'availableImages'> | undefined, transform: IReadonlyTransform, maxPitchScaleFactor: number, pixelPosMatrix: mat4, getElevation: undefined | ((x: number, y: number) => number)): QueryResults;
    querySourceFeatures(result: Array<GeoJSONFeature>, params?: QuerySourceFeatureOptionsStrict): void;
    hasData(): boolean;
    patternsLoaded(): boolean;
    setExpiryData(data: ExpiryData): void;
    getExpiryTimeout(): number;
    setFeatureState(states: LayerFeatureStates, painter: any): void;
    holdingForFade(): boolean;
    symbolFadeFinished(): boolean;
    clearFadeHold(): void;
    setHoldDuration(duration: number): void;
    setDependencies(namespace: string, dependencies: Array<string>): void;
    hasDependency(namespaces: Array<string>, keys: Array<string>): boolean;
}
//# sourceMappingURL=tile.d.ts.map