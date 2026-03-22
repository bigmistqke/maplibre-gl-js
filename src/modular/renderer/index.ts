// src/modular/renderer/index.ts
import type { RendererAPI, WebGL2RendererAPI } from '@modular/core/renderer-api.ts'
import type { Projection } from '@modular/core/projection.ts'
import { Renderer } from '@modular/renderer/renderer.ts'
import { MercatorProjection } from '@modular/renderer/mercator.ts'

export type { RendererAPI, WebGL2RendererAPI, CustomLayer, CustomLayerRenderArgs } from '@modular/core/renderer-api.ts'

export interface RendererOptions {
  /** Custom projection — defaults to MercatorProjection (web mercator). */
  projection?: Projection
  /** WebGL context type — default 'webgl'. Use 'webgl2' for TerrainPlugin. */
  contextType?: 'webgl' | 'webgl2'
}

export async function createRenderer(
  canvas: HTMLCanvasElement,
  options: RendererOptions & { contextType: 'webgl2' },
): Promise<WebGL2RendererAPI>
export async function createRenderer(
  canvas: HTMLCanvasElement,
  options?: RendererOptions,
): Promise<RendererAPI>
export async function createRenderer(
  canvas: HTMLCanvasElement,
  options?: RendererOptions,
): Promise<RendererAPI> {
  const renderer = new Renderer(
    canvas,
    options?.projection ?? new MercatorProjection(),
    options?.contextType ?? 'webgl',
  )
  return renderer as unknown as RendererAPI
}
