// src/modular/layers/symbol/line-text-layer.ts
import type { ProgramDefinition } from '../../core/types.ts'
import type { DrawContext, RenderContext } from '../../core/render-extension.ts'
import type { RendererAPI } from '../../core/renderer-api.ts'
import type { GlyphManager } from './glyph-manager.ts'
import type { GlyphMap, GlyphPositions, SymbolTileData, LineLabelInfo } from './types.ts'
import { LineTextWorkerService } from './workers/line-text-worker-service.ts'
import { ensureGlyphsForTile } from './ensure-glyphs.ts'
import { createDebug } from '../../debug.ts'
import { SymbolLayerBase } from './base/symbol-layer-base.ts'
import { TileFetcher } from './base/tile-fetcher.ts'
import type { CollisionData, GPUBucket } from './base/types.ts'
import type { LabelData } from './engine/cross-tile-index.ts'
import murmur3 from 'murmurhash-js'
import { updateLineLabels, getPitchedLabelPlaneMatrix } from './vendor/projection.ts'
import { TransformAdapter } from './vendor/transform_adapter.ts'
import { buildBucketShim, extractDynamicBuffer } from './vendor/bucket_shim.ts'
import { TILE_EXTENT, TILE_SIZE } from '../../core/constants.ts'
import { mat4 } from 'gl-matrix'

const debug = createDebug?.('LineTextLayer', false)

// ---- SDF Shaders ----

const sdfVert = `
precision mediump float;
attribute vec2 a_anchor;
attribute vec2 a_offset;
attribute vec2 a_tex;
attribute vec3 a_projected_pos;
uniform vec2 u_texsize;
uniform vec2 u_resolution;
uniform float u_is_along_line;
varying vec2 v_uv;
void main() {
  if (u_is_along_line > 0.5) {
    // Line label: use pre-computed screen position + rotation
    float angle = -a_projected_pos.z;
    float cos_a = cos(angle);
    float sin_a = sin(angle);
    mat2 rot = mat2(cos_a, -sin_a, sin_a, cos_a);
    vec2 rotated_offset = rot * (a_offset / 32.0);
    vec2 pixel_offset = rotated_offset * vec2(2.0, -2.0) / u_resolution;
    // STUB: pitch correction — MapLibre adjusts z/w for depth based on camera distance
    gl_Position = vec4(a_projected_pos.xy + pixel_offset, 0.0, 1.0);
  } else {
    // Point label: existing tile projection (fallback, not normally used for line text)
    vec4 proj = projectTile(a_anchor);
    vec2 screen = proj.xy / proj.w;
    screen += (a_offset / 32.0) * vec2(2.0, -2.0) / u_resolution;
    gl_Position = vec4(screen * proj.w, proj.z, proj.w);
  }
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
  float dist = texture2D(u_texture, v_uv).r;
  float EDGE_GAMMA = 0.105;
  float inner_edge = (256.0 - 64.0) / 256.0;
  float gamma = EDGE_GAMMA / u_font_scale;
  float alpha = smoothstep(inner_edge - gamma, inner_edge + gamma, dist);
  gl_FragColor = u_color * (alpha * u_opacity);
}
`

// ---- Options ----

export interface LineTextLayerOptions {
  source: string
  /** MVT source-layer name inside the PBF — required for line text (e.g. 'transportation_name') */
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
  /** Glyph URL template, e.g. 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf' */
  glyphUrl: string
  /** Optional layer id */
  id?: string
}

function parseColor(c: string): [number, number, number, number] {
  const h = c.replace('#', '')
  if (h.length === 3)
    return [parseInt(h[0]+h[0],16)/255, parseInt(h[1]+h[1],16)/255, parseInt(h[2]+h[2],16)/255, 1]
  return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255, 1]
}

// ---- Layer ----

export class LineTextLayer extends SymbolLayerBase<SymbolTileData> {
  readonly extent = 4096

