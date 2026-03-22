/**
 * Demo-only map wrappers that expose window.__map for the demo CLI.
 * Import these in demo pages instead of MapGL / Map directly.
 */
import { MapGL } from '../src/modular/core/map.ts'
import type { MapGLOptions } from '../src/modular/core/map.ts'
import type { RendererAPI } from '../src/modular/core/renderer-api.ts'
import { Map } from 'maplibre-gl-reference'

export class MapGLDemo<R extends RendererAPI = RendererAPI> extends MapGL<R> {
  constructor(options: MapGLOptions<R>) {
    super(options)
    if (typeof window !== 'undefined') (window as any).__map = this
  }
}

export function createMapDemo(options: ConstructorParameters<typeof Map>[0]): Map {
  const map = new Map(options)
  if (typeof window !== 'undefined') (window as any).__map = map
  return map
}
