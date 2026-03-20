import type { LngLat } from './types.ts'

export interface ElevationProvider {
  getElevation(lngLat: LngLat): number
}

export const NULL_ELEVATION: ElevationProvider = {
  getElevation: () => 0,
}
