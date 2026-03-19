import type { CameraState, ScreenPoint, Feature } from './types.ts'
import type { RenderExtension } from './render-extension.ts'
import type { Viewport } from './projection.ts'

export interface CustomLayerRenderArgs {
  gl: WebGLRenderingContext
  camera: CameraState
  viewport: Viewport
  /** Prepend to your vertex shader so projectTile() is defined. */
  vertexShaderPrelude: string
  /**
   * Set all projection uniforms on your program.
   * Uses a full-world tile (z=0/x=0/y=0) so a_pos in [0, 4096] = mercator [0,1].
   */
  setProjectionUniforms(program: WebGLProgram): void
}

export interface SourceDefinition {
  type: string
  [key: string]: unknown
}

export interface LayerInstance {
  readonly id?: string
  readonly type: string
  onAdd?(renderer: RendererAPI): void
}

export interface CustomLayer {
  readonly id: string
  readonly type: 'custom'
  onAdd?(gl: WebGLRenderingContext, vertexShaderPrelude: string): void
  onRemove?(gl: WebGLRenderingContext): void
  render(args: CustomLayerRenderArgs): void
}

export interface RendererAPI {
  resize(width: number, height: number): void
  destroy(): void
  addSource(id: string, source: SourceDefinition): void
  removeSource(id: string): void
  addLayer(layer: LayerInstance | CustomLayer, beforeId?: string): void
  removeLayer(id: string): void
  setLayerPaint(id: string, props: Record<string, unknown>): void
  setLayerLayout(id: string, props: Record<string, unknown>): void
  setLayerVisibility(id: string, visible: boolean): void
  setCamera(state: CameraState): void
  addRenderExtension(extension: RenderExtension): void
  removeRenderExtension(id: string): void
  queryRenderedFeatures(point: ScreenPoint): Feature[]
}
