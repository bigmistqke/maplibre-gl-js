import type { ISymbolTransform, PointProjection, UnwrappedTileIDLike } from './types.ts'
import type { CameraState } from '../../../core/types.ts'
import type { Viewport } from '../../../core/projection.ts'
import type { mat4 } from 'gl-matrix'

const FOV = 0.6435011087932844

export class TransformAdapter implements ISymbolTransform {
    readonly width: number
    readonly height: number
    readonly cameraToCenterDistance: number
    readonly pitch: number
    readonly angle: number
    readonly zoom: number

    constructor(camera: CameraState, viewport: Viewport) {
        this.width = viewport.width
        this.height = viewport.height
        this.zoom = camera.zoom
        this.pitch = (camera.pitch ?? 0) * Math.PI / 180
        this.angle = -(camera.bearing ?? 0) * Math.PI / 180
        this.cameraToCenterDistance = (viewport.height / 2) / Math.tan(FOV / 2)
    }

    calculatePosMatrix(_unwrappedTileID: UnwrappedTileIDLike): mat4 {
        throw new Error('Not implemented yet — Task 1.4')
    }

    projectTileCoordinates(_x: number, _y: number, _unwrappedTileID: UnwrappedTileIDLike, _getElevation: (x: number, y: number) => number): PointProjection {
        throw new Error('Not implemented yet — Task 1.3')
    }
}
