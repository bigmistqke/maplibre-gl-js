// src/mini/renderer/renderer.ts
import type { CameraState, ScreenPoint, Feature, ResolvedPaintProperties } from '../core/types.ts'
import type { RendererAPI, LayerInstance, SourceDefinition } from '../core/renderer-api.ts'
import type { RenderExtension, RenderContext } from '../core/render-extension.ts'
import type { Projection, Viewport } from '../core/projection.ts'
import { WebGLContext } from './webgl-context.ts'
import { FrameLoop } from './frame-loop.ts'
import { StyleEvaluator } from './style-evaluator.ts'
import { RenderExtensions } from './render-extensions.ts'
import { TileManager } from './tile-manager.ts'
import { RasterLayer, RasterTileService } from '../layers/raster.ts'

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

interface RasterSourceDefinition extends SourceDefinition {
  type: 'raster'
  url: string
  tileSize?: number
}

export class Renderer implements RendererAPI {
  private _webgl: WebGLContext
  private _frameLoop: FrameLoop
  private _styleEvaluator: StyleEvaluator
  private _renderExtensions: RenderExtensions
  private _layers: LayerEntry[] = []
  private _sources = new globalThis.Map<string, SourceDefinition>()
  private _tileManagers = new globalThis.Map<string, TileManager>()
  private _tileLayers = new globalThis.Map<string, LayerInstance[]>()
  private _camera: CameraState | null = null
  private _projection: Projection
  private _frameIndex = 0
  private _width: number
  private _height: number

  constructor(canvas: HTMLCanvasElement, projection: Projection) {
    this._width = canvas.width
    this._height = canvas.height
    this._projection = projection
    this._webgl = new WebGLContext(canvas)
    this._frameLoop = new FrameLoop(() => this.renderFrame())
    this._styleEvaluator = new StyleEvaluator()
    this._renderExtensions = new RenderExtensions()
    this._frameLoop.start()
  }

  resize(width: number, height: number): void {
    this._width = width
    this._height = height
    const viewport: Viewport = { width, height }
    for (const tm of this._tileManagers.values()) {
      tm.updateCacheSize(viewport)
    }
    this._frameLoop.markDirty()
  }

  destroy(): void {
    this._frameLoop.stop()
    for (const tm of this._tileManagers.values()) {
      tm.destroy()
    }
  }

  addSource(id: string, source: SourceDefinition): void {
    this._sources.set(id, source)
    if (source.type === 'raster') {
      const rasterSource = source as RasterSourceDefinition
      const tm = new TileManager(
        rasterSource.url,
        new RasterTileService(),
        this._projection,
        () => this._frameLoop.markDirty(),
        (key) => this._webgl.destroyTexture(key),
      )
      this._tileManagers.set(id, tm)
    }
    this._frameLoop.markDirty()
  }

  removeSource(id: string): void {
    const tm = this._tileManagers.get(id)
    if (tm) {
      tm.destroy()
      this._tileManagers.delete(id)
    }
    this._sources.delete(id)
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

    // Wire tile-based layers to their source's TileManager
    const sourceId = (layer as any).source
    if (sourceId) {
      if (!this._tileLayers.has(sourceId)) {
        this._tileLayers.set(sourceId, [])
      }
      this._tileLayers.get(sourceId)!.push(layer)
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
    const entry = this._layers.find(e => e.id === id)
    if (entry) {
      const sourceId = (entry.layer as any).source
      if (sourceId) {
        const layers = this._tileLayers.get(sourceId)
        if (layers) {
          const idx = layers.indexOf(entry.layer)
          if (idx !== -1) layers.splice(idx, 1)
        }
      }
    }
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
    const viewport: Viewport = { width: this._width, height: this._height }
    for (const tm of this._tileManagers.values()) {
      tm.updateCacheSize(viewport)   // must come before update()
      tm.update(state, viewport)
    }
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

    const camera = this._camera ?? {
      center: { lng: 0, lat: 0 },
      zoom: 0,
      bearing: 0,
      pitch: 0,
      groundElevation: 0,
    }

    const renderCtx: RenderContext = {
      gl,
      programs: this._webgl.programs,
      camera,
      visibleTiles: [],
      frameIndex: this._frameIndex,
    }

    this._renderExtensions.runBeforeTiles(renderCtx)

    // Full-frame layers (e.g. BackgroundLayer)
    for (const { layer } of this._layers) {
      if (isFullFrameLayer(layer)) {
        const paint = this._styleEvaluator.evaluate(layer, camera.zoom)
        layer.drawBackground({ gl, paint })
      }
    }

    // Per-tile draw loop
    const viewport: Viewport = { width: this._width, height: this._height }
    for (const [sourceId, tileManager] of this._tileManagers) {
      const readyTiles = tileManager.getReadyTiles()
      const layers = this._tileLayers.get(sourceId) ?? []
      for (const { tileID, imageBitmap } of readyTiles) {
        const tileTexture = this._webgl.getOrCreateTexture(tileID.key, imageBitmap)
        const matrix = this._projection.getTileMatrix(tileID, camera, viewport)
        for (const layer of layers) {
          const paint = this._styleEvaluator.evaluate(layer, camera.zoom)
          ;(layer as any).draw({
            gl,
            programs: this._webgl.programs,
            tileID,
            matrix,
            zoom: camera.zoom,
            paint,
            frameIndex: this._frameIndex,
            tileTexture,
            imageAtlas: {},
            lineDashAtlas: {},
          })
        }
      }
    }

    this._renderExtensions.runAfterTiles(renderCtx)
    this._frameIndex++
  }

  /** Test helper — not part of RendererAPI */
  getLayers(): LayerInstance[] {
    return this._layers.map(e => e.layer)
  }
}
