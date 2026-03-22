import type { mat4 } from 'gl-matrix'
import type Point from '@mapbox/point-geometry'

export interface PointProjection {
  point: Point
  signedDistanceFromCamera: number
  isOccluded: boolean
}

export interface UnwrappedTileIDLike {
  canonical: { z: number; x: number; y: number }
  wrap: number
  key?: string | number
}

export interface ISymbolTransform {
  width: number
  height: number
  cameraToCenterDistance: number
  pitch: number
  angle: number // bearing in radians
  zoom: number
  calculatePosMatrix(unwrappedTileID: UnwrappedTileIDLike): mat4
  projectTileCoordinates(x: number, y: number, unwrappedTileID: UnwrappedTileIDLike, getElevation: (x: number, y: number) => number): PointProjection
}

export interface ISymbolTile {
  tileID: { canonical: { z: number; x: number; y: number }; key: string | number }
  holdingForFade(): boolean
}

export interface ISymbolStyleLayer {
  id: string
  layout: {
    get(name: string): { evaluate(...args: any[]): any }
  }
}

export interface FeatureKeyLike {
  bucketInstanceId: number
  featureIndex: number
  collisionGroupID: number
  overlapMode: string
}
