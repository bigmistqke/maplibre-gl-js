// src/mini/renderer/renderer.ts
import type { CameraState, ScreenPoint, Feature, ResolvedPaintProperties } from '../core/types.ts'
import type { RendererAPI, LayerInstance, SourceDefinition, CustomLayer } from '../core/renderer-api.ts'
import type { RenderExtension, RenderContext, ProgramCache } from '../core/render-extension.ts'
import type { Projection, Viewport } from '../core/projection.ts'
import type { TileService } from '../core/tile-service.ts'
import type { Surface, RendererInternals } from '../core/surface.ts'
import { WebGLContext } from './webgl-context.ts'
import { FrameLoop } from './frame-loop.ts'
import { StyleEvaluator } from './style-evaluator.ts'
import { RenderExtensions } from './render-extensions.ts'
import { TileManager } from './tile-manager.ts'
import { RasterLayer } from '../layers/raster.ts'
import { WorkerRasterTileService } from '../layers/raster-worker-service.ts'
import { WorkerVectorTileService } from '../layers/vector-worker-service.ts'
import { FLAT_SURFACE } from './flat-surface.ts'
import { ELEVATION_PRELUDE } from './flat-render-tiles.ts'

function isCustomLayer(layer: LayerInstance | CustomLayer): layer is CustomLayer {
  return layer.type === 'custom'
}

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
  tileService?: TileService  // injected in tests; defaults to WorkerRasterTileService in Task 9
}

interface VectorSourceDefinition extends SourceDefinition {
  type: 'vector'
  url: string
  tileSize?: number
  tileService?: TileService  // defaults to WorkerVectorTileService (wired in Task 8)
}

export class Renderer implements RendererAPI {
  private _webgl: WebGLContext
  private _frameLoop: FrameLoop
  private _styleEvaluator: StyleEvaluator
  private _renderExtensions: RenderExtensions
  private _layers: LayerEntry[] = []
  private _customLayers: CustomLayer[] = []
  private _sources = new globalThis.Map<string, SourceDefinition>()
  private _tileManagers = new globalThis.Map<string, TileManager>()
  private _tileLayers = new globalThis.Map<string, LayerInstance[]>()
  private _sourceTypes = new globalThis.Map<string, 'raster' | 'vector'>()
  private _camera: CameraState | null = null
  private _projection: Projection
  private _frameIndex = 0
  readonly __webgl2: boolean = false
  private _surface: Surface = FLAT_SURFACE
  private _width: number
  private _height: number
  private _compiledPrograms = new WeakMap<Projection, { layers: ProgramCache; stencil: WebGLProgram }>()
  private _allPrograms: WebGLProgram[] = []

