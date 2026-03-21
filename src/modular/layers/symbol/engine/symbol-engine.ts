import type { RendererAPI } from '../../../core/renderer-api.ts'
import type { RenderExtension, RenderContext } from '../../../core/render-extension.ts'
import { LayoutEngine, type PlaceableLayer } from './layout-engine.ts'
import { ResourceManager } from './resource-manager.ts'

export class SymbolEngine {
  readonly layout: LayoutEngine
  readonly resources: ResourceManager

  private _renderer: RendererAPI
  private _layers = new Set<PlaceableLayer & { id?: string }>()
  private _extension: RenderExtension | null = null

  constructor(renderer: RendererAPI) {
    this._renderer = renderer
    this.layout = new LayoutEngine()
    this.resources = new ResourceManager()
  }

  register(layer: PlaceableLayer & { id?: string }): void {
    this._layers.add(layer)
    if (!this._extension) {
      this._extension = {
        id: 'symbol-engine',
        beforeTiles: (ctx: RenderContext) => this._beforeTiles(ctx),
      }
      this._renderer.addRenderExtension(this._extension)
    }
  }

  unregister(layer: PlaceableLayer & { id?: string }): void {
    this._layers.delete(layer)
    if (this._layers.size === 0 && this._extension) {
      this._renderer.removeRenderExtension(this._extension.id)
      this._extension = null
      this.resources.destroy()
    }
  }

  private _beforeTiles(ctx: RenderContext): void {
    if (this._layers.size === 0) return
    const order = this._renderer.getLayerOrder?.() ?? []
    const ordered = this._getLayersInPriorityOrder(order)
    this.layout.runPlacement(ctx, ordered)
  }

  /**
   * Returns registered layers sorted by collision priority:
   * last in renderer order = highest priority = first in returned array.
   */
  private _getLayersInPriorityOrder(renderOrder: string[]): PlaceableLayer[] {
    const idToIndex = new Map<string, number>()
    for (let i = 0; i < renderOrder.length; i++) {
      idToIndex.set(renderOrder[i], i)
    }
    const layers = [...this._layers]
    layers.sort((a, b) => {
      const ai = a.id ? (idToIndex.get(a.id) ?? -1) : -1
      const bi = b.id ? (idToIndex.get(b.id) ?? -1) : -1
      return bi - ai
    })
    return layers
  }
}
