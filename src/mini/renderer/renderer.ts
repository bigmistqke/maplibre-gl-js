// src/mini/renderer/renderer.ts
import type { CameraState, ScreenPoint, Feature, ResolvedPaintProperties } from '../core/types.ts'
import type { RendererAPI, LayerInstance, SourceDefinition } from '../core/renderer-api.ts'
import type { RenderExtension, RenderContext, ProgramCache } from '../core/render-extension.ts'
import type { Projection, Viewport } from '../core/projection.ts'
import type { TileService } from '../core/tile-service.ts'
import { WebGLContext } from './webgl-context.ts'
import { FrameLoop } from './frame-loop.ts'
import { StyleEvaluator } from './style-evaluator.ts'
import { RenderExtensions } from './render-extensions.ts'
import { TileManager } from './tile-manager.ts'
import { RasterLayer } from '../layers/raster.ts'
import { WorkerRasterTileService } from '../layers/raster-worker-service.ts'
import { WorkerVectorTileService } from '../layers/vector-worker-service.ts'

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
  private _sources = new globalThis.Map<string, SourceDefinition>()
  private _tileManagers = new globalThis.Map<string, TileManager>()
  private _tileLayers = new globalThis.Map<string, LayerInstance[]>()
  private _sourceTypes = new globalThis.Map<string, 'raster' | 'vector'>()
  private _camera: CameraState | null = null
  private _projection: Projection
  private _frameIndex = 0
  private _width: number
  private _height: number
  private _compiledPrograms = new WeakMap<Projection, { layers: ProgramCache; stencil: WebGLProgram }>()
  private _allPrograms: WebGLProgram[] = []

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

  private _getOrCompilePrograms(): { layers: ProgramCache; stencil: WebGLProgram } {
    if (!this._compiledPrograms.has(this._projection)) {
      const prelude = this._projection.vertexShaderPrelude
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

    // Per-tile draw loop — stencil-based tile clipping (MapLibre approach).
    // Each tile writes a unique ID into the stencil buffer (ALWAYS+REPLACE),
    // then layers draw with an EQUAL test so only fragments inside the tile pass.
    // This clips buffer-zone geometry without any coordinate filtering, so real
    // borders that coincide with tile boundaries are preserved at all zoom levels.
    gl.enable(gl.STENCIL_TEST)
    gl.clear(gl.STENCIL_BUFFER_BIT)
    let nextStencilRef = 1

    const viewport: Viewport = { width: this._width, height: this._height }
    for (const [sourceId, tileManager] of this._tileManagers) {
      const readyTiles = tileManager.getReadyTiles()
      const layers = this._tileLayers.get(sourceId) ?? []
      const sourceType = this._sourceTypes.get(sourceId) ?? 'raster'

      for (const { tileID, data } of readyTiles) {
        const mesh = this._projection.getMeshForTile(tileID)
        const meshBuffers = this._webgl.getOrCreateMeshBuffers(tileID.key, mesh)

        const ref = nextStencilRef++
        if (nextStencilRef > 255) nextStencilRef = 1

        // Phase 1: write stencil mask for this tile (no color output)
        // IMPORTANT: setTileUniforms BEFORE writeTileStencil
        this._projection.setTileUniforms(gl, stencilProg, tileID, camera, viewport)
        this._webgl.writeTileStencil(stencilProg, meshBuffers.vert, meshBuffers.idx, meshBuffers.indexCount, ref)

        // Phase 2: draw layers — only fragments where stencil === ref pass
        gl.stencilFunc(gl.EQUAL, ref, 0xFF)
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP)
        gl.stencilMask(0x00)

        let tileTexture: WebGLTexture | undefined
        if (sourceType === 'raster') {
          tileTexture = this._webgl.getOrCreateTexture(tileID.key, data as ImageBitmap)
        }

        for (const layer of layers) {
          const paint = this._styleEvaluator.evaluate(layer, camera.zoom)
          const program = programs.get((layer.constructor as any).programs?.[0]?.name)
          if (program) this._projection.setTileUniforms(gl, program, tileID, camera, viewport)
          ;(layer as any).draw({
            gl,
            programs,
            tileID,
            meshBuffers,
            zoom: camera.zoom,
            paint,
            frameIndex: this._frameIndex,
            tileTexture,
            tileData: sourceType === 'vector' ? data : undefined,
            imageAtlas: {},
            lineDashAtlas: {},
          })
        }
      }
    }

    gl.disable(gl.STENCIL_TEST)
    this._renderExtensions.runAfterTiles(renderCtx)
    this._frameIndex++
  }

  /** Test helper — not part of RendererAPI */
  getLayers(): LayerInstance[] {
    return this._layers.map(e => e.layer)
  }
}
