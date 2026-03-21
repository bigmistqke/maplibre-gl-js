import { CollisionIndex } from '../vendor/collision_index.ts'
import type { CollisionData } from '../base/types.ts'
import type { RenderContext } from '../../../core/render-extension.ts'

/** Minimal interface for what LayoutEngine needs from a layer */
export interface PlaceableLayer {
  getCollisionData(ctx: RenderContext): CollisionData[]
  setLabelOpacity(tileKey: string, opacity: Float32Array): void
}

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

    const fov = 0.6435
    const cameraToCenterDistance = h / (2 * Math.tan(fov / 2))
    const transform = {
      width: w,
      height: h,
      cameraToCenterDistance,
      pitch: ((ctx.camera as any).pitch ?? 0) * Math.PI / 180,
      zoom: (ctx.camera as any).zoom ?? 0,
    }

    const ci = new CollisionIndex(transform)

    for (const layer of layers) {
      const buckets = layer.getCollisionData(ctx)
      for (const bucket of buckets) {
        const n = bucket.anchors.length
        const opacity = new Float32Array(n)
        for (let i = 0; i < n; i++) {
          const [x1, y1, x2, y2] = bucket.boxes[i]
          const box = { x1, y1, x2, y2, padding: 0 }
          const result = ci.placeCollisionBox(box, 'never', 1, 0, 0, false, false, [0, 0])
          if (result.placeable) {
            ci.insertCollisionBox(
              [x1, y1, x2, y2],
              'never',
              { bucketInstanceId: 0, featureIndex: i, collisionGroupID: 0, overlapMode: 'never' as const },
            )
            opacity[i] = 1
          }
        }
        layer.setLabelOpacity(bucket.tileKey, opacity)
      }
    }
  }
}
