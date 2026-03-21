import type { DrawContext } from '../../core/render-extension'
import type { RendererAPI } from '../../core/renderer-api'
import type { ProgramDefinition, CameraState } from '../../core/types'
import type { PlacementParticipant, SymbolBucketData } from '../../core/placement-participant'
import { ImageManager } from './image-manager'
import { IconWorkerService } from './workers/icon-worker-service'
import type { IconTileData } from './icon-types'
import { lngToTileX, latToTileY } from '../../renderer/mercator'
import { createDebug } from '../../debug'

const debug = createDebug('IconLayer', false)

// --- Shaders ---

const iconVert = `
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

const iconFrag = `
precision mediump float;

uniform sampler2D u_texture;
uniform float u_opacity;

varying vec2 v_uv;

void main() {
  gl_FragColor = texture2D(u_texture, v_uv) * u_opacity;
}
`

// --- Layer ---

export interface IconLayerOptions {
  /** Source ID used to look up tile URLs from TileManager. */
  source: string
  /** MVT source-layer name inside the PBF. */
  sourceLayer: string
  /** Feature property name whose value is a sprite icon name. */
  iconField: string
  /** ImageManager instance (shared or dedicated). */
  images: ImageManager
  /** Opacity in [0, 1]. Default 1. */
  opacity?: number
}

type TileBuffers = {
  verts: WebGLBuffer
  idx: WebGLBuffer
  count: number
}

let _instanceCounter = 0

export class IconLayer implements PlacementParticipant {
  readonly type = 'icon' as const
  private readonly _instanceId = ++_instanceCounter

  static programs: ProgramDefinition[] = [
    { name: 'icon', vertex: iconVert, fragment: iconFrag },
  ]

  readonly source: string
  readonly sourceLayer: string
  readonly iconField: string
  readonly opacity: number

  readonly workerService: IconWorkerService

  private _images: ImageManager
  private _workerService: IconWorkerService
  /** GPU-uploaded tile buckets (null = empty tile, missing = not yet ready) */
  private _tileBuffers = new globalThis.Map<string, TileBuffers | null>()
  /** Fetched-but-not-yet-GPU-uploaded buckets, queued for upload on next draw() */
  private _pendingUploads = new globalThis.Map<string, IconTileData>()
  /** Keys currently being fetched from the worker */
  private _fetchingKeys = new globalThis.Set<string>()
  private _atlasTexture: WebGLTexture | null = null
  private _atlasWidth = 1
  private _atlasHeight = 1
  private _imagesReady = false
  private _webgl!: Required<Pick<RendererAPI, 'createGeometryBuffer' | 'destroyGeometryBuffers'>>
  private _gl!: WebGLRenderingContext
  private _tileOpacity = new globalThis.Map<string, Float32Array>()
  /** Cached anchor positions (tile-local coords) for synchronous getSymbolBuckets() */
  private _anchorCache = new globalThis.Map<string, { x: number; y: number }[]>()
  /** Renderer reference for accessing camera state */
  private _renderer: RendererAPI | null = null
  /** Schedule a re-render — wired to FrameLoop.markDirty() in onAdd() */
  private _markDirty: (() => void) | null = null

  constructor(options: IconLayerOptions) {
    this.source = options.source
    this.sourceLayer = options.sourceLayer
    this.iconField = options.iconField
    this._images = options.images
    this.opacity = options.opacity ?? 1
    this._workerService = new IconWorkerService()
    this.workerService = this._workerService
  }

  onAdd(renderer: RendererAPI): void {
    this._webgl = renderer as Required<Pick<RendererAPI, 'createGeometryBuffer' | 'destroyGeometryBuffers'>>
    this._gl = renderer.gl!
    this._renderer = renderer
    this._markDirty = () => renderer.markDirty?.()
    debug('onAdd: starting sprite load', { instanceId: this._instanceId })

    // Begin loading sprite; push metadata to worker once ready
    this._images.load((spriteData, atlas) => {
      debug('onAdd: sprite loaded', { instanceId: this._instanceId, entries: Object.keys(atlas.entries) })
      const gl = this._gl
      const tex = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.imageData)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      this._atlasTexture = tex
      this._atlasWidth = atlas.atlasWidth
      this._atlasHeight = atlas.atlasHeight

      const atlasEntries: { [name: string]: { atlasX: number; atlasY: number } } = {}
      for (const [name, entry] of Object.entries(atlas.entries)) {
        atlasEntries[name] = { atlasX: entry.atlasX, atlasY: entry.atlasY }
      }
      void this._workerService.updateImages(spriteData, atlasEntries)
      this._imagesReady = true
      debug('onAdd: imagesReady, calling markDirty')
      this._markDirty?.()
    })
  }

  evictTile(key: string): void {
    debug('evictTile', key)
    this._tileBuffers.delete(key)
    this._pendingUploads.delete(key)
    this._fetchingKeys.delete(key)
    this._tileOpacity.delete(key)
    this._anchorCache.delete(key)
    this._workerService.cancel(key)
  }

  // ---- PlacementParticipant ----

  getSymbolBuckets(): SymbolBucketData[] {
    if (!this._renderer) return []
    const camera: CameraState | null = this._renderer.camera ?? null
    if (!camera) return []
    const gl: WebGLRenderingContext = this._gl
    if (!gl) return []
    const canvas = gl.canvas as HTMLCanvasElement
    const { zoom } = camera
    const TILE_SIZE = 256
    const ICON_EXTENT = 8192
    const worldSize = TILE_SIZE * Math.pow(2, zoom)
    const cx = lngToTileX(camera.center.lng, zoom) * TILE_SIZE
    const cy = latToTileY(camera.center.lat, zoom) * TILE_SIZE
    const w = canvas.width
    const h = canvas.height
    const halfSize = 16

    const buckets: SymbolBucketData[] = []

    for (const [key, positions] of this._anchorCache) {
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
        const worldX = tileOriginX + (pos.x / ICON_EXTENT) * tileScale
        const worldY = tileOriginY + (pos.y / ICON_EXTENT) * tileScale
        const sx = (worldX - cx) + w / 2
        const sy = (worldY - cy) + h / 2

        anchors.push({ x: sx, y: sy })
        boxes.push([sx - halfSize, sy - halfSize, sx + halfSize, sy + halfSize])
      }

      buckets.push({ tileKey: key, anchors, boxes })
    }

    return buckets
  }

  setOpacity(tileKey: string, opacity: Float32Array): void {
    this._tileOpacity.set(tileKey, opacity)
  }

  private _startFetch(key: string, ctx: DrawContext): void {
    if (!this._imagesReady) {
      debug('_startFetch: images not ready, skipping', { key, instanceId: this._instanceId })
      return
    }
    this._fetchingKeys.add(key)
    debug('_startFetch', { key, hasTileData: ctx.tileData instanceof ArrayBuffer, tileDataType: typeof ctx.tileData })

    if (ctx.tileData instanceof ArrayBuffer) {
      debug('_startFetch: calling requestFromPbf', { key, byteLength: (ctx.tileData as ArrayBuffer).byteLength })
      this._workerService.requestFromPbf(key, ctx.tileData, this.sourceLayer, this.iconField)
    } else {
      debug('_startFetch: no tileData, cannot fetch', key)
    }

    const poll = async () => {
      const bucket = await this._workerService.getBucket(key)
      if (!this._fetchingKeys.has(key)) {
        debug('fetch cancelled (tile evicted)', key)
        return
      }
      this._fetchingKeys.delete(key)

      if (!bucket) {
        debug('getBucket: returned null (not in cache)', key)
        return
      }

      debug('getBucket: ready', { key, count: bucket.count, anchors: bucket.anchorPositions?.length })

      if (bucket.count === 0) {
        debug('getBucket: empty tile', key)
        this._tileBuffers.set(key, null)
        return
      }

      if (bucket.anchorPositions) {
        this._anchorCache.set(key, bucket.anchorPositions)
      }
      this._pendingUploads.set(key, bucket)
      this._markDirty?.()
    }

    void poll()
  }

  private _uploadBucket(key: string, bucket: IconTileData, gl: WebGLRenderingContext): void {
    debug('uploadBucket', { key, count: bucket.count })
    this._webgl.destroyGeometryBuffers(`tile:${key}:icon:`)
    const verts = this._webgl.createGeometryBuffer(`tile:${key}:icon:v`, new Int16Array(bucket.vertices), gl.ARRAY_BUFFER)
    const idx = this._webgl.createGeometryBuffer(`tile:${key}:icon:i`, new Uint16Array(bucket.indices), gl.ELEMENT_ARRAY_BUFFER)
    this._tileBuffers.set(key, { verts, idx, count: bucket.count })
  }

  draw(ctx: DrawContext): void {
    const { gl, programs, tileID } = ctx
    const key = tileID.key

    // Apply any pending GPU uploads from background fetches (synchronous GL)
    const pending = this._pendingUploads.get(key)
    if (pending) {
      this._pendingUploads.delete(key)
      this._uploadBucket(key, pending, gl)
    }

    if (!this._tileBuffers.has(key)) {
      if (!this._fetchingKeys.has(key)) {
        debug('draw: no buffer, starting fetch', key)
        this._startFetch(key, ctx)
      } else {
        debug('draw: waiting for fetch', key)
      }
      return
    }

    const bufs = this._tileBuffers.get(key)
    if (!bufs) {
      debug('draw: empty tile (null buffer)', key)
      return
    }

    // Placement: skip if all icons hidden
    const placementOpacity = this._tileOpacity.get(key)
    if (placementOpacity && placementOpacity.length > 0) {
      if (!placementOpacity.some(v => v > 0)) {
        debug('draw: all icons hidden by placement', key)
        return
      }
    }

    if (!this._atlasTexture) {
      debug('draw: no atlas texture yet', key)
      return
    }

    const program = programs.get('icon')
    if (!program) return

    debug('draw: rendering', { key, count: bufs.count })

    gl.useProgram(program)

    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.verts)

    const aAnchor = gl.getAttribLocation(program, 'a_anchor')
    gl.enableVertexAttribArray(aAnchor)
    gl.vertexAttribPointer(aAnchor, 2, gl.SHORT, false, 12, 0)

    const aOffset = gl.getAttribLocation(program, 'a_offset')
    gl.enableVertexAttribArray(aOffset)
    gl.vertexAttribPointer(aOffset, 2, gl.SHORT, false, 12, 4)

    const aTex = gl.getAttribLocation(program, 'a_tex')
    gl.enableVertexAttribArray(aTex)
    gl.vertexAttribPointer(aTex, 2, gl.UNSIGNED_SHORT, false, 12, 8)

    const canvas = gl.canvas as HTMLCanvasElement
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height)
    gl.uniform2f(gl.getUniformLocation(program, 'u_texsize'), this._atlasWidth, this._atlasHeight)
    gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), this.opacity)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this._atlasTexture)
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0)

    // Disable stencil: icons can extend across tile boundaries
    gl.disable(gl.STENCIL_TEST)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.idx)
    gl.drawElements(gl.TRIANGLES, bufs.count, gl.UNSIGNED_SHORT, 0)

    gl.disable(gl.BLEND)
    gl.enable(gl.STENCIL_TEST)

    gl.disableVertexAttribArray(aAnchor)
    gl.disableVertexAttribArray(aOffset)
    gl.disableVertexAttribArray(aTex)
  }

  destroy(): void {
    this._workerService.destroy()
    if (this._gl && this._atlasTexture) {
      this._gl.deleteTexture(this._atlasTexture)
    }
  }
}
