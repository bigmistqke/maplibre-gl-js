import Point from '@mapbox/point-geometry';
import { GridIndex } from './grid_index';
import { mat4 } from 'gl-matrix';
import type { IReadonlyTransform } from '../geo/transform_interface';
import type { SingleCollisionBox } from '../data/bucket/symbol_bucket';
import type { GlyphOffsetArray, SymbolLineVertexArray } from '../data/array_types.g';
import type { OverlapMode } from '../style/style_layer/overlap_mode';
import { type OverscaledTileID, type UnwrappedTileID } from '../source/tile_id';
import { type PointProjection, type SymbolProjectionContext } from '../symbol/projection';
export declare const viewportPadding = 100;
export type PlacedCircles = {
    circles: Array<number>;
    offscreen: boolean;
    collisionDetected: boolean;
};
export type PlacedBox = {
    box: Array<number>;
    placeable: boolean;
    offscreen: boolean;
    occluded: boolean;
};
export type FeatureKey = {
    bucketInstanceId: number;
    featureIndex: number;
    collisionGroupID: number;
    overlapMode: OverlapMode;
};
export declare class CollisionIndex {
    grid: GridIndex<FeatureKey>;
    ignoredGrid: GridIndex<FeatureKey>;
    transform: IReadonlyTransform;
    pitchFactor: number;
    screenRightBoundary: number;
    screenBottomBoundary: number;
    gridRightBoundary: number;
    gridBottomBoundary: number;
    perspectiveRatioCutoff: number;
    constructor(transform: IReadonlyTransform, grid?: GridIndex<FeatureKey>, ignoredGrid?: GridIndex<FeatureKey>);
    placeCollisionBox(collisionBox: SingleCollisionBox, overlapMode: OverlapMode, textPixelRatio: number, tileID: OverscaledTileID, unwrappedTileID: UnwrappedTileID, pitchWithMap: boolean, rotateWithMap: boolean, translation: [number, number], collisionGroupPredicate?: (key: FeatureKey) => boolean, getElevation?: (x: number, y: number) => number, shift?: Point, simpleProjectionMatrix?: mat4): PlacedBox;
    placeCollisionCircles(overlapMode: OverlapMode, symbol: any, lineVertexArray: SymbolLineVertexArray, glyphOffsetArray: GlyphOffsetArray, fontSize: number, unwrappedTileID: UnwrappedTileID, pitchedLabelPlaneMatrix: mat4, showCollisionCircles: boolean, pitchWithMap: boolean, collisionGroupPredicate: (key: FeatureKey) => boolean, circlePixelDiameter: number, textPixelPadding: number, translation: [number, number], getElevation: (x: number, y: number) => number): PlacedCircles;
    projectPathToScreenSpace(projectedPath: Array<Point>, projectionContext: SymbolProjectionContext): Array<PointProjection>;
    queryRenderedSymbols(viewportQueryGeometry: Array<Point>): {};
    insertCollisionBox(collisionBox: Array<number>, overlapMode: OverlapMode, ignorePlacement: boolean, bucketInstanceId: number, featureIndex: number, collisionGroupID: number): void;
    insertCollisionCircles(collisionCircles: Array<number>, overlapMode: OverlapMode, ignorePlacement: boolean, bucketInstanceId: number, featureIndex: number, collisionGroupID: number): void;
    projectAndGetPerspectiveRatio(x: number, y: number, unwrappedTileID: UnwrappedTileID, getElevation?: (x: number, y: number) => number, simpleProjectionMatrix?: mat4): {
        x: number;
        y: number;
        perspectiveRatio: number;
        isOccluded: boolean;
        signedDistanceFromCamera: any;
    };
    getPerspectiveRatio(x: number, y: number, unwrappedTileID: UnwrappedTileID, getElevation?: (x: number, y: number) => number): number;
    isOffscreen(x1: number, y1: number, x2: number, y2: number): boolean;
    isInsideGrid(x1: number, y1: number, x2: number, y2: number): boolean;
    getViewportMatrix(): any;
    private _projectCollisionBox;
}
//# sourceMappingURL=collision_index.d.ts.map