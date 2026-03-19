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
import { ELEVATION_PRELUDE, flatRenderTiles } from '../../renderer/flat-render-tiles.ts'
import { lngToTileX, latToTileY } from '../../renderer/mercator.ts'

const FBO_SIZE = 512
const WORLD_TILE = { z: 0, x: 0, y: 0, key: '0/0/0' }

/**
 * Compute an orthographic matrix that renders the portion of srcTile that covers
 * demTile into the entire FBO [-1,1]×[-1,1]. Returns null if srcTile doesn't cover demTile.
 *
 * For an exact match (same z/x/y), this is the standard tile-fill ortho.
 * For a parent tile (srcTile.z < demTile.z), the matrix crops to the sub-area.
 */
function tileOrthoMatrix(srcTileID: { z: number; x: number; y: number }, demTileID: { z: number; x: number; y: number }): Float32Array | null {
  const dz = demTileID.z - srcTileID.z
  if (dz < 0) return null  // src is finer than DEM — not handled
  const scale = 1 << dz   // 2^dz
  if ((demTileID.x >> dz) !== srcTileID.x || (demTileID.y >> dz) !== srcTileID.y) return null
  // Sub-tile position of demTile within srcTile
  const xi = demTileID.x - (srcTileID.x * scale)
  const yi = demTileID.y - (srcTileID.y * scale)
  // Scale and translate so the demTile sub-area of srcTile fills NDC [-1,1]
  const sx = (2 * scale) / 4096
  const sy = -(2 * scale) / 4096
  const tx = -1 - xi * 2
  const ty = 1 + yi * 2
  return new Float32Array([sx, 0, 0, 0,  0, sy, 0, 0,  0, 0, 1, 0,  tx, ty, 0, 1])
}

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

  constructor(opts: TerrainPluginOptions) {
    this._source = opts.source
    this._exaggeration = opts.exaggeration ?? 1.0
  }

  setExaggeration(value: number): void {
    this._exaggeration = value
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

    const allDemTiles = demManager.getReadyTiles()

    // Build a non-overlapping tile set matching MapLibre's coveringTiles() guarantee.
    // getReadyTiles() can return both a parent and its children for the same world area
    // (the retain set keeps fallbacks alongside freshly-loaded tiles). Overlapping terrain
    // meshes cause depth conflicts even with LEQUAL + painter's sort.
    //
    // Algorithm: iterate the ideal-zoom tile grid; use the exact tile if loaded, otherwise
    // walk up to the nearest loaded ancestor — same as MapLibre's coveringTiles() fallback logic.
    // A Map keyed by tile key prevents duplicate parents when multiple children share one.
    const idealZ = Math.floor(internals.camera.zoom)
    const tileMap = new Map(allDemTiles.map(t => [t.tileID.key, t]))
    const selected = new Map<string, typeof allDemTiles[0]>()
    for (const tileID of internals.projection.getVisibleTiles(internals.camera, internals.viewport)) {
      if (tileID.z !== idealZ) continue
      if (tileMap.has(tileID.key)) {
        selected.set(tileID.key, tileMap.get(tileID.key)!)
      } else {
        // Fallback: walk up to find the nearest loaded ancestor
        for (let pz = idealZ - 1; pz >= 0; pz--) {
          const dz = idealZ - pz
          const parentKey = `${pz}/${tileID.x >> dz}/${tileID.y >> dz}`
          if (tileMap.has(parentKey)) { selected.set(parentKey, tileMap.get(parentKey)!); break }
        }
      }
    }
    const demTiles = [...selected.values()]

    // Fall back to flat rendering while DEM tiles are still loading
    if (demTiles.length === 0) {
      flatRenderTiles(internals)
      return
    }

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
          // Accept exact match or ancestor tiles (src at lower zoom covering the DEM tile).
          const ortho = tileOrthoMatrix(srcTileID, tileID)
          if (!ortho) continue

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
              // Tile-local ortho: maps the srcTile's sub-area that covers demTile → NDC [-1,1].
              gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_matrix'), false, ortho)
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
    // No stencil — the elevated terrain mesh doesn't match a flat stencil quad at pitch>0.
    //
    // Painter's algorithm (back-to-front) — matches MapLibre's LEQUAL+depth approach.
    // At pitch, tiles from different rows project to overlapping screen positions, so we must
    // render further tiles first so that closer tiles correctly overwrite them with LEQUAL.
    // MapLibre doesn't need an explicit sort at typical exaggeration (1x–2x) because overlap
    // is small; at higher exaggeration we must sort explicitly.
    // Depth along the view direction in tile space: dot((tile_center − cam_center), forward_tile)
    // where forward_tile = (sin(bearing), −cos(bearing)) — bearing 0 = north = −y in tile space.
    // Painter's sort: further tiles first so closer tiles overwrite with ALWAYS depth func.
    // Normalise all tile centres to zoom-0 space so coarse+fine tiles compare correctly.
    const { center, bearing: brg = 0 } = internals.camera
    const camNx = lngToTileX(center.lng, 0)
    const camNy = latToTileY(center.lat, 0)
    const brgRad = brg * Math.PI / 180
    const sinB = Math.sin(brgRad), cosB = Math.cos(brgRad)
    const sortedDemTiles = [...demTiles].sort((a, b) => {
      const nxA = (a.tileID.x + 0.5) / Math.pow(2, a.tileID.z)
      const nyA = (a.tileID.y + 0.5) / Math.pow(2, a.tileID.z)
      const nxB = (b.tileID.x + 0.5) / Math.pow(2, b.tileID.z)
      const nyB = (b.tileID.y + 0.5) / Math.pow(2, b.tileID.z)
      const depA = (nxA - camNx) * sinB - (nyA - camNy) * cosB
      const depB = (nxB - camNx) * sinB - (nyB - camNy) * cosB
      return depB - depA  // descending: further tiles first
    })

    const prog = this._terrainProgram!
    gl.useProgram(prog)

    // Depth setup — matches MapLibre's getDepthModeFor3D() + painter.depthRangeFor3D.
    // depthEpsilon and numSublayers copied verbatim from painter.ts (lines 127-128).
    const numSublayers = 1
    const depthEpsilon = 1 / Math.pow(2, 16)
    const numLayers = internals.tileLayers.size
    const maxDepth = 1 - ((numLayers + 2) * numSublayers * depthEpsilon)
    gl.enable(gl.DEPTH_TEST)
    // ALWAYS not LEQUAL: back-face culling (below) handles intra-tile self-occlusion on steep
    // slopes; LEQUAL causes adjacent mesh rows to z-fight at high pitch+exaggeration (their
    // projected depths are nearly equal). Inter-tile ordering is handled by painter's sort above.
    gl.depthFunc(gl.ALWAYS)
    gl.depthRange(0, maxDepth)
    gl.clear(gl.DEPTH_BUFFER_BIT)

    // Back-face culling — matches MapLibre's CullFaceMode.backCCW (cull_face_mode.ts line 33).
    // Eliminates back-facing triangles on far side of mountains at high pitch, preventing z-fighting.
    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.BACK)
    gl.frontFace(gl.CCW)

    const aPos = gl.getAttribLocation(prog, 'a_pos')
    gl.bindBuffer(gl.ARRAY_BUFFER, this._meshVert!)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._meshIdx!)
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    for (const { tileID, data: demData } of sortedDemTiles) {
      const fbo = this._rttPool.getOrCreate(tileID.key, internals)

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

      gl.drawElements(gl.TRIANGLES, this._meshIndexCount, gl.UNSIGNED_INT, 0)
    }

    gl.disable(gl.CULL_FACE)
    gl.depthFunc(gl.LESS)  // restore default
    gl.depthRange(0, 1)
    gl.disable(gl.DEPTH_TEST)

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
