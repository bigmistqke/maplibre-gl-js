// src/mini/layers/terrain/terrain-plugin.ts
import type { LngLat } from '../../core/types.ts'
import type { RendererInternals } from '../../core/surface.ts'
import type { MapGL } from '../../core/map.ts'
import type { WebGL2RendererAPI } from '../../core/renderer-api.ts'
import type { Plugin } from '../../core/map.ts'
import { RTTPool } from './rtt-pool.ts'
import { buildTerrainMesh } from './terrain-mesh.ts'
import { TERRAIN_VERT, TERRAIN_FRAG } from './terrain-shaders.ts'
// ELEVATION_PRELUDE defines projectTileWithElevation used by TERRAIN_VERT
import { ELEVATION_PRELUDE } from '../../renderer/flat-render-tiles.ts'

const FBO_SIZE = 512
const WORLD_TILE = { z: 0, x: 0, y: 0, key: '0/0/0' }

// Orthographic matrix mapping tile coords [0,4096]×[0,4096] → NDC [-1,1]×[-1,1].
// Used in Pass 1 so each tile fills its 512×512 FBO regardless of camera view.
// Column-major float32: sx=2/4096, sy=-2/4096, tx=-1, ty=1
const TILE_ORTHO_MATRIX = new Float32Array([
  2 / 4096, 0,         0, 0,
  0,        -2 / 4096, 0, 0,
  0,        0,         1, 0,
  -1,       1,         0, 1,
])

export interface TerrainPluginOptions {
  /** Source ID of the terrain-RGB raster DEM source. */
  source: string
  /** Height exaggeration multiplier. Default 1.0. */
  exaggeration?: number
}

export class TerrainPlugin implements Plugin<WebGL2RendererAPI> {
  readonly shaderDefines = ['#define TERRAIN3D']

  private _source: string
  private _exaggeration: number
  private _rttPool = new RTTPool()
  private _terrainProgram: WebGLProgram | null = null
  private _meshVert: WebGLBuffer | null = null
  private _meshIdx: WebGLBuffer | null = null
  private _meshIndexCount = 0
  private _gl: WebGL2RenderingContext | null = null  // set on first renderTiles call
  // Cached uniform locations (set once after _ensureProgram)
  private _uMapTexture: WebGLUniformLocation | null = null
  private _uDem: WebGLUniformLocation | null = null
  private _uExaggeration: WebGLUniformLocation | null = null
  private _uElevationScale: WebGLUniformLocation | null = null

  constructor(opts: TerrainPluginOptions) {
    this._source = opts.source
    this._exaggeration = opts.exaggeration ?? 1.0
  }

  // ElevationProvider — duck-typed by CameraController
  getElevation(_lngLat: LngLat): number {
    // Stub: returns 0 until DEM tile lookup is implemented.
    // Camera elevation clamping still works (just flat).
    return 0
  }

