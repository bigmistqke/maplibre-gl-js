import type { CameraState, ScreenPoint, Feature } from './types.ts'
import type { RenderExtension } from './render-extension.ts'

export interface SourceDefinition {
  type: string
  [key: string]: unknown
}

export interface LayerInstance {
  readonly id?: string
  readonly type: string
  onAdd?(renderer: RendererAPI): void
}

export interface RendererAPI {
  resize(width: number, height: number): void
  destroy(): void
  addSource(id: string, source: SourceDefinition): void
  removeSource(id: string): void
  addLayer(layer: LayerInstance, beforeId?: string): void
  removeLayer(id: string): void
  setLayerPaint(id: string, props: Record<string, unknown>): void
  setLayerLayout(id: string, props: Record<string, unknown>): void
  setLayerVisibility(id: string, visible: boolean): void
  setCamera(state: CameraState): void
  addRenderExtension(extension: RenderExtension): void
  removeRenderExtension(id: string): void
  queryRenderedFeatures(point: ScreenPoint): Feature[]
}
