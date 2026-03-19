import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WebGLContext } from './webgl-context.ts'
import type { ProgramDefinition } from '../core/types.ts'

function makeGLMock() {
  const programs = new Map<WebGLProgram, boolean>()
  const shaders = new Map<WebGLShader, boolean>()

  const gl = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    LINK_STATUS: 35714,
    COMPILE_STATUS: 35713,
    COLOR_BUFFER_BIT: 16384,
    createProgram: vi.fn(() => ({ _prog: true } as any)),
    createShader: vi.fn(() => ({ _shader: true } as any)),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getShaderParameter: vi.fn().mockReturnValue(true),
    getProgramParameter: vi.fn().mockReturnValue(true),
    getProgramInfoLog: vi.fn().mockReturnValue(''),
    getShaderInfoLog: vi.fn().mockReturnValue(''),
  } as unknown as WebGLRenderingContext
  return gl
}

describe('WebGLContext', () => {
  let gl: any
  let canvas: { getContext: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    const base = makeGLMock()
    gl = Object.assign(base, {
      createBuffer: vi.fn().mockReturnValue({ _buf: true }),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
    })
    canvas = { getContext: vi.fn().mockReturnValue(gl) }
  })

  it('calls canvas.getContext("webgl")', () => {
    new WebGLContext(canvas as any)
    expect(canvas.getContext).toHaveBeenCalledWith('webgl')
  })

  it('throws if WebGL is not supported', () => {
    canvas.getContext.mockReturnValue(null)
    expect(() => new WebGLContext(canvas as any)).toThrow('WebGL not supported')
  })

  it('compilePrograms with empty list succeeds', () => {
    const ctx = new WebGLContext(canvas as any)
    expect(() => ctx.compilePrograms([])).not.toThrow()
  })

  it('compilePrograms makes programs accessible by name', () => {
    const ctx = new WebGLContext(canvas as any)
    const defs: ProgramDefinition[] = [
      { name: 'test-prog', vertex: 'void main(){}', fragment: 'void main(){}' },
    ]
    ctx.compilePrograms(defs)
    expect(ctx.programs.get('test-prog')).toBeDefined()
  })

  it('programs.get returns undefined for unknown program', () => {
    const ctx = new WebGLContext(canvas as any)
    expect(ctx.programs.get('nonexistent')).toBeUndefined()
  })
})

describe('WebGLContext — Phase 2 additions', () => {
  let gl: ReturnType<typeof makeGLMock> & {
    createBuffer: ReturnType<typeof vi.fn>
    bindBuffer: ReturnType<typeof vi.fn>
    bufferData: ReturnType<typeof vi.fn>
    createTexture: ReturnType<typeof vi.fn>
    bindTexture: ReturnType<typeof vi.fn>
    texImage2D: ReturnType<typeof vi.fn>
    texParameteri: ReturnType<typeof vi.fn>
    generateMipmap: ReturnType<typeof vi.fn>
    ARRAY_BUFFER: number
    STATIC_DRAW: number
    FLOAT: number
    TEXTURE_2D: number
    TEXTURE0: number
    UNSIGNED_BYTE: number
    RGBA: number
    LINEAR: number
    CLAMP_TO_EDGE: number
    TEXTURE_MIN_FILTER: number
    TEXTURE_MAG_FILTER: number
    TEXTURE_WRAP_S: number
    TEXTURE_WRAP_T: number
  }
  let canvas: { getContext: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    const base = makeGLMock()
    gl = Object.assign(base, {
      createBuffer: vi.fn().mockReturnValue({ _buf: true }),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      createTexture: vi.fn().mockReturnValue({ _tex: true }),
      bindTexture: vi.fn(),
      texImage2D: vi.fn(),
      texParameteri: vi.fn(),
      generateMipmap: vi.fn(),
      deleteTexture: vi.fn(),
      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
      FLOAT: 5126,
      TEXTURE_2D: 3553,
      TEXTURE0: 33984,
      UNSIGNED_BYTE: 5121,
      RGBA: 6408,
      LINEAR: 9729,
      CLAMP_TO_EDGE: 33071,
      TEXTURE_MIN_FILTER: 10241,
      TEXTURE_MAG_FILTER: 10240,
      TEXTURE_WRAP_S: 10242,
      TEXTURE_WRAP_T: 10243,
    }) as any
    canvas = { getContext: vi.fn().mockReturnValue(gl) }
  })

  it('quadBuffer is defined after construction', () => {
    const ctx = new WebGLContext(canvas as any)
    expect(ctx.quadBuffer).toBeDefined()
    expect(gl.createBuffer).toHaveBeenCalled()
    expect(gl.bufferData).toHaveBeenCalled()
  })

  it('getOrCreateTexture returns a WebGLTexture', () => {
    const ctx = new WebGLContext(canvas as any)
    const bitmap = {} as ImageBitmap
    const tex = ctx.getOrCreateTexture('10/512/341', bitmap)
    expect(tex).toBeDefined()
  })

  it('getOrCreateTexture called twice with same key returns same texture object', () => {
    const ctx = new WebGLContext(canvas as any)
    const bitmap = {} as ImageBitmap
    const tex1 = ctx.getOrCreateTexture('10/512/341', bitmap)
    const tex2 = ctx.getOrCreateTexture('10/512/341', bitmap)
    expect(tex1).toBe(tex2)
  })

  it('getOrCreateTexture calls gl.texImage2D only on first call for a key', () => {
    const ctx = new WebGLContext(canvas as any)
    const bitmap = {} as ImageBitmap
    ctx.getOrCreateTexture('10/512/341', bitmap)
    const callsAfterFirst = gl.texImage2D.mock.calls.length
    ctx.getOrCreateTexture('10/512/341', bitmap)
    expect(gl.texImage2D.mock.calls.length).toBe(callsAfterFirst)
  })

  it('getOrCreateTexture creates different textures for different keys', () => {
    const ctx = new WebGLContext(canvas as any)
    const bitmap = {} as ImageBitmap
    // Reset mock to return distinct objects for each createTexture call
    gl.createTexture
      .mockReturnValueOnce({ _tex: 'A' })
      .mockReturnValueOnce({ _tex: 'B' })
    const tex1 = ctx.getOrCreateTexture('10/512/341', bitmap)
    const tex2 = ctx.getOrCreateTexture('10/512/342', bitmap)
    expect(tex1).not.toBe(tex2)
  })

  it('destroyTexture calls gl.deleteTexture and removes the texture from cache', () => {
    const ctx = new WebGLContext(canvas as any)
    const bitmap = {} as ImageBitmap
    const tex = ctx.getOrCreateTexture('10/1/2', bitmap)

    ctx.destroyTexture('10/1/2')

    expect(gl.deleteTexture).toHaveBeenCalledWith(tex)
    // After destroy, a second getOrCreateTexture call re-uploads (calls texImage2D again)
    gl.texImage2D.mockClear()
    ctx.getOrCreateTexture('10/1/2', bitmap)
    expect(gl.texImage2D).toHaveBeenCalledOnce()
  })

  it('destroyTexture is a no-op for unknown keys', () => {
    const ctx = new WebGLContext(canvas as any)
    expect(() => ctx.destroyTexture('nonexistent')).not.toThrow()
    expect(gl.deleteTexture).not.toHaveBeenCalled()
  })
})

