import type { LngLat, CameraState, AnimationOptions } from './types.ts'
import type { ElevationProvider } from './elevation-provider.ts'
import { NULL_ELEVATION } from './elevation-provider.ts'

export interface CameraOptions {
  minZoom?: number
  maxZoom?: number
  onChange?: (state: CameraState) => void
}

const DEFAULT_STATE: CameraState = {
  center: { lng: 0, lat: 0 },
  zoom: 0,
  bearing: 0,
  pitch: 0,
  groundElevation: 0,
}

export class CameraController {
  private _state: CameraState
  private _minZoom: number
  private _maxZoom: number
  private _onChange?: (state: CameraState) => void
  private _elevationProvider: ElevationProvider = NULL_ELEVATION

  constructor(
    initial: Partial<CameraState> = {},
    options: CameraOptions = {},
  ) {
    this._state = { ...DEFAULT_STATE, ...initial }
    this._minZoom = options.minZoom ?? 0
    this._maxZoom = options.maxZoom ?? 22
    this._onChange = options.onChange
  }

  getState(): CameraState {
    return { ...this._state }
  }

  setElevationProvider(ep: ElevationProvider): void {
    this._elevationProvider = ep
  }

  setCenter(center: LngLat): void {
    this._update({
      center,
      groundElevation: this._elevationProvider.getElevation(center),
    })
  }

  setZoom(zoom: number): void {
    this._update({ zoom: Math.max(this._minZoom, Math.min(this._maxZoom, zoom)) })
  }

  setBearing(bearing: number): void {
    this._update({ bearing: ((bearing % 360) + 360) % 360 })
  }

  setPitch(pitch: number): void {
    this._update({ pitch: Math.max(0, Math.min(85, pitch)) })
  }

  setCamera(partial: Partial<CameraState>, _options?: AnimationOptions): void {
    const next: Partial<CameraState> = { ...partial }
    if (next.zoom !== undefined) {
      next.zoom = Math.max(this._minZoom, Math.min(this._maxZoom, next.zoom))
    }
    if (next.center !== undefined && next.groundElevation === undefined) {
      next.groundElevation = this._elevationProvider.getElevation(next.center)
    }
    this._update(next)
  }

  private _update(partial: Partial<CameraState>): void {
    this._state = { ...this._state, ...partial }
    this._onChange?.(this.getState())
  }
}
