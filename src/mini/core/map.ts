import type { CameraState, AnimationOptions } from './types.ts'
import type { RendererAPI, LayerInstance, CustomLayer } from './renderer-api.ts'
import { CameraController } from './camera.ts'

/** Structural type — a plugin is compatible if its onAdd accepts R. */
export type Plugin<R extends RendererAPI = RendererAPI> = {
  getElevation?: (lngLat: import('./types.ts').LngLat) => number
  readonly renderExtension?: import('./render-extension.ts').RenderExtension
  onAdd?: (map: MapGL<R>, renderer: R) => void
}

export interface MapGLOptions<R extends RendererAPI = RendererAPI> {
  renderer: R
  initialCamera?: Partial<CameraState>
}

export class MapGL<R extends RendererAPI = RendererAPI> {
  readonly renderer: R
  private _camera: CameraController
  private _listeners: globalThis.Map<string, Set<Function>> = new globalThis.Map()

  constructor(options: MapGLOptions<R>) {
    this.renderer = options.renderer
    this._camera = new CameraController(
      options.initialCamera ?? {},
      {
        onChange: (state) => {
          this.renderer.setCamera(state)
          this._emit('move', state)
        },
      },
    )
    this.renderer.setCamera(this._camera.getState())
  }

  addLayer(layer: LayerInstance | CustomLayer, beforeId?: string): void {
    this.renderer.addLayer(layer, beforeId)
  }

  removeLayer(id: string): void {
    this.renderer.removeLayer(id)
  }

  addSource(id: string, source: Record<string, unknown>): void {
    this.renderer.addSource(id, source as any)
  }

  removeSource(id: string): void {
    this.renderer.removeSource(id)
  }

  getCamera(): CameraState {
    return this._camera.getState()
  }

  setCamera(state: Partial<CameraState>, options?: AnimationOptions): void {
    this._camera.setCamera(state, options)
  }

  addPlugin(plugin: Plugin<R>): void {
    if (plugin.getElevation) {
      this._camera.setElevationProvider({ getElevation: plugin.getElevation.bind(plugin) })
    }
    if (plugin.renderExtension) {
      this.renderer.addRenderExtension(plugin.renderExtension)
    }
    if (plugin.onAdd) {
      plugin.onAdd(this, this.renderer)
    }
  }

  on(event: string, handler: Function): void {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set())
    this._listeners.get(event)!.add(handler)
  }

  off(event: string, handler: Function): void {
    this._listeners.get(event)?.delete(handler)
  }

  private _emit(event: string, data: unknown): void {
    this._listeners.get(event)?.forEach((fn) => fn(data))
  }
}
