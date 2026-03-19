// src/mini/layers/line.ts
import type { ProgramDefinition } from '../core/types.ts'
import type { DrawContext } from '../core/render-extension.ts'
import type { RendererAPI } from '../core/renderer-api.ts'
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'

const lineVert = `
attribute vec2 a_pos;
uniform mat4 u_matrix;
void main() { gl_Position = u_matrix * vec4(a_pos / 4096.0, 0.0, 1.0); }
`
const lineFrag = `
precision mediump float;
uniform vec4 u_color;
void main() { gl_FragColor = u_color; }
`

function parseColor(c: string): [number, number, number, number] {
  const h = c.replace('#', '')
  if (h.length === 3) return [parseInt(h[0]+h[0],16)/255, parseInt(h[1]+h[1],16)/255, parseInt(h[2]+h[2],16)/255, 1]
  return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255, 1]
}

export interface LineLayerOptions { source: string; sourceLayer: string; color?: string; opacity?: number }

export class LineLayer {
  readonly type = 'line' as const
  static programs: ProgramDefinition[] = [{ name: 'line', vertex: lineVert, fragment: lineFrag }]

  readonly source: string
  readonly sourceLayer: string
  readonly color: string
  readonly opacity: number

  private _tileBuffers = new globalThis.Map<string, { verts: WebGLBuffer; count: number }>()
  private _webgl!: { createGeometryBuffer(key: string, data: ArrayBufferView, target: number): WebGLBuffer }

  constructor(options: LineLayerOptions) {
    this.source = options.source
    this.sourceLayer = options.sourceLayer
    this.color = options.color ?? '#000000'
    this.opacity = options.opacity ?? 1
  }

  onAdd(renderer: RendererAPI): void { this._webgl = (renderer as any)._webgl }

  evictTile(key: string): void {
    this._tileBuffers.delete(key)
  }

  draw(ctx: DrawContext): void {
    const { gl, programs, matrix, paint, tileID, tileData } = ctx
    if (!tileData) return
    const program = programs.get('line')
    if (!program) return

    const key = tileID.key
    if (!this._tileBuffers.has(key)) {
      const tile = new VectorTile(new Pbf(tileData as ArrayBuffer))
      const layer = tile.layers[this.sourceLayer]
      if (!layer || layer.length === 0) return

      const verts: number[] = []
      for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i)
        if (feat.type !== 2) continue
        for (const ring of feat.loadGeometry()) {
          for (let j = 0; j < ring.length - 1; j++) {
            verts.push(ring[j].x, ring[j].y, ring[j+1].x, ring[j+1].y)
          }
        }
      }
      if (verts.length === 0) return

      const vertBuf = this._webgl.createGeometryBuffer(`tile:${key}:line:verts`, new Float32Array(verts), gl.ARRAY_BUFFER)
      this._tileBuffers.set(key, { verts: vertBuf, count: verts.length / 2 })
    }

    const bufs = this._tileBuffers.get(key)
    if (!bufs) return

    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.verts)
    const aPos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_matrix'), false, matrix)
    const [r, g, b, a] = parseColor((paint['line-color'] as string | undefined) ?? this.color)
    gl.uniform4f(gl.getUniformLocation(program, 'u_color'), r, g, b, a * ((paint['line-opacity'] as number | undefined) ?? this.opacity))
    gl.drawArrays(gl.LINES, 0, bufs.count)
  }
}
