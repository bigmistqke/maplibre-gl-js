// src/mini/layers/raster.ts
import type { TileID, ProgramDefinition } from '../core/types.ts'
import type { TileService } from '../core/tile-service.ts'
import type { DrawContext } from '../core/render-extension.ts'
import type { RendererAPI } from '../core/renderer-api.ts'

// ──────────────────────────────────────────────
// GLSL shaders
// ──────────────────────────────────────────────

const rasterVert = `
attribute vec2 a_pos;
uniform mat4 u_matrix;
varying vec2 v_uv;
void main() {
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
  v_uv = a_pos;
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
      const buf = await fetch(url, { signal: controller.signal }).then(r => r.arrayBuffer())
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
  private _quadBuffer!: WebGLBuffer

  constructor(options: { source: string; opacity?: number }) {
    this.source = options.source
    this.opacity = options.opacity ?? 1
  }

  onAdd(renderer: RendererAPI): void {
    // Access the quad VBO from WebGLContext via duck-typing on the Renderer
    this._quadBuffer = (renderer as any)._webgl.quadBuffer
  }

  draw(ctx: RasterDrawContext): void {
    const { gl, programs, matrix, paint, tileTexture } = ctx
    const program = programs.get('raster')
    if (!program) return

    gl.useProgram(program)

    // Bind unit quad VBO
    gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuffer)
    const aPos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    // Set uniforms
    const uMatrix = gl.getUniformLocation(program, 'u_matrix')
    gl.uniformMatrix4fv(uMatrix, false, matrix)

    const uTexture = gl.getUniformLocation(program, 'u_texture')
    gl.uniform1i(uTexture, 0)

    const uOpacity = gl.getUniformLocation(program, 'u_opacity')
    const opacity = typeof paint['opacity'] === 'number' ? paint['opacity'] : this.opacity
    gl.uniform1f(uOpacity, opacity)

    // Bind texture
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tileTexture)

    // Draw the quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
}
