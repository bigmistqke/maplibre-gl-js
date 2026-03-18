import type { RendererAPI } from '../core/renderer-api.ts'
import { Renderer } from './renderer.ts'

export type { RendererAPI }

/**
 * Async factory — no constructor+init smell.
 * In Phase 2+: compiles initial shader programs, warms the WebGL context.
 * In Phase 3+: accepts OffscreenCanvas for worker-mode rendering.
 */
export async function createRenderer(
  canvas: HTMLCanvasElement,
): Promise<RendererAPI> {
  return new Renderer(canvas)
}
