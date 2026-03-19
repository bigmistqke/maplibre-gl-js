// src/mini/renderer/flat-render-tiles.ts
import type { RendererInternals } from '../core/surface.ts'

export const ELEVATION_PRELUDE = /* glsl */`
vec4 projectTileWithElevation(vec2 posInTile, float elevation) {
#ifdef TERRAIN3D
  return projectTile(posInTile + vec2(0.0, elevation * u_elevation_scale));
#else
  return projectTile(posInTile);
#endif
}
`

export function flatRenderTiles(internals: RendererInternals): void {
  const { gl, camera, viewport, projection, programs, stencilProgram,
          layers, tileLayers, tileManagers, sourceTypes, customLayers,
          evaluate, frameIndex } = internals

  gl.enable(gl.STENCIL_TEST)
  gl.clear(gl.STENCIL_BUFFER_BIT)
  let nextStencilRef = 1

  for (const [sourceId, tileManager] of tileManagers) {
    const readyTiles = tileManager.getReadyTiles()
    const sourceLayers = tileLayers.get(sourceId) ?? []
    const sourceType = sourceTypes.get(sourceId) ?? 'raster'

    for (const { tileID, data } of readyTiles) {
      const mesh = projection.getMeshForTile(tileID)
      const meshBuffers = internals.getOrCreateMeshBuffers(tileID.key, mesh)

      const ref = nextStencilRef++
      if (nextStencilRef > 255) nextStencilRef = 1

      // Phase 1: write stencil mask
      gl.useProgram(stencilProgram)
      projection.setTileUniforms(gl as any, stencilProgram, tileID, camera, viewport)
      internals.writeTileStencil(stencilProgram, meshBuffers.vert, meshBuffers.idx, meshBuffers.indexCount, ref)

      // Phase 2: draw layers — only fragments where stencil === ref pass
      gl.stencilFunc(gl.EQUAL, ref, 0xFF)
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP)
      gl.stencilMask(0x00)

      let tileTexture: WebGLTexture | undefined
      if (sourceType === 'raster') {
        tileTexture = internals.getOrCreateTexture(tileID.key, data as ImageBitmap)
      }

      for (const layer of sourceLayers) {
        const paint = evaluate(layer, camera.zoom)
        const program = programs.get((layer.constructor as any).programs?.[0]?.name)
        if (program) {
          gl.useProgram(program)
          projection.setTileUniforms(gl as any, program, tileID, camera, viewport)
        }
        ;(layer as any).draw({
          gl,
          programs,
          tileID,
          meshBuffers,
          zoom: camera.zoom,
          paint,
          frameIndex,
          tileTexture,
          tileData: sourceType === 'vector' ? data : undefined,
          imageAtlas: {},
          lineDashAtlas: {},
        })
      }
    }
  }

  gl.disable(gl.STENCIL_TEST)

  // Custom layers — rendered after all tiles, stencil off
  if (customLayers.length > 0) {
    const WORLD_TILE = { z: 0, x: 0, y: 0, key: '0/0/0' }
    for (const layer of customLayers) {
      layer.render({
        gl: gl as any,
        camera,
        viewport,
        vertexShaderPrelude: projection.vertexShaderPrelude,
        setProjectionUniforms: (program: WebGLProgram) => {
          gl.useProgram(program)
          projection.setTileUniforms(gl as any, program, WORLD_TILE, camera, viewport)
        },
      })
    }
  }
}