describe('WebGLContext — geometry buffers', () => {
  let gl: any
  let canvas: { getContext: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    const base = makeGLMock()
    gl = Object.assign(base, {
      createBuffer: vi.fn().mockReturnValue({ _buf: true }),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      deleteBuffer: vi.fn(),
      ARRAY_BUFFER: 34962,
      ELEMENT_ARRAY_BUFFER: 34963,
      STATIC_DRAW: 35044,
    }) as any
    canvas = { getContext: vi.fn().mockReturnValue(gl) }
  })

  it('createGeometryBuffer returns a WebGLBuffer', () => {
    const ctx = new WebGLContext(canvas as any)
    const buf = ctx.createGeometryBuffer('tile:10/1/2:fill:verts', new Float32Array([0, 0, 1, 0, 0.5, 1]), gl.ARRAY_BUFFER)
    expect(buf).toBeDefined()
    expect(gl.createBuffer).toHaveBeenCalled()
    expect(gl.bufferData).toHaveBeenCalled()
  })

  it('createGeometryBuffer returns same buffer for same key', () => {
    const ctx = new WebGLContext(canvas as any)
    const data = new Float32Array([0, 0, 1, 0])
    const b1 = ctx.createGeometryBuffer('key1', data, gl.ARRAY_BUFFER)
    const b2 = ctx.createGeometryBuffer('key1', data, gl.ARRAY_BUFFER)
    expect(b1).toBe(b2)
  })

  it('destroyGeometryBuffers removes all buffers with matching prefix', () => {
    const ctx = new WebGLContext(canvas as any)
    const data = new Float32Array([0, 0, 1, 0])
    ctx.createGeometryBuffer('tile:10/1/2:fill:verts', data, gl.ARRAY_BUFFER)
    ctx.createGeometryBuffer('tile:10/1/2:fill:idx', data, gl.ARRAY_BUFFER)
    ctx.createGeometryBuffer('tile:10/5/5:fill:verts', data, gl.ARRAY_BUFFER)
    ctx.destroyGeometryBuffers('tile:10/1/2')
    expect(gl.deleteBuffer).toHaveBeenCalledTimes(2)
  })

  it('destroyGeometryBuffers is a no-op for unknown prefix', () => {
    const ctx = new WebGLContext(canvas as any)
    expect(() => ctx.destroyGeometryBuffers('nonexistent')).not.toThrow()
    expect(gl.deleteBuffer).not.toHaveBeenCalled()
  })
})
