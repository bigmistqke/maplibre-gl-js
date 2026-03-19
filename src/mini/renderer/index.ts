// src/mini/renderer/index.ts
import type { RendererAPI } from '../core/renderer-api.ts'
import type { Projection } from '../core/projection.ts'
import { Renderer } from './renderer.ts'
import { MercatorProjection } from './mercator.ts'

export type { RendererAPI, CustomLayer, CustomLayerRenderArgs } from '../core/renderer-api.ts'

export interface RendererOptions {
  /** Custom projection — defaults to MercatorProjection (web mercator). */
  projection?: Projection
}

/**
 * Async factory — no constructor+init smell.
 * Accepts an optional projection (default: MercatorProjection).
 * In Phase 3+: accepts OffscreenCanvas for worker-mode rendering.
 */
export async function createRenderer(
  canvas: HTMLCanvasElement,
  options?: RendererOptions,
): Promise<RendererAPI> {
  return new Renderer(canvas, options?.projection ?? new MercatorProjection())
}