  static programs: ProgramDefinition[] = [
    { name: 'line_symbol_sdf', vertex: sdfVert, fragment: sdfFrag },
  ]

  private _textField: string
  private _fontstack: string
  private _fontSize: number
  private _color: string
  private _opacity: number
  private _glyphUrl: string
  private _workerService: LineTextWorkerService
  private _glyphManager: GlyphManager | null = null
  private _glyphListener: ((map: GlyphMap, positions: GlyphPositions) => void) | null = null

  /** Per-tile LabelData for cross-tile dedup */
  private _labelData = new Map<string, LabelData[]>()
  /** Cached label positions (tile-local coords) for collision data */
  private _labelPosCache = new Map<string, { x: number; y: number }[]>()
  /** Number of index-buffer indices per label (for per-label draw calls) */
  private _indicesPerLabel = new Map<string, number[]>()
  /** Atlas version at the time each tile bucket was uploaded — used to detect stale UVs */
  private _bucketAtlasVersion = new Map<string, number>()
  /** Tiles whose GPU bucket needs replacing but old data is still shown */
  private _staleBuckets = new Set<string>()

  /** Per-tile line label metadata from worker */
  private _lineLabels = new Map<string, LineLabelInfo[]>()
  /** Per-tile CPU-side dynamic buffer for projected glyph positions */
  private _dynamicBuffers = new Map<string, Float32Array>()
  /** Per-tile GPU-side dynamic buffer (DYNAMIC_DRAW) */
  private _dynamicGLBuffers = new Map<string, WebGLBuffer>()

  /** Expose workerService so callers can pass it as a TileService-like object if needed. */
  readonly workerService: LineTextWorkerService

  constructor(options: LineTextLayerOptions) {
    const workerService = new LineTextWorkerService()

    const tileFetcher = new TileFetcher<SymbolTileData>({
      fetch: async (key: string, data: ArrayBuffer): Promise<SymbolTileData | null> => {
        debug?.('tileFetcher.fetch', key)

        // Ensure glyph ranges are loaded for this tile
        if (this._glyphManager) {
          ensureGlyphsForTile(data, this._textField, this.sourceLayer, this._fontstack, this._glyphManager)
        }

        // Request layout from worker
        workerService.requestFromPbf(key, data, this._textField, this.sourceLayer, this._fontstack, this._fontSize)

        // Poll for result
        const bucket = await workerService.getBucket(key)
        if (!bucket) {
          debug?.('tileFetcher: not ready yet', key)
          return null
        }

        debug?.('tileFetcher: ready', { key, count: bucket.count })

        if (bucket.count === 0) {
          return null
        }

        // Cache label positions and per-label index counts for collision data + per-label draw
        if (bucket.labelPositions) {
          this._labelPosCache.set(key, bucket.labelPositions)
        }
        if (bucket.indicesPerLabel) {
          this._indicesPerLabel.set(key, bucket.indicesPerLabel)
        }

        // Build LabelData for cross-tile dedup
        if (bucket.labelPositions && bucket.labelTexts) {
          const labelData: LabelData[] = []
          for (let i = 0; i < bucket.labelPositions.length; i++) {
            labelData.push({
              key: murmur3(bucket.labelTexts[i] ?? ''),
              anchorX: bucket.labelPositions[i].x,
              anchorY: bucket.labelPositions[i].y,
              crossTileID: 0,
            })
          }
          this._labelData.set(key, labelData)
        }

        return bucket
      },
      onReady: (key: string, _result: SymbolTileData) => {
        debug?.('tileFetcher.onReady', key)
        this._pendingUploads.set(key, _result)
        this._staleBuckets.delete(key)
        this._markDirty?.()
      },
    })

    super(tileFetcher, {
      source: options.source,
      sourceLayer: options.sourceLayer,
      id: options.id,
    })

    this._textField = options.textField
    this._fontstack = options.fontstack ?? 'Open Sans Regular'
    this._fontSize = options.fontSize ?? 16
    this._color = options.color ?? '#000000'
    this._opacity = options.opacity ?? 1
    this._glyphUrl = options.glyphUrl
    this._workerService = workerService
    this.workerService = workerService
  }

