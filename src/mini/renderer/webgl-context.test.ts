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
  let gl: WebGLRenderingContext
  let canvas: { getContext: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    gl = makeGLMock()
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
