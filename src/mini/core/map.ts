import type { CameraState, AnimationOptions } from './types.ts'
import type { RendererAPI, LayerInstance, CustomLayer } from './renderer-api.ts'
import type { Plugin } from './plugin.ts'
import { CameraController } from './camera.ts'

export interface MapGLOptions {
  renderer: RendererAPI
  initialCamera?: Partial<CameraState>
}

export class MapGL {
  readonly renderer: RendererAPI
  private _camera: CameraController
  private _listeners: globalThis.Map<string, Set<Function>> = new globalThis.Map()

  constructor(options: MapGLOptions) {
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
    // Push initial state — CameraController doesn't call onChange on construction
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

  addPlugin(plugin: Plugin): void {
    if (plugin.getElevation) {
      this._camera.setElevationProvider({ getElevation: plugin.getElevation.bind(plugin) })
    }
    if (plugin.renderExtension) {
      this.renderer.addRenderExtension(plugin.renderExtension)
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
