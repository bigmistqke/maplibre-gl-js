// src/modular/layers/symbol/text-layer.ts
import type { ProgramDefinition } from '../../core/types.ts'
import type { DrawContext } from '../../core/render-extension.ts'
import type { RendererAPI } from '../../core/renderer-api.ts'
import { GlyphManager } from './glyph-manager.ts'
import { TextWorkerService } from './workers/text-worker-service.ts'

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
  screen += (a_offset / 32.0) * 2.0 / u_resolution;
  gl_Position = vec4(screen * proj.w, proj.z, proj.w);
  v_uv = a_tex / u_texsize;
}
`

const sdfFrag = `
precision mediump float;
uniform sampler2D u_texture;
uniform vec4 u_color;
uniform float u_opacity;
varying vec2 v_uv;
void main() {
  float dist = texture2D(u_texture, v_uv).a;
  float gamma = 0.105;
  float edge = 0.75;
  float alpha = smoothstep(edge - gamma, edge + gamma, dist);
  gl_FragColor = u_color * alpha * u_opacity;
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

export class TextLayer {
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
  private _tileBuckets = new globalThis.Map<string, { verts: WebGLBuffer; idx: WebGLBuffer; count: number } | null>()
  private _webgl!: { createGeometryBuffer(key: string, data: ArrayBufferView, target: number): WebGLBuffer }
  private _gl!: WebGLRenderingContext

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

    // Wire glyph loading: GlyphManager already rebuilt atlas positions (CPU-side)
    // before firing this callback, so glyphPositions is up to date.
    // Push both the partial glyph map AND the fresh atlas positions to the worker.
    this._glyphs._onGlyphsLoaded = (partialMap, positions) => {
      this._workerService.updateGlyphs(partialMap, positions)
    }
  }

  evictTile(key: string): void {
    this._tileBuckets.delete(key)
    this._workerService.cancel(key)
  }

  /**
   * draw() ONLY fetches pre-built data from the worker, uploads it to GPU, and renders.
   * All shaping and quad generation has already happened inside the worker's request().
   */
  async draw(ctx: DrawContext): Promise<void> {
    const { gl, programs, tileID } = ctx
    const key = tileID.key

    if (!this._tileBuckets.has(key)) {
      // Ask the worker for the pre-built SymbolTileData (null = not ready yet or empty tile)
      const bucket = await this._workerService.getBucket(key)
      if (!bucket) {
        this._tileBuckets.set(key, null)
        return
      }
      // Upload vertex and index data to GPU
      this._glyphs.buildAtlas(gl)
      const verts = this._webgl.createGeometryBuffer(`tile:${key}:sym:v`, new Int16Array(bucket.vertices), gl.ARRAY_BUFFER)
      const idx = this._webgl.createGeometryBuffer(`tile:${key}:sym:i`, new Uint16Array(bucket.indices), gl.ELEMENT_ARRAY_BUFFER)
      this._tileBuckets.set(key, { verts, idx, count: bucket.count })
    }

    const bufs = this._tileBuckets.get(key)
    if (!bufs) return

    const program = programs.get('symbol_sdf')
    if (!program) return

    // Ensure atlas texture is up to date on GPU
    this._glyphs.buildAtlas(gl)
    if (!this._glyphs.glyphAtlasTexture) return

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

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.idx)
    gl.drawElements(gl.TRIANGLES, bufs.count, gl.UNSIGNED_SHORT, 0)

    // Cleanup
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
