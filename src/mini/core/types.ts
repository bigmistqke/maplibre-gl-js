export interface LngLat {
  lng: number
  lat: number
}

export interface ScreenPoint {
  x: number
  y: number
}

export interface TileID {
  z: number
  x: number
  y: number
  key: string  // `${z}/${x}/${y}` — for use as Map key
}

export interface Feature {
  id?: string | number
  type: string
  properties: Record<string, unknown>
}

export interface CameraState {
  center: LngLat
  zoom: number
  bearing: number
  pitch: number
  /** Terrain elevation at map center ground level. Always 0 on flat maps. */
  groundElevation: number
}

export interface AnimationOptions {
  duration?: number
  easing?: (t: number) => number
}

export interface ProgramDefinition {
  name: string
  vertex: string
  fragment: string
}

export type ResolvedPaintProperties = Record<string, unknown>