  // Surface — set on renderer via onAdd
  renderTiles(internals: RendererInternals): void {
    const { gl } = internals
    this._gl = gl  // store for destroy()

    this._ensureMesh(gl)
    this._ensureProgram(internals)

    const demManager = internals.tileManagers.get(this._source)
    if (!demManager) return

    // Evict FBOs for DEM tiles no longer retained — keyed by DEM source only
    this._rttPool.evict(demManager.getRetainedKeys())

    const demTiles = demManager.getReadyTiles()

    // ── Pass 1: RTT ──────────────────────────────────────────────────────────
    // Render all tile-based layers to per-tile FBOs. No stencil needed (one FBO = one tile).
    for (const { tileID } of demTiles) {
      const fbo = this._rttPool.getOrCreate(tileID.key, internals)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.framebuffer)
      gl.viewport(0, 0, FBO_SIZE, FBO_SIZE)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

      for (const [sourceId, tileManager] of internals.tileManagers) {
        if (sourceId === this._source) continue  // DEM source — not a visual layer
        const sourceLayers = internals.tileLayers.get(sourceId) ?? []
        const sourceType = internals.sourceTypes.get(sourceId) ?? 'raster'
        const readyTiles = tileManager.getReadyTiles()

        for (const { tileID: srcTileID, data } of readyTiles) {
          if (srcTileID.key !== tileID.key) continue  // only the matching tile

          const mesh = internals.projection.getMeshForTile(srcTileID)
          const meshBuffers = internals.getOrCreateMeshBuffers(srcTileID.key, mesh)

          let tileTexture: WebGLTexture | undefined
          if (sourceType === 'raster') {
            tileTexture = internals.getOrCreateTexture(srcTileID.key, data as ImageBitmap)
          }

          for (const layer of sourceLayers) {
            const paint = internals.evaluate(layer, internals.camera.zoom)
            const program = internals.programs.get((layer.constructor as any).programs?.[0]?.name)
            if (program) {
              gl.useProgram(program)
              // Tile-local ortho: maps [0,4096]×[0,4096] → NDC so the tile fills the FBO.
              // Camera-view projection would place tiles relative to the camera, not the FBO.
              gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_matrix'), false, TILE_ORTHO_MATRIX)
            }
            ;(layer as any).draw({
              gl,
              programs: internals.programs,
              tileID: srcTileID,
              meshBuffers,
              zoom: internals.camera.zoom,
              paint,
              frameIndex: internals.frameIndex,
              tileTexture,
              tileData: sourceType === 'vector' ? data : undefined,
              imageAtlas: {},
              lineDashAtlas: {},
            })
          }
        }
      }
    }

    // Restore default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, internals.viewport.width, internals.viewport.height)

    // ── Pass 2: Terrain mesh ─────────────────────────────────────────────────
    // Draw 3D terrain mesh per tile, draping FBO texture over DEM displacement.
    const prog = this._terrainProgram!
    gl.useProgram(prog)

    gl.enable(gl.STENCIL_TEST)
    gl.clear(gl.STENCIL_BUFFER_BIT)
    let nextRef = 1

    for (const { tileID, data: demData } of demTiles) {
      const fbo = this._rttPool.getOrCreate(tileID.key, internals)

      // Write stencil for this tile — must set u_matrix on stencil program first
      const mesh = internals.projection.getMeshForTile(tileID)
      const meshBuffers = internals.getOrCreateMeshBuffers(tileID.key, mesh)
      internals.projection.setTileUniforms(
        gl as any, internals.stencilProgram, tileID, internals.camera, internals.viewport,
      )
      internals.writeTileStencil(
        internals.stencilProgram, meshBuffers.vert, meshBuffers.idx, meshBuffers.indexCount, nextRef,
      )
      gl.stencilFunc(gl.EQUAL, nextRef, 0xFF)
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP)
      gl.stencilMask(0x00)
      nextRef++
      if (nextRef > 255) nextRef = 1

      // writeTileStencil binds the stencil program — re-bind terrain program before setting uniforms
      gl.useProgram(prog)
      internals.projection.setTileUniforms(gl as any, prog, tileID, internals.camera, internals.viewport)

      // u_map_texture = FBO color texture (rendered tile layers)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, fbo.texture)
      gl.uniform1i(this._uMapTexture, 0)

