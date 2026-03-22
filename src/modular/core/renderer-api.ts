import type { CameraState, ScreenPoint, Feature, ResolvedPaintProperties, ProgramDefinition } from '@modular/core/types.ts'
import type { RenderExtension } from '@modular/core/render-extension.ts'
import type { DrawContext } from '@modular/core/render-extension.ts'
import type { Viewport } from '@modular/core/projection.ts'
import type { Surface } from '@modular/core/surface.ts'

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
  readonly source?: string
  /** WebGL programs this layer needs compiled. Set from the static `programs` property. */
  readonly programs?: ProgramDefinition[]
  onAdd?(renderer: RendererAPI): void
  onRemove?(): void
  draw?(ctx: DrawContext): void
  evictTile?(key: string): void
  drawBackground?(ctx: { gl: WebGLRenderingContext; paint: ResolvedPaintProperties }): void
}

export interface CustomLayer {
  readonly id: string
  readonly type: 'custom'
  onAdd?(gl: WebGLRenderingContext, vertexShaderPrelude: string): void
  onRemove?(gl: WebGLRenderingContext): void
  render(args: CustomLayerRenderArgs): void
}

export interface RendererAPI {
  /** WebGL context. Present on the concrete Renderer implementation. */
  readonly gl?: WebGLRenderingContext
  /** Current camera state. Present on the concrete Renderer implementation. */
  readonly camera?: CameraState | null
  /** Request a re-render on the next frame. Present on the concrete Renderer. */
  markDirty?(): void
  /** Create or retrieve a named geometry buffer. Present on the concrete Renderer. */
  createGeometryBuffer?(key: string, data: ArrayBufferView, target: number): WebGLBuffer
  /** Destroy all geometry buffers whose key starts with the given prefix. Present on the concrete Renderer. */
  destroyGeometryBuffers?(keyPrefix: string): void
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
  getLayerOrder?(): string[]
  addRenderExtension(extension: RenderExtension): void
  removeRenderExtension(id: string): void
  queryRenderedFeatures(point: ScreenPoint): Feature[]
  setSurface(surface: Surface): void
}

/** Branded subtype — prevents accidental structural assignment from plain RendererAPI. */
export interface WebGL2RendererAPI extends RendererAPI {
  readonly __webgl2: true
}