  // ---- Lifecycle ----

  onAdd(renderer: RendererAPI): void {
    super.onAdd(renderer)

    // Get shared GlyphManager from engine resources
    this._glyphManager = this._engine!.resources.getGlyphManager(this._glyphUrl, this._fontstack)

    // Wire glyph loading listener
    this._glyphListener = (partialMap: GlyphMap, positions: GlyphPositions) => {
      debug?.('glyphs loaded → pushing to worker, invalidating stale buckets')
      this._workerService.updateGlyphs(partialMap, positions)

      // Atlas layout changed: invalidate all GPU-uploaded buckets so they get
      // re-fetched from the worker with UV coordinates matching the new atlas.
      const count = this._tileBuckets.size
      debug?.('invalidating all GPU buckets due to atlas rebuild', { count })
      for (const key of [...this._tileBuckets.keys()]) {
        this._tileFetcher.invalidate(key)
      }
      this._tileBuckets.clear()
      this._bucketAtlasVersion.clear()
      this._staleBuckets.clear()
      // NOTE: do NOT clear _labelPosCache — placement data is still valid

      this._markDirty?.()
    }
    this._glyphManager.addGlyphsLoadedListener(this._glyphListener)

    debug?.('onAdd complete', { glyphUrl: this._glyphUrl, fontstack: this._fontstack })
  }

  onRemove(): void {
    // Remove glyph listener
    if (this._glyphManager && this._glyphListener) {
      this._glyphManager.removeGlyphsLoadedListener(this._glyphListener)
      this._glyphListener = null
      this._glyphManager = null
    }

    // Destroy worker service
    this._workerService.destroy()

    super.onRemove()
  }

  // ---- PlaceableLayer override ----

  getLabelData(): Map<string, LabelData[]> {
    return this._labelData
  }

  // ---- Abstract implementations ----

  protected _getProgramName(): string {
    return 'line_symbol_sdf'
  }

  uploadBucket(gl: WebGLRenderingContext, key: string, data: SymbolTileData): GPUBucket {
    // Ensure atlas texture is built
    this._glyphManager!.buildAtlas(gl)
    const atlasVersion = this._glyphManager!._atlasVersion

    debug?.('uploadBucket', { key, atlasVersion, indices: data.count })

    const renderer = this._renderer! as Required<Pick<RendererAPI, 'createGeometryBuffer' | 'destroyGeometryBuffers'>>
    // Destroy any cached geometry buffers for this tile so re-upload is fresh
    renderer.destroyGeometryBuffers(`tile:${key}:lsym:`)
    const verts = renderer.createGeometryBuffer(`tile:${key}:lsym:v`, new Int16Array(data.vertices), gl.ARRAY_BUFFER)
    const idx = renderer.createGeometryBuffer(`tile:${key}:lsym:i`, new Uint16Array(data.indices), gl.ELEMENT_ARRAY_BUFFER)

    this._bucketAtlasVersion.set(key, atlasVersion)

    // Store line label metadata and allocate dynamic buffer for per-frame projection
    if (data.lineLabels && data.lineLabels.length > 0) {
      this._lineLabels.set(key, data.lineLabels)

      let totalGlyphs = 0
      for (const label of data.lineLabels) {
        totalGlyphs += label.glyphOffsets.length
      }

      // 4 vertices per glyph, 3 floats per vertex (x, y, angle)
      const dynamicBuffer = new Float32Array(totalGlyphs * 4 * 3)
      this._dynamicBuffers.set(key, dynamicBuffer)

      const dynamicGLBuffer = gl.createBuffer()
      if (dynamicGLBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, dynamicGLBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, dynamicBuffer.byteLength, gl.DYNAMIC_DRAW)
        this._dynamicGLBuffers.set(key, dynamicGLBuffer)
      }

      debug?.('uploadBucket: line labels', { key, labels: data.lineLabels.length, totalGlyphs })
    }

