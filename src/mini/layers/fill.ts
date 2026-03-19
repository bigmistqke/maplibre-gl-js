import type { TileID } from '../core/types'
import type { TileService } from '../core/tile-service'
import type { ProgramDefinition } from '../core/types'
import type { DrawContext } from '../core/render-extension'
import type { RendererAPI } from '../core/renderer-api'
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import earcut from 'earcut'

export class VectorTileService implements TileService {
  private _pending = new globalThis.Map<string, AbortController>()

  async request(tileID: TileID, url: string): Promise<Transferable[]> {
    const controller = new AbortController()
    this._pending.set(tileID.key, controller)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = await res.arrayBuffer()
      if (!this._pending.has(tileID.key)) return []
      this._pending.delete(tileID.key)
      return [buf]
    } catch {
      this._pending.delete(tileID.key)
      return []
    }
  }

  cancel(key: string): void {
    this._pending.get(key)?.abort()
    this._pending.delete(key)
  }

  destroy(): void {
    for (const c of this._pending.values()) c.abort()
    this._pending.clear()
  }
}

// GLSL
const fillVert = `
attribute vec2 a_pos;
uniform mat4 u_matrix;
void main() {
  gl_Position = u_matrix * vec4(a_pos / 4096.0, 0.0, 1.0);
}
`
const fillFrag = `
precision mediump float;
uniform vec4 u_color;
void main() { gl_FragColor = u_color; }
`

// Tessellation
interface Point { x: number; y: number }
export interface TessellationResult { vertices: Float32Array; indices: Uint16Array }

export function tessellatePolygon(rings: Point[][]): TessellationResult {
  const flat: number[] = []
  const holes: number[] = []
  let vi = 0
  for (let r = 0; r < rings.length; r++) {
    if (r > 0) holes.push(vi)
    for (const p of rings[r]) { flat.push(p.x, p.y); vi++ }
  }
  return {
    vertices: new Float32Array(flat),
    indices: new Uint16Array(earcut(flat, holes.length ? holes : undefined, 2)),
  }
}

function parseColor(c: string): [number, number, number, number] {
  const h = c.replace('#', '')
  if (h.length === 3) return [parseInt(h[0]+h[0],16)/255, parseInt(h[1]+h[1],16)/255, parseInt(h[2]+h[2],16)/255, 1]
  return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255, 1]
}

export interface FillLayerOptions {
  source: string
  sourceLayer: string
  color?: string
  opacity?: number
}

export class FillLayer {
  readonly type = 'fill' as const
  static programs: ProgramDefinition[] = [{ name: 'fill', vertex: fillVert, fragment: fillFrag }]
  static TileService = VectorTileService

  readonly source: string
  readonly sourceLayer: string
  readonly color: string
  readonly opacity: number

  private _tileBuffers = new globalThis.Map<string, { verts: WebGLBuffer; idx: WebGLBuffer; count: number }>()
  private _decoded = new globalThis.Set<string>()
  private _webgl!: { createGeometryBuffer(key: string, data: ArrayBufferView, target: number): WebGLBuffer }

  constructor(options: FillLayerOptions) {
    this.source = options.source
    this.sourceLayer = options.sourceLayer
    this.color = options.color ?? '#000000'
    this.opacity = options.opacity ?? 1
  }

  onAdd(renderer: RendererAPI): void {
    this._webgl = (renderer as any)._webgl
  }

  draw(ctx: DrawContext): void {
    const { gl, programs, matrix, paint, tileID, tileData } = ctx
    if (!tileData) return
    const program = programs.get('fill')
    if (!program) return

    const key = tileID.key
    if (!this._decoded.has(key)) {
      this._decoded.add(key)
      const tile = new VectorTile(new Pbf(tileData as ArrayBuffer))
      const layer = tile.layers[this.sourceLayer]
      if (!layer || layer.length === 0) return

      const allVerts: number[] = []
      const allIdx: number[] = []
      let vertOffset = 0

      for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i)
        if (feat.type !== 3) continue
        const { vertices, indices } = tessellatePolygon(feat.loadGeometry())
        for (const v of vertices) allVerts.push(v)
        for (const idx of indices) allIdx.push(idx + vertOffset)
        vertOffset += vertices.length / 2
      }

      if (allIdx.length === 0) return

      const vertBuf = this._webgl.createGeometryBuffer(`tile:${key}:fill:verts`, new Float32Array(allVerts), gl.ARRAY_BUFFER)
      const idxBuf = this._webgl.createGeometryBuffer(`tile:${key}:fill:idx`, new Uint16Array(allIdx), gl.ELEMENT_ARRAY_BUFFER)
      this._tileBuffers.set(key, { verts: vertBuf, idx: idxBuf, count: allIdx.length })
    }

    const bufs = this._tileBuffers.get(key)
    if (!bufs) return

    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.verts)
    const aPos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_matrix'), false, matrix)
    const [r, g, b, a] = parseColor((paint['fill-color'] as string | undefined) ?? this.color)
    gl.uniform4f(gl.getUniformLocation(program, 'u_color'), r, g, b, a * ((paint['fill-opacity'] as number | undefined) ?? this.opacity))
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.idx)
    gl.drawElements(gl.TRIANGLES, bufs.count, gl.UNSIGNED_SHORT, 0)
  }
}
