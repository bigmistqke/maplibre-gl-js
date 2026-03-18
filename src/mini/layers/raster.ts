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
  async process(
    _tileID: TileID,
    data: ArrayBuffer,
    _layerTypes: string[],
    signal: AbortSignal,
  ): Promise<Transferable[]> {
    const blob = new Blob([data])
    const bitmap = await createImageBitmap(blob)
    if (signal.aborted) {
      bitmap.close()
      return []
    }
    return [bitmap]
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
