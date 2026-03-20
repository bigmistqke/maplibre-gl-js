// src/modular/layers/symbol/text-layer.ts
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import type { ProgramDefinition, CameraState } from '../../core/types.ts'
import type { DrawContext } from '../../core/render-extension.ts'
import type { RendererAPI } from '../../core/renderer-api.ts'
import type { PlacementParticipant, SymbolBucketData } from '../../core/placement-participant.ts'
import { GlyphManager } from './glyph-manager.ts'
import { TextWorkerService } from './workers/text-worker-service.ts'
import { lngToTileX, latToTileY } from '../../renderer/mercator.ts'
import { createDebug } from '../../debug.ts'
import type { SymbolTileData } from './types.ts'

const debug = createDebug('TextLayer', false)

// ---- SDF Shaders ----

const sdfVert = `
precision mediump float;
attribute vec2 a_anchor;
attribute vec2 a_offset;
attribute vec2 a_tex;
uniform vec2 u_texsize;
uniform vec2 u_resolution;
varying vec2 v_uv;
void main() {
  vec4 proj = projectTile(a_anchor);
  vec2 screen = proj.xy / proj.w;
  screen += (a_offset / 32.0) * vec2(2.0, -2.0) / u_resolution;
  gl_Position = vec4(screen * proj.w, proj.z, proj.w);
  v_uv = a_tex / u_texsize;
}
`

const sdfFrag = `
precision mediump float;
uniform sampler2D u_texture;
uniform vec4 u_color;
uniform float u_opacity;
uniform float u_font_scale;
varying vec2 v_uv;
void main() {
  float dist = texture2D(u_texture, v_uv).a;
  float EDGE_GAMMA = 0.105;
  float inner_edge = (256.0 - 64.0) / 256.0;
  float gamma = EDGE_GAMMA / u_font_scale;
  float alpha = smoothstep(inner_edge - gamma, inner_edge + gamma, dist);
  gl_FragColor = u_color * (alpha * u_opacity);
}
`

// ---- Options ----

export interface TextLayerOptions {
  source: string
  sourceLayer: string
  /** Template string, e.g. '{name}' */
  textField: string
  /** Font name, e.g. 'Open Sans Regular' — must match glyphs URL */
  fontstack?: string
  /** Font size in CSS pixels, default 16 */
  fontSize?: number
  /** Hex color string, default '#000000' */
  color?: string
  /** Opacity 0–1, default 1 */
  opacity?: number
  /** Constructed GlyphManager — caller owns lifecycle */
  glyphs: GlyphManager
}

function parseColor(c: string): [number, number, number, number] {
  const h = c.replace('#', '')
  if (h.length === 3)
    return [parseInt(h[0]+h[0],16)/255, parseInt(h[1]+h[1],16)/255, parseInt(h[2]+h[2],16)/255, 1]
  return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255, 1]
}

// ---- Layer ----

export class TextLayer implements PlacementParticipant {
  readonly type = 'text' as const

  static programs: ProgramDefinition[] = [
    { name: 'symbol_sdf', vertex: sdfVert, fragment: sdfFrag },
  ]

  readonly source: string
  readonly sourceLayer: string

  private _textField: string
  private _fontstack: string
  private _fontSize: number
  private _color: string
  private _opacity: number
  private _glyphs: GlyphManager
  private _workerService: TextWorkerService
  /** GPU-uploaded tile buckets (null = empty tile, missing = not yet ready) */
  private _tileBuckets = new globalThis.Map<string, { verts: WebGLBuffer; idx: WebGLBuffer; count: number } | null>()
  /** Fetched-but-not-yet-GPU-uploaded buckets, queued for upload on next draw() */
  private _pendingUploads = new globalThis.Map<string, SymbolTileData>()
  /** Keys currently being fetched from the worker (to avoid duplicate requests) */
  private _fetchingKeys = new globalThis.Set<string>()
  /** Atlas version at the time each tile bucket was uploaded — used to detect stale UVs */
  private _bucketAtlasVersion = new globalThis.Map<string, number>()
  private _webgl!: { createGeometryBuffer(key: string, data: ArrayBufferView, target: number): WebGLBuffer }
  private _gl!: WebGLRenderingContext
  private _tileOpacity = new globalThis.Map<string, Float32Array>()
  /** Cached label positions (tile-local coords) for synchronous getSymbolBuckets() */
  private _labelPosCache = new globalThis.Map<string, { x: number; y: number }[]>()
  /** Renderer reference for accessing camera state */
  private _renderer: RendererAPI | null = null
  /** Schedule a re-render — wired to FrameLoop.markDirty() in onAdd() */
  private _markDirty: (() => void) | null = null