  constructor(canvas: HTMLCanvasElement, projection: Projection, contextType: 'webgl' | 'webgl2' = 'webgl') {
    this.__webgl2 = contextType === 'webgl2'
    this._width = canvas.width
    this._height = canvas.height
    this._projection = projection
    this._webgl = new WebGLContext(canvas, contextType)
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
      if (this._camera) tm.update(this._camera, viewport)
    }
    this._frameLoop.markDirty()
  }

  destroy(): void {
    this._frameLoop.stop()
    for (const tm of this._tileManagers.values()) tm.destroy()
    const { gl } = this._webgl
    for (const prog of this._allPrograms) gl.deleteProgram?.(prog)
  }

  addSource(id: string, source: SourceDefinition): void {
    this._sources.set(id, source)
    if (source.type === 'raster') {
      const rasterSource = source as RasterSourceDefinition
      const tm = new TileManager(
        rasterSource.url,
        rasterSource.tileService ?? new WorkerRasterTileService(),
        this._projection,
        () => this._frameLoop.markDirty(),
        (key) => this._webgl.destroyTexture(key),
      )
      this._tileManagers.set(id, tm)
      this._sourceTypes.set(id, 'raster')
      if (this._camera) {
        const viewport: Viewport = { width: this._width, height: this._height }
        tm.updateCacheSize(viewport)
        tm.update(this._camera, viewport)
      }
    }
    if (source.type === 'vector') {
      const vectorSource = source as VectorSourceDefinition
      const svc = vectorSource.tileService ?? new WorkerVectorTileService()
      const tm = new TileManager(
        vectorSource.url,
        svc,
        this._projection,
        () => this._frameLoop.markDirty(),
        (key) => {
          this._webgl.destroyGeometryBuffers(`tile:${key}`)
          for (const layer of this._tileLayers.get(id) ?? []) {
            (layer as any).evictTile?.(key)
          }
        },
      )
      this._tileManagers.set(id, tm)
      this._sourceTypes.set(id, 'vector')
      if (this._camera) {
        const viewport: Viewport = { width: this._width, height: this._height }
        tm.updateCacheSize(viewport)
        tm.update(this._camera, viewport)
      }
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
    this._sourceTypes.delete(id)
    this._frameLoop.markDirty()
  }

  addLayer(layer: LayerInstance | CustomLayer, beforeId?: string): void {
    if (isCustomLayer(layer)) {
      this._customLayers.push(layer)
      if (layer.onAdd) {
        const { stencil: _s, layers: _l } = this._getOrCompilePrograms()
        layer.onAdd(this._webgl.gl, this._projection.vertexShaderPrelude)
      }
      this._frameLoop.markDirty()
      return
    }

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
    this._frameLoop.markDirty()
  }

  removeLayer(id: string): void {
    const customIdx = this._customLayers.findIndex(l => l.id === id)
    if (customIdx !== -1) {
      const layer = this._customLayers[customIdx]
      layer.onRemove?.(this._webgl.gl)
      this._customLayers.splice(customIdx, 1)
      this._frameLoop.markDirty()
      return
    }

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

  setSurface(surface: Surface): void {
    this._surface.destroy()
    this._surface = surface
    // Invalidate compiled programs — will recompile with new shaderDefines on next frame
    this._compiledPrograms = new WeakMap()
  }

  queryRenderedFeatures(_point: ScreenPoint): Feature[] {
    return []
  }

  private _getOrCompilePrograms(): { layers: ProgramCache; stencil: WebGLProgram } {
    if (!this._compiledPrograms.has(this._projection)) {
      const prelude = this._surface.shaderDefines.join('\n') + '\n' +
                      this._projection.vertexShaderPrelude + '\n' +
                      ELEVATION_PRELUDE
      const defs = this._layers.flatMap(e => (e.layer.constructor as any).programs ?? [])
      const layers = this._webgl.compilePrograms(defs, prelude)
      const stencil = this._webgl.compileStencilProgram(prelude)
      for (const def of defs) {
        const p = layers.get(def.name)
        if (p) this._allPrograms.push(p)
      }
      this._allPrograms.push(stencil)
      this._compiledPrograms.set(this._projection, { layers, stencil })
    }
    return this._compiledPrograms.get(this._projection)!
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

    const viewport: Viewport = { width: this._width, height: this._height }
    const { layers: programs, stencil: stencilProg } = this._getOrCompilePrograms()

    const renderCtx: RenderContext = {
      gl,
      programs,
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

    const internals: RendererInternals = {
      gl: this._webgl.gl as WebGL2RenderingContext,
      camera,
      viewport,
      projection: this._projection,
      programs,
      stencilProgram: stencilProg,
      layers: this._layers,
      tileLayers: this._tileLayers,
      tileManagers: this._tileManagers,
      sourceTypes: this._sourceTypes,
      customLayers: this._customLayers,
      evaluate: (layer, zoom) => this._styleEvaluator.evaluate(layer, zoom),
      frameIndex: this._frameIndex,
      createFramebuffer: (w, h) => this._webgl.createFramebuffer(w, h),
      destroyFramebuffer: (fb) => this._webgl.destroyFramebuffer(fb),
      getOrCreateTexture: (key, bitmap) => this._webgl.getOrCreateTexture(key, bitmap),
      getOrCreateMeshBuffers: (key, mesh) => this._webgl.getOrCreateMeshBuffers(key, mesh),
      writeTileStencil: (prog, vert, idx, count, ref) =>
        this._webgl.writeTileStencil(prog, vert, idx, count, ref),
    }

    this._surface.renderTiles(internals)

    this._renderExtensions.runAfterTiles(renderCtx)
    this._frameIndex++
  }

  /** Test helper — not part of RendererAPI */
  getLayers(): LayerInstance[] {
    return this._layers.map(e => e.layer)
  }
}
