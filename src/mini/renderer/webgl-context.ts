import type { ProgramDefinition } from '../core/types.ts'
import type { ProgramCache } from '../core/render-extension.ts'

export class WebGLContext {
  readonly gl: WebGLRenderingContext
  private _programs = new globalThis.Map<string, WebGLProgram>()
  private _textures = new globalThis.Map<string, WebGLTexture>()
  private _geometryBuffers = new globalThis.Map<string, WebGLBuffer>()
  readonly quadBuffer: WebGLBuffer
  private _tileQuadBuffer: WebGLBuffer
  private _stencilProgram: WebGLProgram | null = null

  readonly programs: ProgramCache = {
    get: (name) => this._programs.get(name),
  }

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { antialias: true, stencil: true })
    if (!gl) throw new Error('WebGL not supported')
    gl.getExtension?.('OES_element_index_uint')
    this.gl = gl

    // Unit quad VBO — vertices covering [0,1]² as TRIANGLE_STRIP
    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)
    this.quadBuffer = buf

    // Tile quad VBO — MVT extent [0,4096]² as TRIANGLE_STRIP, used for stencil masks
    const tileQuadBuf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, tileQuadBuf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 4096, 0, 0, 4096, 4096, 4096]), gl.STATIC_DRAW)
    this._tileQuadBuffer = tileQuadBuf
  }

  /**
   * Write a unique stencil ID for the tile into the stencil buffer (MapLibre-style tile clipping).
   * Draws the tile quad ([0,4096]²) with ALWAYS+REPLACE — subsequent layer draws use EQUAL.
   * Call gl.stencilFunc(EQUAL, ref, 0xFF) + stencilMask(0x00) after this before drawing layers.
   */
  writeTileStencil(matrix: Float32Array, ref: number): void {
    const { gl } = this
    if (!this._stencilProgram) {
      this._stencilProgram = this._compile(
        /* glsl */`attribute vec2 a_pos; uniform mat4 u_matrix;
          void main() { gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0); }`,
        /* glsl */`precision mediump float; void main() { gl_FragColor = vec4(0.0); }`,
      )
    }
    gl.colorMask(false, false, false, false)
    gl.stencilFunc(gl.ALWAYS, ref, 0xFF)
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)
    gl.stencilMask(0xFF)
    gl.useProgram(this._stencilProgram)
    gl.bindBuffer(gl.ARRAY_BUFFER, this._tileQuadBuffer)
    const aPos = gl.getAttribLocation(this._stencilProgram, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    gl.uniformMatrix4fv(gl.getUniformLocation(this._stencilProgram, 'u_matrix'), false, matrix)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.colorMask(true, true, true, true)
    gl.stencilMask(0x00)
  }

  compilePrograms(defs: ProgramDefinition[]): void {
    for (const def of defs) {
      if (this._programs.has(def.name)) continue
      const program = this._compile(def.vertex, def.fragment)
      this._programs.set(def.name, program)
    }
  }

  getOrCreateTexture(key: string, bitmap: ImageBitmap): WebGLTexture {
    const cached = this._textures.get(key)
    if (cached) return cached

    const { gl } = this
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap as any)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this._textures.set(key, tex)
    return tex
  }

  destroyTexture(key: string): void {
    const tex = this._textures.get(key)
    if (!tex) return
    this.gl.deleteTexture(tex)
    this._textures.delete(key)
  }

  createGeometryBuffer(key: string, data: ArrayBufferView, target: number): WebGLBuffer {
    const cached = this._geometryBuffers.get(key)
    if (cached) return cached
    const { gl } = this
    const buf = gl.createBuffer()!
    gl.bindBuffer(target, buf)
    gl.bufferData(target, data, gl.STATIC_DRAW)
    this._geometryBuffers.set(key, buf)
    return buf
  }

  destroyGeometryBuffers(prefix: string): void {
    const { gl } = this
    for (const [key, buf] of this._geometryBuffers) {
      if (key.startsWith(prefix)) {
        gl.deleteBuffer(buf)
        this._geometryBuffers.delete(key)
      }
    }
  }

  private _compile(vertSrc: string, fragSrc: string): WebGLProgram {
    const { gl } = this
    const vert = this._compileShader(gl.VERTEX_SHADER, vertSrc)
    const frag = this._compileShader(gl.FRAGMENT_SHADER, fragSrc)
    const program = gl.createProgram()!
    gl.attachShader(program, vert)
    gl.attachShader(program, frag)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`)
    }
    return program
  }

  private _compileShader(type: number, src: string): WebGLShader {
    const { gl } = this
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`)
    }
    return shader
  }
}