  /** Expose workerService so callers can pass it as a TileService-like object if needed. */
  readonly workerService: TextWorkerService

  constructor(options: TextLayerOptions) {
    this.source = options.source
    this.sourceLayer = options.sourceLayer
    this._textField = options.textField
    this._fontstack = options.fontstack ?? 'Open Sans Regular'
    this._fontSize = options.fontSize ?? 16
    this._color = options.color ?? '#000000'
    this._opacity = options.opacity ?? 1
    this._glyphs = options.glyphs
    this._workerService = new TextWorkerService()
    this.workerService = this._workerService
  }

  onAdd(renderer: RendererAPI): void {
    this._webgl = (renderer as any)._webgl
    this._gl = (renderer as any)._gl
    this._renderer = renderer
    this._markDirty = () => (renderer as any)._frameLoop?.markDirty()

    // Wire glyph loading: GlyphManager already rebuilt atlas positions (CPU-side)
    // before firing this callback, so glyphPositions is up to date.
    // Push both the partial glyph map AND the fresh atlas positions to the worker.
    this._glyphs._onGlyphsLoaded = (partialMap, positions) => {
      debug('glyphs loaded → pushing to worker, invalidating stale buckets')
      this._workerService.updateGlyphs(partialMap, positions)
      // Atlas layout changed: invalidate all GPU-uploaded buckets so they get
      // re-fetched from the worker with UV coordinates matching the new atlas.
      this._invalidateAllBuckets()
      // Glyphs just arrived — trigger a re-render so text appears without user interaction.
      this._markDirty?.()
    }
  }

  evictTile(key: string): void {
    debug('evictTile', key)
    this._tileBuckets.delete(key)
    this._pendingUploads.delete(key)
    this._fetchingKeys.delete(key)
    this._bucketAtlasVersion.delete(key)
    this._tileOpacity.delete(key)
    this._labelPosCache.delete(key)
    this._workerService.cancel(key)
  }

  // ---- PlacementParticipant ----

  getSymbolBuckets(): SymbolBucketData[] {
    if (!this._renderer) return []
    const camera: CameraState = (this._renderer as any)._camera ?? null
    if (!camera) return []
    const gl: WebGLRenderingContext = this._gl
    if (!gl) return []
    const canvas = gl.canvas as HTMLCanvasElement
    const { zoom } = camera
    const TILE_SIZE = 256
    const worldSize = TILE_SIZE * Math.pow(2, zoom)
    const cx = lngToTileX(camera.center.lng, zoom) * TILE_SIZE
    const cy = latToTileY(camera.center.lat, zoom) * TILE_SIZE
    const w = canvas.width
    const h = canvas.height
    const halfLabelH = this._fontSize * 0.6  // approximate half-height in screen pixels

    const buckets: SymbolBucketData[] = []

    for (const [key, positions] of this._labelPosCache) {
      if (positions.length === 0) continue
      const parts = key.split('/')
      const tz = parseInt(parts[0], 10)
      const tx = parseInt(parts[1], 10)
      const ty = parseInt(parts[2], 10)
      if (isNaN(tz) || isNaN(tx) || isNaN(ty)) continue

      const tileScale = worldSize / Math.pow(2, tz)
      const tileOriginX = tx * tileScale
      const tileOriginY = ty * tileScale

      const anchors: Array<{ x: number; y: number }> = []
      const boxes: Array<[number, number, number, number]> = []

      for (const pos of positions) {
        const worldX = tileOriginX + (pos.x / 4096) * tileScale
        const worldY = tileOriginY + (pos.y / 4096) * tileScale
        const sx = (worldX - cx) + w / 2
        const sy = (worldY - cy) + h / 2

        anchors.push({ x: sx, y: sy })
        const halfW = (this._fontSize * 0.5)  // rough estimate
        boxes.push([sx - halfW, sy - halfLabelH, sx + halfW, sy + halfLabelH])
      }

      buckets.push({ tileKey: key, anchors, boxes })
    }

    return buckets
  }

  setFontSize(size: number): void {
    this._fontSize = size
    this._workerService.clearAllBuckets()
    this._invalidateAllBuckets()
    this._markDirty?.()
  }