    return { verts, idx, count: data.count, indicesPerLabel: data.indicesPerLabel }
  }

  drawTile(gl: WebGLRenderingContext, program: WebGLProgram, bucket: GPUBucket, ctx: DrawContext): void {
    const key = ctx.tileID.key

    // Ensure atlas texture is up to date on GPU
    this._glyphManager!.buildAtlas(gl)
    if (!this._glyphManager!.glyphAtlasTexture) {
      debug?.('drawTile: no atlas texture yet', key)
      return
    }

    // Placement: skip this tile if all labels are hidden
    const placementOpacity = this._labelOpacity.get(key)
    if (placementOpacity && placementOpacity.length > 0) {
      const anyPlaced = placementOpacity.some(v => v > 0)
      if (!anyPlaced) {
        debug?.('drawTile: all labels hidden by placement', key)
        return
      }
    }

    debug?.('drawTile: rendering', { key, count: bucket.count })

    // Bind glyph atlas to texture unit 0
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this._glyphManager!.glyphAtlasTexture)
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0)

    // Atlas size for UV normalization in shader (a_tex / u_texsize = [0,1])
    const atlas = this._glyphManager!.atlas
    const atlasW = atlas?.image.width ?? 1
    const atlasH = atlas?.image.height ?? 1
    gl.uniform2f(gl.getUniformLocation(program, 'u_texsize'), atlasW, atlasH)

    // Resolution for pixel-space offsets
    const canvas = gl.canvas as HTMLCanvasElement
    const canvasWidth = canvas.width
    const canvasHeight = canvas.height
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvasWidth, canvasHeight)

    // Color + opacity
    const [r, g, b, a] = parseColor(this._color)
    gl.uniform4f(gl.getUniformLocation(program, 'u_color'), r, g, b, a)
    gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), this._opacity)
    // Font scale for gamma: matches MapLibre's fontScale = size / 24.0
    gl.uniform1f(gl.getUniformLocation(program, 'u_font_scale'), this._fontSize / 24.0)

    // Per-frame line label projection
    const lineLabels = this._lineLabels.get(key)
    const dynamicBuffer = this._dynamicBuffers.get(key)
    const dynamicGLBuffer = this._dynamicGLBuffers.get(key)
    const hasLineLabels = lineLabels && dynamicBuffer && dynamicGLBuffer

    if (hasLineLabels && ctx.camera) {
      // Build TransformAdapter + PainterLike from camera state
      const viewport = { width: canvasWidth, height: canvasHeight }
      const transform = new TransformAdapter(ctx.camera, viewport)
      const painter = { transform, width: canvasWidth, height: canvasHeight }

      // Build UnwrappedTileID from our TileID
      const tileID = ctx.tileID
      const unwrappedTileID = {
        canonical: { z: tileID.z, x: tileID.x, y: tileID.y },
        wrap: 0,
      }

      // Build bucket shim from our LineLabelInfo[]
      const bucketShim = buildBucketShim(lineLabels, this._fontSize)

      // Compute label plane matrices
      // For pitchWithMap=false, rotateWithMap=false:
      //   pixelsToTileUnits converts from screen pixels to tile coordinate units
      const pixelsToTileUnits = TILE_EXTENT / (TILE_SIZE * Math.pow(2, ctx.zoom - tileID.z))
      const pitchedLabelPlaneMatrix = getPitchedLabelPlaneMatrix(false, transform, pixelsToTileUnits)
      const pitchedLabelPlaneMatrixInverse = mat4.create()
      mat4.invert(pitchedLabelPlaneMatrixInverse, pitchedLabelPlaneMatrix)

      // Run vendored updateLineLabels
      updateLineLabels(
        bucketShim,      // bucket
        painter,         // painter
        true,            // isText
        pitchedLabelPlaneMatrix,
        pitchedLabelPlaneMatrixInverse,
        false,           // pitchWithMap — labels face camera
        true,            // keepUpright — labels should be readable
        true,            // rotateToLine — text follows line direction
        unwrappedTileID,
        canvasWidth,     // viewportWidth
        canvasHeight,    // viewportHeight
        [0, 0],          // translation
        () => 0,         // getElevation — flat map
      )

      // Extract results from bucket shim into our dynamic buffer (viewport pixels → NDC)
      extractDynamicBuffer(bucketShim, dynamicBuffer, canvasWidth, canvasHeight)

      // Upload dynamic buffer to GPU
      gl.bindBuffer(gl.ARRAY_BUFFER, dynamicGLBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, dynamicBuffer, gl.DYNAMIC_DRAW)

      // Bind a_projected_pos from dynamic buffer
      const aProjPos = gl.getAttribLocation(program, 'a_projected_pos')
      if (aProjPos >= 0) {
        gl.enableVertexAttribArray(aProjPos)
        gl.vertexAttribPointer(aProjPos, 3, gl.FLOAT, false, 12, 0)
      }

      // Set along-line mode
      gl.uniform1f(gl.getUniformLocation(program, 'u_is_along_line'), 1.0)

      debug?.('drawTile: vendored line projection updated', { key, labels: lineLabels.length })
    } else {
      gl.uniform1f(gl.getUniformLocation(program, 'u_is_along_line'), 0.0)
    }

    // Bind static buffers and set attributes
    // GlyphVertexLayout stride = 12 bytes: ax(2) ay(2) ox(2) oy(2) u(2) v(2)
    gl.bindBuffer(gl.ARRAY_BUFFER, bucket.verts)

    const aAnchor = gl.getAttribLocation(program, 'a_anchor')
    gl.enableVertexAttribArray(aAnchor)
    gl.vertexAttribPointer(aAnchor, 2, gl.SHORT, false, 12, 0)  // ax, ay at offset 0

    const aOffset = gl.getAttribLocation(program, 'a_offset')
    gl.enableVertexAttribArray(aOffset)
    gl.vertexAttribPointer(aOffset, 2, gl.SHORT, false, 12, 4)  // ox, oy at offset 4

    const aTex = gl.getAttribLocation(program, 'a_tex')
    gl.enableVertexAttribArray(aTex)
    gl.vertexAttribPointer(aTex, 2, gl.UNSIGNED_SHORT, false, 12, 8)  // u, v at offset 8

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bucket.idx)

    // Per-label draw: skip labels hidden by collision/dedup
    const placementOp = this._labelOpacity.get(key)
    if (placementOp && bucket.indicesPerLabel && placementOp.length === bucket.indicesPerLabel.length) {
      const opacityLoc = gl.getUniformLocation(program, 'u_opacity')
      let offset = 0
      for (let i = 0; i < bucket.indicesPerLabel.length; i++) {
        const labelCount = bucket.indicesPerLabel[i]
        if (placementOp[i] > 0) {
          gl.uniform1f(opacityLoc, placementOp[i] * this._opacity)
          gl.drawElements(gl.TRIANGLES, labelCount, gl.UNSIGNED_SHORT, offset * 2)
        }
        offset += labelCount
      }
    } else {
      gl.drawElements(gl.TRIANGLES, bucket.count, gl.UNSIGNED_SHORT, 0)
    }

    // Cleanup attributes
    gl.disableVertexAttribArray(aAnchor)
    gl.disableVertexAttribArray(aOffset)
    gl.disableVertexAttribArray(aTex)
    if (hasLineLabels) {
      const aProjPos = gl.getAttribLocation(program, 'a_projected_pos')
      if (aProjPos >= 0) {
        gl.disableVertexAttribArray(aProjPos)
      }
    }
  }

  getCollisionData(ctx: RenderContext, visibleKeys: ReadonlySet<string>): CollisionData[] {
    if (!this._renderer) return []
    const camera = ctx.camera
    if (!camera) return []
    const gl = ctx.gl
    const canvas = gl.canvas as HTMLCanvasElement
    const w = canvas.width
    const h = canvas.height

    const buckets: CollisionData[] = []

    for (const [key, positions] of this._labelPosCache) {
      if (positions.length === 0) continue
      if (!visibleKeys.has(key)) continue

      const screenPositions = this._projectToScreen(positions, key, camera, w, h)
      if (screenPositions.length === 0) continue

      const anchors: Array<{ x: number; y: number }> = []
      const boxes: Array<[number, number, number, number]> = []
      const lineLabels = this._lineLabels.get(key)
      const fontScale = this._fontSize / 24

      for (let i = 0; i < screenPositions.length; i++) {
        const sp = screenPositions[i]
        anchors.push({ x: sp.x, y: sp.y })

        // Compute collision box from actual glyph offset span
        const label = lineLabels?.[i]
        let halfW: number
        if (label && label.glyphOffsets.length > 0) {
          const offsets = label.glyphOffsets
          const span = (offsets[offsets.length - 1] - offsets[0]) * fontScale
          halfW = span / 2 + this._fontSize  // add one character width padding
        } else {
          halfW = this._fontSize * 3  // fallback
        }
        const halfH = this._fontSize * 0.6
        boxes.push([sp.x - halfW, sp.y - halfH, sp.x + halfW, sp.y + halfH])
      }

      const labelData = this._labelData.get(key)
      buckets.push({
        tileKey: key,
        anchors,
        boxes,
        crossTileIDs: labelData ? labelData.map(l => l.crossTileID) : [],
      })
    }

    return buckets
  }

  // ---- Stale bucket handling (override draw to support stale pattern) ----

  draw(ctx: DrawContext): void {
    const key = ctx.tileID.key

    // Stale: has old GPU data but needs a new fetch — start one, then fall through to render old data
    if (this._staleBuckets.has(key) && !this._tileFetcher.hasPending(key)) {
      if (ctx.tileData instanceof ArrayBuffer) {
        this._tileFetcher.request(key, ctx.tileData)
      }
    }

    // Delegate to base class draw which handles pending uploads, fetching, and drawTile
    super.draw(ctx)
  }

  // ---- Public API ----

  setFontSize(size: number): void {
    this._fontSize = size
    this._workerService.clearAllBuckets()
    // Mark existing tiles as stale so new buckets are fetched, but keep old
    // GPU data visible until the replacement is ready (no flicker).
    for (const key of this._tileBuckets.keys()) {
      this._staleBuckets.add(key)
      this._tileFetcher.invalidate(key)
    }
    this._bucketAtlasVersion.clear()
    this._markDirty?.()
  }

  // ---- Tile eviction override ----

  evictTile(key: string): void {
    debug?.('evictTile', key)
    this._labelData.delete(key)
    this._labelPosCache.delete(key)
    this._indicesPerLabel.delete(key)
    this._bucketAtlasVersion.delete(key)
    this._staleBuckets.delete(key)
    this._lineLabels.delete(key)
    this._dynamicBuffers.delete(key)
    const dynBuf = this._dynamicGLBuffers.get(key)
    if (dynBuf && this._gl) {
      this._gl.deleteBuffer(dynBuf)
    }
    this._dynamicGLBuffers.delete(key)
    this._workerService.cancel(key)
    super.evictTile(key)
  }

  destroy(): void {
    this._workerService.destroy()
    if (this._gl && this._glyphManager?.glyphAtlasTexture) {
      this._gl.deleteTexture(this._glyphManager.glyphAtlasTexture)
    }
  }
}
