import type { ProgramDefinition } from '../core/types.ts'
import type { ProgramCache } from '../core/render-extension.ts'

export class WebGLContext {
  readonly gl: WebGLRenderingContext
  private _programs = new globalThis.Map<string, WebGLProgram>()
  private _textures = new globalThis.Map<string, WebGLTexture>()
  readonly quadBuffer: WebGLBuffer

  readonly programs: ProgramCache = {
    get: (name) => this._programs.get(name),
  }

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl')
    if (!gl) throw new Error('WebGL not supported')
    this.gl = gl

    // Unit quad VBO — vertices covering [0,1]² as TRIANGLE_STRIP
    // [0,0, 1,0, 0,1, 1,1]
    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)
    this.quadBuffer = buf
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
