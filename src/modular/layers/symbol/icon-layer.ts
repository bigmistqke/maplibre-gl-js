import type { DrawContext } from '../../core/render-extension'
import type { RendererAPI } from '../../core/renderer-api'
import type { ProgramDefinition } from '../../core/types'
import type { TileID } from '../../core/types'
import { ImageManager } from './image-manager'
import { IconWorkerService } from './workers/icon-worker-service'
import type { IconTileData } from './icon-types'

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
  screen += (a_offset / 32.0) * 2.0 / u_resolution;
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
  texture: WebGLTexture
}

export class IconLayer {
  readonly type = 'icon' as const

  static programs: ProgramDefinition[] = [
    { name: 'icon', vertex: iconVert, fragment: iconFrag },
  ]

  readonly source: string
  readonly sourceLayer: string
  readonly iconField: string
  readonly opacity: number
  /**
   * The worker service created and owned by this layer.
   * Pass it to the source registration so the tile manager can use it as a tileService:
   *   map.addSource('my-source', { tileService: iconLayer.workerService })
   */
  readonly workerService: IconWorkerService

  private _images: ImageManager
  private _workerService: IconWorkerService
  private _tileBuffers = new globalThis.Map<string, TileBuffers>()
  private _atlasTexture: WebGLTexture | null = null
  private _atlasWidth = 1
  private _atlasHeight = 1
  private _webgl!: { createGeometryBuffer(key: string, data: ArrayBufferView, target: number): WebGLBuffer }
  private _gl!: WebGLRenderingContext

  constructor(options: IconLayerOptions) {
    this.source = options.source
    this.sourceLayer = options.sourceLayer
    this.iconField = options.iconField
    this._images = options.images
    this.opacity = options.opacity ?? 1
    // IconLayer creates and owns IconWorkerService, just like FillLayer creates VectorTileService
    this._workerService = new IconWorkerService()
    // Expose publicly so caller can: map.addSource('x', { tileService: iconLayer.workerService })
    this.workerService = this._workerService
  }

  onAdd(renderer: RendererAPI): void {
    this._webgl = (renderer as any)._webgl
    this._gl = (renderer as any)._gl

    // Begin loading sprite; push metadata to worker once ready
    this._images.load((spriteData, atlas) => {
      // Build the atlas texture on the GL context
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

      // Push sprite metadata to worker (stripped to what it needs)
      const atlasEntries: { [name: string]: { atlasX: number; atlasY: number } } = {}
      for (const [name, entry] of Object.entries(atlas.entries)) {
        atlasEntries[name] = { atlasX: entry.atlasX, atlasY: entry.atlasY }
      }
      void this._workerService.updateImages(spriteData, atlasEntries)
    })
  }

  evictTile(key: string): void {
    this._tileBuffers.delete(key)
  }

  draw(ctx: DrawContext): void {
    const { gl, programs, tileID } = ctx
    if (!this._atlasTexture) return

    const program = programs.get('icon')
    if (!program) return

    const key = tileID.key

    if (!this._tileBuffers.has(key)) {
      // Try to fetch from worker cache synchronously (getBucket is a Comlink promise —
      // we store the result once it arrives and skip rendering until then)
      void this._workerService.getBucket(key).then((bucket: IconTileData | null) => {
        if (!bucket || bucket.count === 0) return
        const vertBuf = this._webgl.createGeometryBuffer(
          `tile:${key}:icon:verts`,
          new Int16Array(bucket.vertices),
          gl.ARRAY_BUFFER,
        )
        const idxBuf = this._webgl.createGeometryBuffer(
          `tile:${key}:icon:idx`,
          new Uint16Array(bucket.indices),
          gl.ELEMENT_ARRAY_BUFFER,
        )
        this._tileBuffers.set(key, {
          verts: vertBuf,
          idx: idxBuf,
          count: bucket.count,
          texture: this._atlasTexture!,
        })
      })
      return
    }

    const bufs = this._tileBuffers.get(key)!
    if (bufs.count === 0) return

    gl.useProgram(program)

    // Bind vertex buffer and set attributes
    // Stride = 12 bytes: ax(int16) ay(int16) ox(int16) oy(int16) u(uint16) v(uint16)
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

    // Uniforms
    const canvas = gl.canvas as HTMLCanvasElement
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height)
    gl.uniform2f(gl.getUniformLocation(program, 'u_texsize'), this._atlasWidth, this._atlasHeight)
    gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), this.opacity)

    // Bind atlas texture to unit 0
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this._atlasTexture)
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0)

    // Enable alpha blending for icon transparency
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.idx)
    gl.drawElements(gl.TRIANGLES, bufs.count, gl.UNSIGNED_SHORT, 0)

    gl.disable(gl.BLEND)
  }
}
