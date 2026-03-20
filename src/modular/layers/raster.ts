// src/modular/layers/raster.ts
import type { TileID, ProgramDefinition } from '../core/types.ts'
import type { TileService } from '../core/tile-service.ts'
import type { DrawContext } from '../core/render-extension.ts'

// ──────────────────────────────────────────────
// GLSL shaders
// ──────────────────────────────────────────────

const rasterVert = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  gl_Position = projectTile(a_pos);
  v_uv = a_pos / 4096.0;
}
`

const rasterFrag = `
precision mediump float;
uniform sampler2D u_texture;
uniform float u_opacity;
varying vec2 v_uv;
void main() {
  gl_FragColor = texture2D(u_texture, v_uv) * u_opacity;
}
`

// ──────────────────────────────────────────────
// RasterTileService
// ──────────────────────────────────────────────

export class RasterTileService implements TileService {
  private _pending = new globalThis.Map<string, AbortController>()

  async request(tileID: TileID, url: string): Promise<Transferable[]> {
    const controller = new AbortController()
    this._pending.set(tileID.key, controller)
    try {
      const buf = await fetch(url, { signal: controller.signal }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.arrayBuffer()
      })
      const bitmap = await createImageBitmap(new Blob([buf]))
      if (!this._pending.has(tileID.key)) {
        // Cancelled between fetch completing and createImageBitmap completing
        bitmap.close()
        return []
      }
      this._pending.delete(tileID.key)
      return [bitmap]
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
    for (const controller of this._pending.values()) controller.abort()
    this._pending.clear()
  }
}

// ──────────────────────────────────────────────
// RasterLayer
// ──────────────────────────────────────────────

export interface RasterDrawContext extends DrawContext {
  tileTexture: WebGLTexture
}

export class RasterLayer {
  readonly type = 'raster'
  static programs: ProgramDefinition[] = [
    { name: 'raster', vertex: rasterVert, fragment: rasterFrag },
  ]
  static TileService = RasterTileService

  readonly source: string
  readonly opacity: number

  constructor(options: { source: string; opacity?: number }) {
    this.source = options.source
    this.opacity = options.opacity ?? 1
  }

  draw(ctx: RasterDrawContext): void {
    const { gl, programs, meshBuffers, paint, tileTexture } = ctx
    if (!tileTexture) return
    const program = programs.get('raster')
    if (!program) return

    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffers.vert)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshBuffers.idx)
    const aPos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    // projection uniforms already set by renderer before draw()
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0)
    const opacity = typeof paint['opacity'] === 'number' ? paint['opacity'] : this.opacity
    gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), opacity)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tileTexture)
    gl.drawElements(gl.TRIANGLES, meshBuffers.indexCount, gl.UNSIGNED_SHORT, 0)
  }
}
