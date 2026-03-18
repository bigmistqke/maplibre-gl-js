import type { CameraState, TileID, ResolvedPaintProperties } from './types.ts'

export interface ProgramCache {
  get(name: string): WebGLProgram | undefined
}

export interface ImageAtlas {
  // sprite images, icon textures, fill patterns — implemented in Phase 2
}

export interface LineDashAtlas {
  // dash pattern textures for line layers — implemented in Phase 2
}

/** Passed to layer.draw() for each visible tile. Implemented by per-tile layers in Phase 2. */
export interface DrawContext {
  gl: WebGLRenderingContext
  programs: ProgramCache
  tileID: TileID
  matrix: Float32Array
  zoom: number
  paint: ResolvedPaintProperties
  frameIndex: number
  imageAtlas: ImageAtlas
  lineDashAtlas: LineDashAtlas
}

/** Passed to RenderExtension hooks and full-frame layers. */
export interface RenderContext {
  gl: WebGLRenderingContext
  programs: ProgramCache
  camera: CameraState
  visibleTiles: TileID[]
  frameIndex: number
}

export interface TileMesh {
  vertices: Float32Array
  indices: Uint16Array
}

export interface RenderExtension {
  id: string
  shaderInjection?: {
    vertex?: string
    fragment?: string
    defines?: Record<string, string>
  }
  beforeTiles?(ctx: RenderContext): void
  afterTiles?(ctx: RenderContext): void
  transformTileGeometry?(mesh: TileMesh, tileID: TileID): TileMesh
}