      // u_dem = DEM tile texture
      // Use key + ':dem' to avoid collision with visual raster tiles at same coordinates
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, internals.getOrCreateTexture(tileID.key + ':dem', demData as ImageBitmap))
      gl.uniform1i(this._uDem, 1)

      gl.uniform1f(this._uExaggeration, this._exaggeration)
      // u_elevation_scale: convert meters to tile units (rough mercator constant)
      gl.uniform1f(this._uElevationScale, 1.0 / 4096.0)

      // Draw terrain mesh (the 32x32 grid VBO, not the projection mesh)
      gl.bindBuffer(gl.ARRAY_BUFFER, this._meshVert!)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._meshIdx!)
      const aPos = gl.getAttribLocation(prog, 'a_pos')
      gl.enableVertexAttribArray(aPos)
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
      gl.drawElements(gl.TRIANGLES, this._meshIndexCount, gl.UNSIGNED_INT, 0)
    }

    gl.disable(gl.STENCIL_TEST)

    // ── Pass 3: Custom layers ────────────────────────────────────────────────
    if (internals.customLayers.length > 0) {
      for (const layer of internals.customLayers) {
        layer.render({
          gl: gl as any,
          camera: internals.camera,
          viewport: internals.viewport,
          vertexShaderPrelude: internals.projection.vertexShaderPrelude,
          setProjectionUniforms: (program: WebGLProgram) => {
            gl.useProgram(program)
            internals.projection.setTileUniforms(gl as any, program, WORLD_TILE, internals.camera, internals.viewport)
          },
        })
      }
    }
  }

  destroy(): void {
    // Free RTT FBOs — RTTPool.destroy() uses internally stored _destroyFn (no internals needed).
    this._rttPool.destroy()
    // Free mesh buffers and program if we have the gl context from a previous renderTiles call.
    if (this._gl) {
      if (this._meshVert) this._gl.deleteBuffer(this._meshVert)
      if (this._meshIdx) this._gl.deleteBuffer(this._meshIdx)
      if (this._terrainProgram) this._gl.deleteProgram(this._terrainProgram)
    }
    this._terrainProgram = null
    this._meshVert = null
    this._meshIdx = null
    this._gl = null
  }

  // Plugin<WebGL2RendererAPI> lifecycle
  onAdd(_map: MapGL<WebGL2RendererAPI>, renderer: WebGL2RendererAPI): void {
    // Runtime guard — spec requires a descriptive error if WebGL2 is unavailable.
    if (!renderer.__webgl2) {
      throw new Error(
        'TerrainPlugin requires a WebGL2 renderer. ' +
        'Create the renderer with { contextType: "webgl2" }.',
      )
    }
    renderer.setSurface(this)
  }

  private _ensureMesh(gl: WebGL2RenderingContext): void {
    if (this._meshVert) return
    const { vertices, indices } = buildTerrainMesh()

    const vert = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, vert)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

    const idx = gl.createBuffer()!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)

    this._meshVert = vert
    this._meshIdx = idx
    this._meshIndexCount = indices.length
  }

  private _ensureProgram(internals: RendererInternals): void {
    if (this._terrainProgram) return
    const { gl } = internals

    // Assemble prelude: shaderDefines + projection prelude + ELEVATION_PRELUDE.
    // ELEVATION_PRELUDE defines projectTileWithElevation which TERRAIN_VERT calls.
    // '#version 300 es' must be the FIRST line — prepend before everything.
    const prelude = this.shaderDefines.join('\n') + '\n' +
                    internals.projection.vertexShaderPrelude + '\n' +
                    ELEVATION_PRELUDE
    const vert = this._compileShader(gl, gl.VERTEX_SHADER, '#version 300 es\n' + prelude + '\n' + TERRAIN_VERT)
    const frag = this._compileShader(gl, gl.FRAGMENT_SHADER, '#version 300 es\n' + TERRAIN_FRAG)
    const prog = gl.createProgram()!
    gl.attachShader(prog, vert)
    gl.attachShader(prog, frag)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Terrain program link error: ${gl.getProgramInfoLog(prog)}`)
    }
    this._terrainProgram = prog
    // Cache uniform locations — querying per-frame is wasteful
    this._uMapTexture = gl.getUniformLocation(prog, 'u_map_texture')
    this._uDem = gl.getUniformLocation(prog, 'u_dem')
    this._uExaggeration = gl.getUniformLocation(prog, 'u_exaggeration')
    this._uElevationScale = gl.getUniformLocation(prog, 'u_elevation_scale')
  }

  private _compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Terrain shader compile error: ${gl.getShaderInfoLog(shader)}`)
    }
    return shader
  }
}