  setOpacity(tileKey: string, opacity: Float32Array): void {
    this._tileOpacity.set(tileKey, opacity)
  }

  /**
   * Invalidate all GPU-uploaded buckets when the atlas layout changes.
   * The next draw() call per tile will re-fetch from the worker (which has
   * already been updated with new atlas positions via updateGlyphs).
   */
  private _invalidateAllBuckets(): void {
    const count = this._tileBuckets.size
    debug('invalidating all GPU buckets due to atlas rebuild', { count })
    this._tileBuckets.clear()
    this._pendingUploads.clear()
    this._fetchingKeys.clear()
    this._bucketAtlasVersion.clear()
    // NOTE: do NOT clear _labelPosCache — placement data is still valid
  }

  /**
   * Scan the PBF for text values and fire-and-forget load the needed glyph ranges.
   */
  private _ensureGlyphsForTile(pbfBuffer: ArrayBuffer): void {
    try {
      const tile = new VectorTile(new Pbf(pbfBuffer.slice(0)))
      const layerNames = this.sourceLayer ? [this.sourceLayer] : Object.keys(tile.layers)
      const codepoints = new Set<number>()
      for (const layerName of layerNames) {
        const layer = tile.layers[layerName]
        if (!layer) continue
        for (let i = 0; i < layer.length; i++) {
          const raw = this._textField.replace(/\{([^}]+)\}/g, (_, k) => String(layer.feature(i).properties[k] ?? '')).trim()
          if (!raw) continue
          for (let j = 0; j < raw.length; j++) {
            const cp = raw.codePointAt(j)
            if (cp !== undefined) { codepoints.add(cp); if (cp > 0xffff) j++ }
          }
        }
      }
      if (codepoints.size > 0) {
        debug('ensureGlyphs: requesting ranges for codepoints', { count: codepoints.size })
        void this._glyphs.getGlyphs({ [this._fontstack]: Array.from(codepoints) })
      }
    } catch { /* ignore parse errors */ }
  }

  /**
   * Background async fetch: polls the worker for the bucket and stores it in
   * _pendingUploads when ready. GL upload happens synchronously in draw() on
   * the next frame, avoiding any async/GL interleaving.
   */
  private _startFetch(key: string, ctx: DrawContext): void {
    this._fetchingKeys.add(key)
    debug('startFetch', key)

    if (ctx.tileData instanceof ArrayBuffer) {
      this._ensureGlyphsForTile(ctx.tileData)
      this._workerService.requestFromPbf(key, ctx.tileData, this._textField, this.sourceLayer, this._fontstack, this._fontSize)
    }

    const poll = async () => {
      const bucket = await this._workerService.getBucket(key)
      if (!this._fetchingKeys.has(key)) {
        debug('fetch cancelled (tile evicted)', key)
        return  // tile was evicted while we were waiting
      }
      this._fetchingKeys.delete(key)

      if (!bucket) {
        // Worker hasn't processed this tile yet (waiting for glyphs) — will retry next draw()
        debug('getBucket: not ready yet', key)
        return
      }

      debug('getBucket: ready', { key, count: bucket.count })

      if (bucket.count === 0) {
        this._tileBuckets.set(key, null)  // empty tile — stop retrying
        return
      }

      if (bucket.labelPositions) {
        this._labelPosCache.set(key, bucket.labelPositions)
      }
      this._pendingUploads.set(key, bucket)
      // Bucket is ready — trigger a re-render so text appears without user interaction.
      this._markDirty?.()
    }

    void poll()
  }

  /**
   * Synchronously upload a fetched bucket to the GPU.
   * Must be called from within a draw() call (synchronous GL context).
   */
  private _uploadBucket(key: string, bucket: SymbolTileData, gl: WebGLRenderingContext): void {
    this._glyphs.buildAtlas(gl)
    const atlasVersion = (this._glyphs as any)._atlasVersion as number
    debug('uploadBucket', { key, atlasVersion, indices: bucket.count })
    // Destroy any cached geometry buffers for this tile so re-upload is fresh
    this._webgl.destroyGeometryBuffers(`tile:${key}:sym:`)
    const verts = this._webgl.createGeometryBuffer(`tile:${key}:sym:v`, new Int16Array(bucket.vertices), gl.ARRAY_BUFFER)
    const idx = this._webgl.createGeometryBuffer(`tile:${key}:sym:i`, new Uint16Array(bucket.indices), gl.ELEMENT_ARRAY_BUFFER)
    this._tileBuckets.set(key, { verts, idx, count: bucket.count })
    this._bucketAtlasVersion.set(key, atlasVersion)
  }

  /**
   * draw() is now effectively synchronous for GL calls.
   * Async bucket fetching happens in the background (_startFetch), and results
   * are applied synchronously at the top of the next draw() call.
   */
  draw(ctx: DrawContext): void {
    const { gl, programs, tileID } = ctx
    const key = tileID.key

    // Apply any pending GPU uploads from background fetches (synchronous GL)
    const pending = this._pendingUploads.get(key)
    if (pending) {
      this._pendingUploads.delete(key)
      this._uploadBucket(key, pending, gl)
    }

    if (!this._tileBuckets.has(key)) {
      // Start background fetch if not already in progress
      if (!this._fetchingKeys.has(key)) {
        this._startFetch(key, ctx)
      } else {
        debug('draw: waiting for fetch', key)
      }
      return
    }

    const bufs = this._tileBuckets.get(key)
    if (!bufs) return  // empty tile

    // Placement: skip this tile if all labels are hidden
    const placementOpacity = this._tileOpacity.get(key)
    if (placementOpacity && placementOpacity.length > 0) {
      const anyPlaced = placementOpacity.some(v => v > 0)
      if (!anyPlaced) {
        debug('draw: all labels hidden by placement', key)
        return
      }
    }

    const program = programs.get('symbol_sdf')
    if (!program) return

    // Ensure atlas texture is up to date on GPU
    this._glyphs.buildAtlas(gl)
    if (!this._glyphs.glyphAtlasTexture) {
      debug('draw: no atlas texture yet', key)
      return
    }

    debug('draw: rendering', { key, count: bufs.count })

    gl.useProgram(program)

    // Bind glyph atlas to texture unit 0
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this._glyphs.glyphAtlasTexture)
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0)

    // Atlas size for UV normalization in shader (a_tex / u_texsize = [0,1])
    const atlas = (this._glyphs as any)._atlas
    const atlasW = atlas?.image.width ?? 1
    const atlasH = atlas?.image.height ?? 1
    gl.uniform2f(gl.getUniformLocation(program, 'u_texsize'), atlasW, atlasH)

    // Resolution for pixel-space offsets
    const canvas = gl.canvas as HTMLCanvasElement
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height)

    // Color + opacity
    const [r, g, b, a] = parseColor(this._color)
    gl.uniform4f(gl.getUniformLocation(program, 'u_color'), r, g, b, a)
    gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), this._opacity)
    // Font scale for gamma: matches MapLibre's fontScale = size / 24.0
    gl.uniform1f(gl.getUniformLocation(program, 'u_font_scale'), this._fontSize / 24.0)

    // Bind buffers and set attributes
    // GlyphVertexLayout stride = 12 bytes: ax(2) ay(2) ox(2) oy(2) u(2) v(2)
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.verts)

    const aAnchor = gl.getAttribLocation(program, 'a_anchor')
    gl.enableVertexAttribArray(aAnchor)
    gl.vertexAttribPointer(aAnchor, 2, gl.SHORT, false, 12, 0)  // ax, ay at offset 0

    const aOffset = gl.getAttribLocation(program, 'a_offset')
    gl.enableVertexAttribArray(aOffset)
    gl.vertexAttribPointer(aOffset, 2, gl.SHORT, false, 12, 4)  // ox, oy at offset 4

    const aTex = gl.getAttribLocation(program, 'a_tex')
    gl.enableVertexAttribArray(aTex)
    gl.vertexAttribPointer(aTex, 2, gl.UNSIGNED_SHORT, false, 12, 8)  // u, v at offset 8

    // Premultiplied alpha blend — matches MapLibre: fragColor = color * alpha, blend ONE, ONE_MINUS_SRC_ALPHA
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.idx)
    gl.drawElements(gl.TRIANGLES, bufs.count, gl.UNSIGNED_SHORT, 0)

    gl.disable(gl.BLEND)

    // Cleanup attributes
    gl.disableVertexAttribArray(aAnchor)
    gl.disableVertexAttribArray(aOffset)
    gl.disableVertexAttribArray(aTex)
  }

  destroy(): void {
    this._workerService.destroy()
    if (this._gl && this._glyphs.glyphAtlasTexture) {
      this._gl.deleteTexture(this._glyphs.glyphAtlasTexture)
    }
  }
}
