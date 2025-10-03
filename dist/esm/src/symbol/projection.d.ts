import Point from '@mapbox/point-geometry';
import { mat4, vec2, vec4 } from 'gl-matrix';
import type { Painter } from '../render/painter';
import type { IReadonlyTransform } from '../geo/transform_interface';
import type { SymbolBucket } from '../data/bucket/symbol_bucket';
import type { GlyphOffsetArray, SymbolLineVertexArray, SymbolDynamicLayoutArray } from '../data/array_types.g';
import { type UnwrappedTileID } from '../source/tile_id';
export type PointProjection = {
    point: Point;
    signedDistanceFromCamera: number;
    isOccluded: boolean;
};
export declare function getPitchedLabelPlaneMatrix(rotateWithMap: boolean, transform: IReadonlyTransform, pixelsToTileUnits: number): Float32Array<ArrayBufferLike>;
export declare function getGlCoordMatrix(pitchWithMap: boolean, rotateWithMap: boolean, transform: IReadonlyTransform, pixelsToTileUnits: number): import("gl-matrix").IndexedCollection;
export declare function getTileSkewVectors(transform: IReadonlyTransform): {
    vecEast: vec2;
    vecSouth: vec2;
};
export declare function projectWithMatrix(x: number, y: number, matrix: mat4, getElevation?: (x: number, y: number) => number): PointProjection;
export declare function getPerspectiveRatio(cameraToCenterDistance: number, signedDistanceFromCamera: number): number;
export declare function updateLineLabels(bucket: SymbolBucket, painter: Painter, isText: boolean, pitchedLabelPlaneMatrix: mat4, pitchedLabelPlaneMatrixInverse: mat4, pitchWithMap: boolean, keepUpright: boolean, rotateToLine: boolean, unwrappedTileID: UnwrappedTileID, viewportWidth: number, viewportHeight: number, translation: [number, number], getElevation: (x: number, y: number) => number): void;
type FirstAndLastGlyphPlacement = {
    first: PlacedGlyph;
    last: PlacedGlyph;
} | null;
export declare function placeFirstAndLastGlyph(fontScale: number, glyphOffsetArray: GlyphOffsetArray, lineOffsetX: number, lineOffsetY: number, flip: boolean, symbol: any, rotateToLine: boolean, projectionContext: SymbolProjectionContext): FirstAndLastGlyphPlacement;
type IndexToPointCache = {
    [lineIndex: number]: Point;
};
type ProjectionCache = {
    projections: IndexToPointCache;
    offsets: IndexToPointCache;
    cachedAnchorPoint: Point | undefined;
    anyProjectionOccluded: boolean;
};
export type SymbolProjectionContext = {
    projectionCache: ProjectionCache;
    lineVertexArray: SymbolLineVertexArray;
    pitchedLabelPlaneMatrix: mat4;
    getElevation: (x: number, y: number) => number;
    tileAnchorPoint: Point;
    pitchWithMap: boolean;
    transform: IReadonlyTransform;
    unwrappedTileID: UnwrappedTileID;
    width: number;
    height: number;
    translation: [number, number];
};
export type ProjectionSyntheticVertexArgs = {
    distanceFromAnchor: number;
    previousVertex: Point;
    direction: number;
    absOffsetX: number;
};
export declare function projectLineVertexToLabelPlane(index: number, projectionContext: SymbolProjectionContext, syntheticVertexArgs: ProjectionSyntheticVertexArgs): Point;
export declare function projectTileCoordinatesToLabelPlane(x: number, y: number, projectionContext: SymbolProjectionContext): PointProjection;
export declare function projectTileCoordinatesToClipSpace(x: number, y: number, projectionContext: SymbolProjectionContext): PointProjection;
export declare function transformToOffsetNormal(segmentVector: Point, offset: number, direction: number): Point;
export declare function findOffsetIntersectionPoint(index: number, prevToCurrentOffsetNormal: Point, currentVertex: Point, lineStartIndex: number, lineEndIndex: number, offsetPreviousVertex: Point, lineOffsetY: number, projectionContext: SymbolProjectionContext, syntheticVertexArgs: ProjectionSyntheticVertexArgs): Point;
type PlacedGlyph = {
    point: Point;
    angle: number;
    path: Array<Point>;
};
export declare function placeGlyphAlongLine(offsetX: number, lineOffsetX: number, lineOffsetY: number, flip: boolean, anchorSegment: number, lineStartIndex: number, lineEndIndex: number, projectionContext: SymbolProjectionContext, rotateToLine: boolean): PlacedGlyph | null;
export declare function hideGlyphs(num: number, dynamicLayoutVertexArray: SymbolDynamicLayoutArray): void;
export declare function xyTransformMat4(out: vec4, a: vec4, m: mat4): import("gl-matrix").IndexedCollection | import("gl-matrix").Vec4.Tuple;
export declare function projectPathSpecialProjection(projectedPath: Array<Point>, projectionContext: SymbolProjectionContext): Array<PointProjection>;
export declare function pathSlicedToLongestUnoccluded(path: Array<PointProjection>): Array<PointProjection>;
export {};
//# sourceMappingURL=projection.d.ts.map