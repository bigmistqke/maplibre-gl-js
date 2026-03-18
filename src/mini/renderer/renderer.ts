import type { CameraState, ScreenPoint, Feature, ResolvedPaintProperties } from '../core/types.ts'
import type { RendererAPI, LayerInstance, SourceDefinition } from '../core/renderer-api.ts'
import type { RenderExtension, RenderContext } from '../core/render-extension.ts'
import { WebGLContext } from './webgl-context.ts'
import { FrameLoop } from './frame-loop.ts'
import { StyleEvaluator } from './style-evaluator.ts'
import { RenderExtensions } from './render-extensions.ts'

interface LayerEntry {
  id: string
  layer: LayerInstance
}

interface FullFrameLayer {
  drawBackground(ctx: { gl: WebGLRenderingContext; paint: ResolvedPaintProperties }): void
}

function isFullFrameLayer(layer: LayerInstance): layer is LayerInstance & FullFrameLayer {
  return typeof (layer as any).drawBackground === 'function'
}

export class Renderer implements RendererAPI {
  private _webgl: WebGLContext
  private _frameLoop: FrameLoop
  private _styleEvaluator: StyleEvaluator
  private _renderExtensions: RenderExtensions
  private _layers: LayerEntry[] = []
  private _camera: CameraState | null = null
  private _frameIndex = 0
  private _width: number
  private _height: number

  constructor(canvas: HTMLCanvasElement) {
    this._width = canvas.width
    this._height = canvas.height
    this._webgl = new WebGLContext(canvas)
    this._frameLoop = new FrameLoop(() => this.renderFrame())
    this._styleEvaluator = new StyleEvaluator()
    this._renderExtensions = new RenderExtensions()
    this._frameLoop.start()
  }

  resize(width: number, height: number): void {
    this._width = width
    this._height = height
    this._frameLoop.markDirty()
  }

  destroy(): void {
    this._frameLoop.stop()
  }

  addSource(_id: string, _source: SourceDefinition): void {
    this._frameLoop.markDirty()
  }

  removeSource(_id: string): void {
    this._frameLoop.markDirty()
  }

  addLayer(layer: LayerInstance, beforeId?: string): void {
    const id = (layer as any).id ?? `__layer_${this._layers.length}`
    if (beforeId) {
      const idx = this._layers.findIndex(e => e.id === beforeId)
      this._layers.splice(idx !== -1 ? idx : this._layers.length, 0, { id, layer })
    } else {
      this._layers.push({ id, layer })
    }
    if (typeof (layer as any).onAdd === 'function') {
      ;(layer as any).onAdd(this)
    }
    const programs = (layer.constructor as any).programs
    if (programs?.length > 0) {
      this._webgl.compilePrograms(programs)
    }
    this._frameLoop.markDirty()
  }

  removeLayer(id: string): void {
    this._layers = this._layers.filter(e => e.id !== id)
    this._frameLoop.markDirty()
  }

  setLayerPaint(_id: string, _props: Record<string, unknown>): void {
    this._frameLoop.markDirty()
  }

  setLayerLayout(_id: string, _props: Record<string, unknown>): void {
    this._frameLoop.markDirty()
  }

  setLayerVisibility(_id: string, _visible: boolean): void {
    this._frameLoop.markDirty()
  }

  setCamera(state: CameraState): void {
    this._camera = state
    this._frameLoop.markDirty()
  }

  addRenderExtension(extension: RenderExtension): void {
    this._renderExtensions.add(extension)
    this._frameLoop.markDirty()
  }

  removeRenderExtension(id: string): void {
    this._renderExtensions.remove(id)
  }

  queryRenderedFeatures(_point: ScreenPoint): Feature[] {
    return []
  }

  renderFrame(): void {
    const { gl } = this._webgl
    gl.viewport(0, 0, this._width, this._height)

    const renderCtx: RenderContext = {
      gl,
      programs: this._webgl.programs,
      camera: this._camera ?? { center: { lng: 0, lat: 0 }, zoom: 0, bearing: 0, pitch: 0, groundElevation: 0 },
      visibleTiles: [],
      frameIndex: this._frameIndex,
    }

    this._renderExtensions.runBeforeTiles(renderCtx)

    for (const { layer } of this._layers) {
      if (isFullFrameLayer(layer)) {
        const paint = this._styleEvaluator.evaluate(layer, renderCtx.camera.zoom)
        layer.drawBackground({ gl, paint })
      }
      // Phase 2: per-tile draw here
    }

    this._renderExtensions.runAfterTiles(renderCtx)
    this._frameIndex++
  }

  /** Test helper — not part of RendererAPI */
  getLayers(): LayerInstance[] {
    return this._layers.map(e => e.layer)
  }
}
