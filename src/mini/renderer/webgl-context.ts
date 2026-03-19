import type { ProgramDefinition, TileMesh } from '../core/types.ts'
import type { ProgramCache } from '../core/render-extension.ts'

export class WebGLContext {
  readonly gl: WebGLRenderingContext
  private _textures = new globalThis.Map<string, WebGLTexture>()
  private _geometryBuffers = new globalThis.Map<string, WebGLBuffer>()
  private _meshBuffers = new globalThis.Map<string, { vert: WebGLBuffer; idx: WebGLBuffer; indexCount: number }>()
  readonly quadBuffer: WebGLBuffer

  constructor(canvas: HTMLCanvasElement, contextType: 'webgl' | 'webgl2' = 'webgl') {
    const gl = canvas.getContext(contextType, { antialias: true, stencil: true }) as WebGLRenderingContext
    if (!gl) throw new Error(`${contextType} not supported`)
    gl.getExtension?.('OES_element_index_uint')
    this.gl = gl

    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)
    this.quadBuffer = buf
  }

  /**
   * Compile programs with a projection vertex shader prelude prepended.
   * Returns a fresh ProgramCache — caller owns it (one per projection instance).
   */
  compilePrograms(defs: ProgramDefinition[], vertexPrelude = ''): ProgramCache {
    const map = new globalThis.Map<string, WebGLProgram>()
    for (const def of defs) {
      map.set(def.name, this._compile(vertexPrelude + '\n' + def.vertex, def.fragment))
    }
    return { get: (name) => map.get(name) }
  }

  /**
   * Compile the stencil mask shader with the given projection prelude.
   * Stencil vertex shader calls projectTile(a_pos) — defined by the prelude.
   */
  compileStencilProgram(vertexPrelude: string): WebGLProgram {
    const vert = vertexPrelude + '\n' +
      'attribute vec2 a_pos;\nvoid main() { gl_Position = projectTile(a_pos); }'
    const frag = 'precision mediump float; void main() { gl_FragColor = vec4(0.0); }'
    return this._compile(vert, frag)
  }

  /**
   * Write tile stencil mask using a projection-specific program and mesh.
   * setTileUniforms must be called on the program before this.
   */
  writeTileStencil(
    program: WebGLProgram,
    vertBuf: WebGLBuffer,
    idxBuf: WebGLBuffer,
    indexCount: number,
    ref: number,
  ): void {
    const { gl } = this
    gl.colorMask(false, false, false, false)
    gl.stencilFunc(gl.ALWAYS, ref, 0xFF)
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)
    gl.stencilMask(0xFF)
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBuf)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf)
    const aPos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0)
    gl.colorMask(true, true, true, true)
    gl.stencilMask(0x00)
  }

  getOrCreateMeshBuffers(
    key: string,
    mesh: TileMesh,
  ): { vert: WebGLBuffer; idx: WebGLBuffer; indexCount: number } {
    const cached = this._meshBuffers.get(key)
    if (cached) return cached
    const { gl } = this
    const vert = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, vert)
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW)
    const idx = gl.createBuffer()!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW)
    const entry = { vert, idx, indexCount: mesh.indices.length }
    this._meshBuffers.set(key, entry)
    return entry
  }

  destroyMeshBuffers(key: string): void {
    const entry = this._meshBuffers.get(key)
    if (!entry) return
    this.gl.deleteBuffer(entry.vert)
    this.gl.deleteBuffer(entry.idx)
    this._meshBuffers.delete(key)
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

  createFramebuffer(width: number, height: number): import('../core/surface.ts').FramebufferObject {
    const { gl } = this
    const texture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)

    const depth = gl.createRenderbuffer()!
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)

    const framebuffer = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    return { framebuffer, texture, depth }
  }

  destroyFramebuffer(fb: import('../core/surface.ts').FramebufferObject): void {
    const { gl } = this
    gl.deleteFramebuffer(fb.framebuffer)
    gl.deleteTexture(fb.texture)
    gl.deleteRenderbuffer(fb.depth)
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
