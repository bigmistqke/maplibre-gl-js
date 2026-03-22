// src/modular/renderer/flat-render-tiles.ts
import type { RendererInternals, MeshBuffers } from '@modular/core/surface.ts'
import type { LayerInstance } from '@modular/core/renderer-api.ts'
import type { TileID } from '@modular/core/types.ts'

export const ELEVATION_PRELUDE = /* glsl */`
#ifndef PROJECT_TILE_WITH_ELEVATION_DEFINED
// elevation is in metres; u_matrix Z-scale converts metres → world pixels.
vec4 projectTileWithElevation(vec2 posInTile, float elevation) {
#ifdef TERRAIN3D
  return u_matrix * vec4(posInTile, elevation, 1.0);
#else
  return u_matrix * vec4(posInTile, 0.0, 1.0);
#endif
}
#endif
`

export function flatRenderTiles(internals: RendererInternals): void {
  const { gl, camera, viewport, projection, programs, stencilProgram,
          layers, tileLayers, tileManagers, sourceTypes, customLayers,
          evaluate, frameIndex } = internals

  gl.enable(gl.STENCIL_TEST)
  gl.clear(gl.STENCIL_BUFFER_BIT)
  let nextStencilRef = 1

  // Symbol layers (text, icons) disable stencil and can extend across tile boundaries.
  // They must be drawn AFTER all opaque layers for ALL tiles to avoid being overdrawn.
  type DeferredDraw = { layer: LayerInstance; tileID: TileID; meshBuffers: MeshBuffers; data: unknown; sourceType: string }
  const deferredSymbols: DeferredDraw[] = []

  for (const [sourceId, tileManager] of tileManagers) {
    const sourceLayers = tileLayers.get(sourceId) ?? []
    if (sourceLayers.length === 0) continue  // no visual layers (e.g. DEM-only source)
    const readyTiles = tileManager.getReadyTiles()
    const sourceType = sourceTypes.get(sourceId) ?? 'raster'

    // Split layers: opaque (fill, line, raster) vs symbol (text, icons)
    const isSymbolLayer = (l: LayerInstance) => l.type === 'symbol' || l.type === 'text' || 'getSymbolBuckets' in l
    const opaqueLayers = sourceLayers.filter(l => !isSymbolLayer(l))
    const symbolLayers = sourceLayers.filter(l => isSymbolLayer(l))

    for (const { tileID, data = undefined } of readyTiles) {
      const mesh = projection.getMeshForTile(tileID)
      const meshBuffers = internals.getOrCreateMeshBuffers(tileID.key, mesh)

      const ref = nextStencilRef++
      if (nextStencilRef > 255) nextStencilRef = 1

      // Phase 1: write stencil mask
      gl.useProgram(stencilProgram)
      projection.setTileUniforms(gl, stencilProgram, tileID, camera, viewport)
      internals.writeTileStencil(stencilProgram, meshBuffers.vert, meshBuffers.idx, meshBuffers.indexCount, ref)

      // Phase 2: draw opaque layers — only fragments where stencil === ref pass
      gl.stencilFunc(gl.EQUAL, ref, 0xFF)
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP)
      gl.stencilMask(0x00)

      let tileTexture: WebGLTexture | undefined
      if (sourceType === 'raster' && data !== undefined) {
        tileTexture = internals.getOrCreateTexture(tileID.key, data as ImageBitmap)
      }

      for (const layer of opaqueLayers) {
        const paint = evaluate(layer, camera.zoom)
        const program = programs.get((layer.constructor as { programs?: { name: string }[] }).programs?.[0]?.name)
        if (program) {
          gl.useProgram(program)
          projection.setTileUniforms(gl, program, tileID, camera, viewport)
        }
        layer.draw?.({
          gl,
          programs,
          tileID,
          meshBuffers,
          zoom: camera.zoom,
          paint,
          frameIndex,
          tileTexture,
          tileData: sourceType === 'vector' ? data : undefined,
          imageAtlas: {}, // STUB: not wired yet
          lineDashAtlas: {}, // STUB: not wired yet
        })
      }

      // Defer symbol layers for second pass
      for (const layer of symbolLayers) {
        deferredSymbols.push({ layer, tileID, meshBuffers, data, sourceType })
      }
    }
  }

  // Phase 3: draw symbol layers AFTER all opaque layers (no stencil clipping)
  for (const { layer, tileID, meshBuffers, data, sourceType } of deferredSymbols) {
    const paint = evaluate(layer, camera.zoom)
    const program = programs.get((layer.constructor as { programs?: { name: string }[] }).programs?.[0]?.name)
    if (program) {
      gl.useProgram(program)
      projection.setTileUniforms(gl, program, tileID, camera, viewport)
    }
    layer.draw?.({
      gl,
      programs,
      tileID,
      meshBuffers,
      zoom: camera.zoom,
      paint,
      frameIndex,
      camera,
      tileMatrix: projection.getTileMatrix(tileID, camera, viewport),
      tileData: sourceType === 'vector' ? data : undefined,
      imageAtlas: {}, // STUB: not wired yet
      lineDashAtlas: {}, // STUB: not wired yet
    })
  }

  gl.disable(gl.STENCIL_TEST)

  // Custom layers — rendered after all tiles, stencil off
  if (customLayers.length > 0) {
    const WORLD_TILE = { z: 0, x: 0, y: 0, key: '0/0/0' }
    for (const layer of customLayers) {
      layer.render({
        gl: gl as WebGLRenderingContext,
        camera,
        viewport,
        vertexShaderPrelude: projection.vertexShaderPrelude,
        setProjectionUniforms: (program: WebGLProgram) => {
          gl.useProgram(program)
          projection.setTileUniforms(gl, program, WORLD_TILE, camera, viewport)
        },
      })
    }
  }
}
