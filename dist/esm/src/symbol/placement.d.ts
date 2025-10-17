import { CollisionIndex } from './collision_index';
import Point from '@mapbox/point-geometry';
import { type OverlapMode } from '../style/style_layer/overlap_mode';
import type { SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated } from '../style/style_layer/symbol_style_layer_properties.g';
import type { FeatureKey, PlacedBox, PlacedCircles } from './collision_index';
import type { mat4 } from 'gl-matrix';
import type { Tile } from '../source/tile';
import type { SymbolBucket, CollisionArrays, SingleCollisionBox } from '../data/bucket/symbol_bucket';
import type { IReadonlyTransform, ITransform } from '../geo/transform_interface';
import type { StyleLayer } from '../style/style_layer';
import type { PossiblyEvaluated } from '../style/properties';
import type { CollisionBoxArray, SymbolInstance, TextAnchorOffset } from '../data/array_types.g';
import type { FeatureIndex } from '../data/feature_index';
import type { OverscaledTileID, UnwrappedTileID } from '../source/tile_id';
import type { Terrain } from '../render/terrain';
import type { TextAnchor } from '../style/style_layer/variable_text_anchor';
declare class OpacityState {
    opacity: number;
    placed: boolean;
    constructor(prevState: OpacityState, increment: number, placed: boolean, skipFade?: boolean | null);
    isHidden(): boolean;
}
declare class JointOpacityState {
    text: OpacityState;
    icon: OpacityState;
    constructor(prevState: JointOpacityState, increment: number, placedText: boolean, placedIcon: boolean, skipFade?: boolean | null);
    isHidden(): boolean;
}
declare class JointPlacement {
    text: boolean;
    icon: boolean;
    skipFade: boolean;
    constructor(text: boolean, icon: boolean, skipFade: boolean);
}
export declare class RetainedQueryData {
    bucketInstanceId: number;
    featureIndex: FeatureIndex;
    sourceLayerIndex: number;
    bucketIndex: number;
    tileID: OverscaledTileID;
    featureSortOrder: Array<number>;
    constructor(bucketInstanceId: number, featureIndex: FeatureIndex, sourceLayerIndex: number, bucketIndex: number, tileID: OverscaledTileID);
}
type CollisionGroup = {
    ID: number;
    predicate?: (key: FeatureKey) => boolean;
};
declare class CollisionGroups {
    collisionGroups: {
        [groupName: string]: CollisionGroup;
    };
    maxGroupID: number;
    crossSourceCollisions: boolean;
    constructor(crossSourceCollisions: boolean);
    get(sourceID: string): CollisionGroup;
}
export type VariableOffset = {
    textOffset: [number, number];
    width: number;
    height: number;
    anchor: TextAnchor;
    textBoxScale: number;
    prevAnchor?: TextAnchor;
};
type TileLayerParameters = {
    bucket: SymbolBucket;
    layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>;
    translationText: [number, number];
    translationIcon: [number, number];
    unwrappedTileID: UnwrappedTileID;
    pitchedLabelPlaneMatrix: mat4;
    scale: number;
    textPixelRatio: number;
    holdingForFade: boolean;
    collisionBoxArray: CollisionBoxArray;
    partiallyEvaluatedTextSize: {
        uSize: number;
        uSizeT: number;
    };
    collisionGroup: CollisionGroup;
};
export type BucketPart = {
    sortKey?: number | void;
    symbolInstanceStart: number;
    symbolInstanceEnd: number;
    parameters: TileLayerParameters;
};
export type CrossTileID = string | number;
export declare class Placement {
    transform: IReadonlyTransform;
    terrain: Terrain;
    collisionIndex: CollisionIndex;
    placements: {
        [_ in CrossTileID]: JointPlacement;
    };
    opacities: {
        [_ in CrossTileID]: JointOpacityState;
    };
    variableOffsets: {
        [_ in CrossTileID]: VariableOffset;
    };
    placedOrientations: {
        [_ in CrossTileID]: number;
    };
    commitTime: number;
    prevZoomAdjustment: number;
    lastPlacementChangeTime: number;
    stale: boolean;
    fadeDuration: number;
    retainedQueryData: {
        [_: number]: RetainedQueryData;
    };
    collisionGroups: CollisionGroups;
    prevPlacement: Placement;
    zoomAtLastRecencyCheck: number;
    collisionCircleArrays: {
        [k in any]: Array<number>;
    };
    collisionBoxArrays: Map<number, Map<number, {
        text: number[];
        icon: number[];
    }>>;
    constructor(transform: ITransform, terrain: Terrain, fadeDuration: number, crossSourceCollisions: boolean, prevPlacement?: Placement);
    private _getTerrainElevationFunc;
    getBucketParts(results: Array<BucketPart>, styleLayer: StyleLayer, tile: Tile, sortAcrossTiles: boolean): void;
    attemptAnchorPlacement(textAnchorOffset: TextAnchorOffset, textBox: SingleCollisionBox, width: number, height: number, textBoxScale: number, rotateWithMap: boolean, pitchWithMap: boolean, textPixelRatio: number, tileID: OverscaledTileID, unwrappedTileID: any, collisionGroup: CollisionGroup, textOverlapMode: OverlapMode, symbolInstance: SymbolInstance, bucket: SymbolBucket, orientation: number, translationText: [number, number], translationIcon: [number, number], iconBox?: SingleCollisionBox | null, getElevation?: (x: number, y: number) => number, simpleProjectionMatrix?: mat4): {
        shift: Point;
        placedGlyphBoxes: PlacedBox;
    };
    placeLayerBucketPart(bucketPart: BucketPart, seenCrossTileIDs: {
        [k in string | number]: boolean;
    }, showCollisionBoxes: boolean): void;
    storeCollisionData(bucketInstanceId: number, symbolIndex: number, collisionArrays: CollisionArrays, placedGlyphBoxes: PlacedBox, placedIconBoxes: PlacedBox, placedGlyphCircles: PlacedCircles): void;
    markUsedJustification(bucket: SymbolBucket, placedAnchor: TextAnchor, symbolInstance: SymbolInstance, orientation: number): void;
    markUsedOrientation(bucket: SymbolBucket, orientation: number, symbolInstance: SymbolInstance): void;
    commit(now: number): void;
    updateLayerOpacities(styleLayer: StyleLayer, tiles: Array<Tile>): void;
    updateBucketOpacities(bucket: SymbolBucket, tileID: OverscaledTileID, seenCrossTileIDs: {
        [k in string | number]: boolean;
    }, collisionBoxArray?: CollisionBoxArray | null): void;
    symbolFadeChange(now: number): number;
    zoomAdjustment(zoom: number): number;
    hasTransitions(now: number): boolean;
    stillRecent(now: number, zoom: number): boolean;
    setStale(): void;
}
export {};
//# sourceMappingURL=placement.d.ts.map