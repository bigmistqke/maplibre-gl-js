// src/mini/renderer/flat-surface.ts
import type { Surface } from '../core/surface.ts'
import { flatRenderTiles } from './flat-render-tiles.ts'

export const FLAT_SURFACE: Surface = {
  shaderDefines: [],
  renderTiles: flatRenderTiles,
  destroy() {},
}
