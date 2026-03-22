// src/modular/renderer/flat-surface.ts
import type { Surface } from '@modular/core/surface.ts'
import { flatRenderTiles } from '@modular/renderer/flat-render-tiles.ts'

export const FLAT_SURFACE: Surface = {
  shaderDefines: [],
  renderTiles: flatRenderTiles,
  destroy() {},
}
