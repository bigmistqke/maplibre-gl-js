import Point from '@mapbox/point-geometry';
import { GridIndex, type OverlapMode } from './grid_index';
import { mat4, vec4, type mat4 as Mat4Type } from 'gl-matrix';

// Minimal stand-in for IReadonlyTransform — only the fields CollisionIndex uses
type SimpleTransform = {
  width: number;
  height: number;
  cameraToCenterDistance: number;
  pitch: number; // radians
  zoom: number;
};

// Minimal stand-in for SingleCollisionBox
type SimpleCollisionBox = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  padding: number;
};

// Minimal stand-ins for tile IDs
type OverscaledTileID = {
  overscaledZ: number;
  canonical: { z: number; x: number; y: number };
};

type UnwrappedTileID = {
  z: number;
  x: number;
  y: number;
  wrap: number;
};

// When a symbol crosses the edge that causes it to be included in
// collision detection, it will cause changes in the symbols around
// it. This constant specifies how many pixels to pad the edge of
// the viewport for collision detection so that the bulk of the changes
// occur offscreen. Making this constant greater increases label
// stability, but it's expensive.
export const viewportPadding = 100;

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

type ProjectedBox = {
  /**
   * The AABB in the format [minX, minY, maxX, maxY].
   */
  box: [number, number, number, number];
  allPointsOccluded: boolean;
};

// Inline helper: clamp a value between min and max
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Inline helper: get axis-aligned bounding box from points
function getAABB(points: Array<Point>): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  return [minX, minY, maxX, maxY];
}

/**
 * @internal
 * A collision index used to prevent symbols from overlapping. It keep tracks of
 * where previous symbols have been placed and is used to check if a new
 * symbol overlaps with any previously added symbols.
 *
 * There are two steps to insertion: first placeCollisionBox checks if
 * there's room for a symbol, then insertCollisionBox actually puts the
 * symbol in the index. The two step process allows paired symbols to be inserted
 * together even if they overlap.
 */
export class CollisionIndex {
  grid: GridIndex<FeatureKey>;
  ignoredGrid: GridIndex<FeatureKey>;
  transform: SimpleTransform;
  pitchFactor: number;
  screenRightBoundary: number;
  screenBottomBoundary: number;
  gridRightBoundary: number;
  gridBottomBoundary: number;

  // With perspectiveRatio the fontsize is calculated for tilted maps (near = bigger, far = smaller).
  // The cutoff defines a threshold to no longer render labels near the horizon.
  perspectiveRatioCutoff: number;

  constructor(
    transform: SimpleTransform,
    grid = new GridIndex<FeatureKey>(transform.width + 2 * viewportPadding, transform.height + 2 * viewportPadding, 25),
    ignoredGrid = new GridIndex<FeatureKey>(transform.width + 2 * viewportPadding, transform.height + 2 * viewportPadding, 25)
  ) {
    this.transform = transform;

    this.grid = grid;
    this.ignoredGrid = ignoredGrid;
    this.pitchFactor = Math.cos(transform.pitch) * transform.cameraToCenterDistance;

    this.screenRightBoundary = transform.width + viewportPadding;
    this.screenBottomBoundary = transform.height + viewportPadding;
    this.gridRightBoundary = transform.width + 2 * viewportPadding;
    this.gridBottomBoundary = transform.height + 2 * viewportPadding;

    this.perspectiveRatioCutoff = 0.6;
  }

  placeCollisionBox(
    collisionBox: SimpleCollisionBox,
    overlapMode: OverlapMode,
    textPixelRatio: number = 1,
    _tileIDOverscaledZ: number = 0,
    _unwrappedTileIDWrap: number = 0,
    _pitchWithMap: boolean = false,
    _rotateWithMap: boolean = false,
    _translation: [number, number] = [0, 0],
    collisionGroupPredicate?: (key: FeatureKey) => boolean,
    _getElevation?: (x: number, y: number) => number,
    _shift?: Point,
    _simpleProjectionMatrix?: mat4,
  ): PlacedBox {
    // For Plan 4, we use a simplified projection: the collision box dimensions are already
    // in screen space (or close to it), so we can use them directly with minimal adjustment.
    // In the full MapLibre version, this does complex perspective and rotation transforms.

    // Simplified: the box is already in screen space
    const tlX = collisionBox.x1;
    const tlY = collisionBox.y1;
    const brX = collisionBox.x2;
    const brY = collisionBox.y2;

    // For Plan 4, we skip most of the complex perspective/rotation logic
    const occluded = false; // simplified: assume not occluded

    let unplaceable = occluded;
    unplaceable ||= !this.isInsideGrid(tlX, tlY, brX, brY);

    if (unplaceable ||
        (overlapMode !== 'always' && this.grid.hitTest(tlX, tlY, brX, brY, overlapMode, collisionGroupPredicate))) {
      return {
        box: [tlX, tlY, brX, brY],
        placeable: false,
        offscreen: false,
        occluded
      };
    }

    return {
      box: [tlX, tlY, brX, brY],
      placeable: true,
      offscreen: this.isOffscreen(tlX, tlY, brX, brY),
      occluded
    };
  }

  insertCollisionBox(collisionBox: Array<number>, overlapMode: OverlapMode, featureKey: FeatureKey) {
    this.grid.insert(featureKey, collisionBox[0], collisionBox[1], collisionBox[2], collisionBox[3]);
  }

  isOffscreen(x1: number, y1: number, x2: number, y2: number) {
    return x2 < viewportPadding || x1 >= this.screenRightBoundary || y2 < viewportPadding || y1 > this.screenBottomBoundary;
  }

  isInsideGrid(x1: number, y1: number, x2: number, y2: number) {
    return x2 >= 0 && x1 < this.gridRightBoundary && y2 >= 0 && y1 < this.gridBottomBoundary;
  }

  /*
  * Returns a matrix for transforming collision shapes to viewport coordinate space.
  * Use this function to render e.g. collision circles on the screen.
  *   example transformation: clipPos = glCoordMatrix * viewportMatrix * circle_pos
  */
  getViewportMatrix() {
    const m = mat4.identity([] as unknown as Mat4Type);
    mat4.translate(m, m, [-viewportPadding, -viewportPadding, 0.0]);
    return m;
  }
}
