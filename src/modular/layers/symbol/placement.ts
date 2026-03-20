// src/modular/layers/symbol/placement.ts
import type { RenderContext } from '../../core/render-extension.ts'
import type { RenderExtension } from '../../core/render-extension.ts'
import type { RendererAPI, LayerInstance } from '../../core/renderer-api.ts'
import type { MapGL } from '../../core/map.ts'
import type { PlacementParticipant } from '../../core/placement-participant.ts'
import { CollisionIndex } from './vendor/collision_index.ts'

function isParticipant(layer: LayerInstance): layer is LayerInstance & PlacementParticipant {
  return typeof (layer as any).getSymbolBuckets === 'function' &&
         typeof (layer as any).setOpacity === 'function'
}

export class Placement {
  private _renderer: { getLayers(): LayerInstance[] } | null = null

  readonly renderExtension: RenderExtension = {
    id: 'placement',
    beforeTiles: (ctx: RenderContext) => {
      if (!this._renderer) return
      this._runPlacement(ctx)
    },
  }

  onAdd(_map: MapGL, renderer: RendererAPI): void {
    this._renderer = renderer as unknown as { getLayers(): LayerInstance[] }
  }

  private _runPlacement(ctx: RenderContext): void {
    const { gl, camera } = ctx
    const canvas = (gl as WebGLRenderingContext).canvas as HTMLCanvasElement
    const w = canvas.width
    const h = canvas.height

    const fov = 0.6435
    const cameraToCenterDistance = h / (2 * Math.tan(fov / 2))
    const transform = {
      width: w,
      height: h,
      cameraToCenterDistance,
      pitch: (camera.pitch ?? 0) * Math.PI / 180,
      zoom: camera.zoom,
    }

    const ci = new CollisionIndex(transform)

    const layers = this._renderer!.getLayers()
    for (const layer of layers) {
      if (!isParticipant(layer)) continue
      const buckets = layer.getSymbolBuckets()
      for (const bucket of buckets) {
        const n = bucket.anchors.length
        const opacity = new Float32Array(n)
        for (let i = 0; i < n; i++) {
          const [x1, y1, x2, y2] = bucket.boxes[i]
          const box = { x1, y1, x2, y2, padding: 2 }
          const result = ci.placeCollisionBox(box, 'never', 1, 0, 0, false, false, [0, 0])
          if (result.placeable) {
            ci.insertCollisionBox(
              [x1, y1, x2, y2],
              'never',
              { bucketInstanceId: 0, featureIndex: i, collisionGroupID: 0, overlapMode: 'never' as const },
            )
            opacity[i] = 1
          } else {
            opacity[i] = 0
          }
        }
        layer.setOpacity(bucket.tileKey, opacity)
      }
    }
  }
}
