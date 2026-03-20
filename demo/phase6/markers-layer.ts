import type { CustomLayer, CustomLayerRenderArgs } from '../../src/modular/renderer/index.ts'

// ── GLSL ─────────────────────────────────────────────────────────────────────

const VERT = `
attribute vec2 a_pos;     // mercator position * 4096 (full-world tile space)
attribute vec2 a_corner;  // quad corner: (-0.5, -0.5) to (0.5, 0.5)
attribute float a_size;   // diameter in pixels

uniform vec2 u_viewport;

varying vec2 v_corner;
varying vec4 v_color;

void main() {
  vec4 clip = projectTile(a_pos);
  // Screen-space billboard offset
  vec2 offset = a_corner * a_size * clip.w / u_viewport;
  gl_Position = vec4(clip.xy + offset, clip.zw);
  v_corner = a_corner;
  v_color = vec4(0.0, 1.0, 0.51, 1.0); // #00ff83
}
`

const FRAG = `
precision mediump float;
varying vec2 v_corner;
varying vec4 v_color;

void main() {
  float dist = dot(v_corner, v_corner);
  if (dist > 0.25) discard;
  float alpha = 1.0 - smoothstep(0.20, 0.25, dist);
  gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
}
`

// ── helpers ───────────────────────────────────────────────────────────────────

const EXTENT = 4096

function lngToMercatorX(lng: number): number {
  return (lng + 180) / 360
}

function latToMercatorY(lat: number): number {
  const rad = (lat * Math.PI) / 180
  return (1 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / Math.PI) / 2
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) ?? 'shader error')
  return s
}

function createProgram(gl: WebGLRenderingContext, vert: string, frag: string): WebGLProgram {
  const p = gl.createProgram()!
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vert))
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, frag))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p) ?? 'link error')
  return p
}

// ── MarkersLayer ──────────────────────────────────────────────────────────────

export interface Marker {
  lng: number
  lat: number
  size: number
}

export class MarkersLayer implements CustomLayer {
  readonly id: string
  readonly type = 'custom' as const

  private _markers: Marker[]
  private _gl: WebGLRenderingContext | null = null
  private _program: WebGLProgram | null = null
  private _posBuf: WebGLBuffer | null = null
  private _cornerBuf: WebGLBuffer | null = null
  private _sizeBuf: WebGLBuffer | null = null
  private _idxBuf: WebGLBuffer | null = null
  private _ext: ANGLE_instanced_arrays | null = null

  constructor(id: string, markers: Marker[]) {
    this.id = id
    this._markers = markers
  }

  onAdd(gl: WebGLRenderingContext, vertexShaderPrelude: string): void {
    this._gl = gl
    this._program = createProgram(gl, vertexShaderPrelude + '\n' + VERT, FRAG)

    const ext = gl.getExtension('ANGLE_instanced_arrays')
    if (!ext) throw new Error('ANGLE_instanced_arrays not supported')
    this._ext = ext

    // Per-instance: [mercX * EXTENT, mercY * EXTENT, size]
    const count = this._markers.length
    const pos = new Float32Array(count * 2)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const m = this._markers[i]
      pos[i * 2]     = lngToMercatorX(m.lng) * EXTENT
      pos[i * 2 + 1] = latToMercatorY(m.lat) * EXTENT
      sizes[i] = m.size
    }

    this._posBuf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuf)
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW)

    this._sizeBuf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this._sizeBuf)
    gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW)

    // Per-vertex quad corners (shared)
    this._cornerBuf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this._cornerBuf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -0.5, -0.5,
       0.5, -0.5,
       0.5,  0.5,
      -0.5,  0.5,
    ]), gl.STATIC_DRAW)

    this._idxBuf = gl.createBuffer()!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._idxBuf)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW)
  }

  onRemove(gl: WebGLRenderingContext): void {
    if (this._program) gl.deleteProgram(this._program)
    for (const buf of [this._posBuf, this._cornerBuf, this._sizeBuf, this._idxBuf]) {
      if (buf) gl.deleteBuffer(buf)
    }
  }

  render({ gl, viewport, setProjectionUniforms }: CustomLayerRenderArgs): void {
    const { _program: program, _ext: ext } = this
    if (!program || !ext) return

    setProjectionUniforms(program)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    gl.uniform2f(gl.getUniformLocation(program, 'u_viewport'), viewport.width, viewport.height)

    // a_corner — per-vertex, divisor 0
    gl.bindBuffer(gl.ARRAY_BUFFER, this._cornerBuf)
    const aCorner = gl.getAttribLocation(program, 'a_corner')
    gl.enableVertexAttribArray(aCorner)
    gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0)
    ext.vertexAttribDivisorANGLE(aCorner, 0)

    // a_pos — per-instance, divisor 1
    gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuf)
    const aPos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    ext.vertexAttribDivisorANGLE(aPos, 1)

    // a_size — per-instance, divisor 1
    gl.bindBuffer(gl.ARRAY_BUFFER, this._sizeBuf)
    const aSize = gl.getAttribLocation(program, 'a_size')
    gl.enableVertexAttribArray(aSize)
    gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, 0, 0)
    ext.vertexAttribDivisorANGLE(aSize, 1)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._idxBuf)
    ext.drawElementsInstancedANGLE(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, this._markers.length)

    // Reset divisors
    ext.vertexAttribDivisorANGLE(aPos, 0)
    ext.vertexAttribDivisorANGLE(aSize, 0)
  }
}
