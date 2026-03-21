import type { CameraState, TileID, ResolvedPaintProperties, TileMesh } from './types.ts'
export type { TileMesh } from './types.ts'

export interface ProgramCache {
  get(name: string): WebGLProgram | undefined
}

/** STUB: empty until sprite/pattern atlas is wired. Passed as {} to draw(). */
export interface ImageAtlas {
}

/** STUB: empty until dash pattern atlas is wired. Passed as {} to draw(). */
export interface LineDashAtlas {
}

/** Passed to layer.draw() for each visible tile. Implemented by per-tile layers in Phase 2. */
export interface DrawContext {
  gl: WebGLRenderingContext
  programs: ProgramCache
  tileID: TileID
  /** Vertex + index buffers for the tile mesh (flat quad for mercator, subdivided for globe). */
  meshBuffers: { vert: WebGLBuffer; idx: WebGLBuffer; indexCount: number }
  zoom: number
  paint: ResolvedPaintProperties
  frameIndex: number
  imageAtlas: ImageAtlas
  lineDashAtlas: LineDashAtlas
  /** Texture for raster layers. Optional — vector layers will not have this. */
  tileTexture?: WebGLTexture
  /** Raw tile data (ArrayBuffer for vector tiles). Optional — raster layers will not have this. */
  tileData?: Transferable
}

/** Passed to RenderExtension hooks and full-frame layers. */
export interface RenderContext {
  gl: WebGLRenderingContext
  programs: ProgramCache
  camera: CameraState
  visibleTiles: TileID[]
  frameIndex: number
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
