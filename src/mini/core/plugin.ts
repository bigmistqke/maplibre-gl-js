import type { LngLat } from './types.ts'
import type { RenderExtension } from './render-extension.ts'

export interface Plugin {
  getElevation?: (lngLat: LngLat) => number
  readonly renderExtension?: RenderExtension
}
