import { CollisionIndex } from '../vendor/collision_index.ts'
import type { SingleCollisionBox } from '../vendor/collision_index.ts'
import type { CollisionData } from '../base/types.ts'
import type { LabelData } from './cross-tile-index.ts'
import type { RenderContext } from '../../../core/render-extension.ts'
import { TransformAdapter } from '../vendor/transform_adapter.ts'
import { mat4 } from 'gl-matrix'

/** Minimal interface for what LayoutEngine needs from a layer */
export interface PlaceableLayer {
  getCollisionData(ctx: RenderContext, visibleKeys: ReadonlySet<string>): CollisionData[]
  setLabelOpacity(tileKey: string, opacity: Float32Array): void
  /** Returns tile-key → label data for cross-tile matching. Optional — defaults to empty. */
  getLabelData?(): Map<string, LabelData[]>
}

/**
 * Build a simpleProjectionMatrix that maps screen-pixel coordinates to clip
 * space such that projectAndGetPerspectiveRatio returns the same screen-pixel
 * position (plus viewportPadding) with perspectiveRatio = 1.
 */
function buildScreenSpaceProjectionMatrix(
  width: number,
  height: number,
  cameraToCenterDistance: number,
): mat4 {
  const C = cameraToCenterDistance
  // Column-major 4×4 matrix. Only the entries used by xyTransformMat4 matter:
  //   out[0] = m[0]*x + m[4]*y + m[12]
  //   out[1] = m[1]*x + m[5]*y + m[13]
  //   out[3] = m[3]*x + m[7]*y + m[15]
  // We want: screenX = x + viewportPadding  =>  ((out[0]/out[3]+1)/2)*width = x
  //          screenY = y + viewportPadding  =>  ((-out[1]/out[3]+1)/2)*height = y
  //          perspectiveRatio = 1  =>  out[3] = C
  const m = mat4.create()
  m[0]  =  2 * C / width   // col0.x
  m[1]  =  0               // col0.y
  m[2]  =  0
  m[3]  =  0               // col0.w
  m[4]  =  0               // col1.x
  m[5]  = -2 * C / height  // col1.y
  m[6]  =  0
  m[7]  =  0               // col1.w
  m[8]  =  0
  m[9]  =  0
  m[10] =  0
  m[11] =  0
  m[12] = -C               // col3.x
  m[13] =  C               // col3.y
  m[14] =  0
  m[15] =  C               // col3.w
  return m
}

/** Dummy tileID for screen-space collision (only overscaledZ is read). */
const SCREEN_TILE_ID = { overscaledZ: 0 }

/** Dummy unwrappedTileID — not used when simpleProjectionMatrix is provided. */
const SCREEN_UNWRAPPED_TILE_ID = { canonical: { z: 0, x: 0, y: 0 }, wrap: 0 }

export class LayoutEngine {
  /**
   * Run collision placement for all symbol layers.
   * @param ctx Current render context
   * @param layers Layers in priority order (highest priority FIRST)
   */
  runPlacement(ctx: RenderContext, layers: PlaceableLayer[]): void {
    const { gl } = ctx
    const canvas = (gl as WebGLRenderingContext).canvas as HTMLCanvasElement
    const w = canvas.width
    const h = canvas.height

    const viewport = { width: w, height: h }
    const transform = new TransformAdapter(ctx.camera, viewport)
    const ci = new CollisionIndex(transform as any)

    const screenMatrix = buildScreenSpaceProjectionMatrix(
      w, h, transform.cameraToCenterDistance,
    )

    const visibleKeys = new Set(ctx.visibleTiles.map(t => t.key))
    const seenCrossTileIDs = new Set<number>()

    for (const layer of layers) {
      const buckets = layer.getCollisionData(ctx, visibleKeys)
      for (const bucket of buckets) {
        const n = bucket.anchors.length
        const opacity = new Float32Array(n)
        for (let i = 0; i < n; i++) {
          const crossTileID = bucket.crossTileIDs[i]

          // Skip if this crossTileID was already placed by another tile
          if (crossTileID > 0 && seenCrossTileIDs.has(crossTileID)) {
            // opacity stays 0 — duplicate hidden
            continue
          }

          const anchor = bucket.anchors[i]
          const [x1, y1, x2, y2] = bucket.boxes[i]

          // Build a SingleCollisionBox with offsets relative to anchor
          const collisionBox: SingleCollisionBox = {
            anchorPointX: anchor.x,
            anchorPointY: anchor.y,
            x1: x1 - anchor.x,
            y1: y1 - anchor.y,
            x2: x2 - anchor.x,
            y2: y2 - anchor.y,
          }

          const result = ci.placeCollisionBox(
            collisionBox,
            'never',        // overlapMode
            1,              // textPixelRatio
            SCREEN_TILE_ID, // tileID
            SCREEN_UNWRAPPED_TILE_ID, // unwrappedTileID
            false,          // pitchWithMap
            false,          // rotateWithMap
            [0, 0],         // translation
            undefined,      // collisionGroupPredicate
            undefined,      // getElevation
            undefined,      // shift
            screenMatrix,   // simpleProjectionMatrix — screen-pixel identity
          )

          if (result.placeable) {
            ci.insertCollisionBox(
              result.box,     // use the projected box from placeCollisionBox
              'never',        // overlapMode
              false,          // ignorePlacement
              0,              // bucketInstanceId
              i,              // featureIndex
              0,              // collisionGroupID
            )
            opacity[i] = 1
            if (crossTileID > 0) seenCrossTileIDs.add(crossTileID)
          }
        }
        layer.setLabelOpacity(bucket.tileKey, opacity)
      }
    }
  }
}
