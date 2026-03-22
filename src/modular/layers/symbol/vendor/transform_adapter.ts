import type { ISymbolTransform, PointProjection, UnwrappedTileIDLike } from './types.ts'
import type { CameraState } from '../../../core/types.ts'
import type { Viewport } from '../../../core/projection.ts'
import { mat4, type mat4 as Mat4Type } from 'gl-matrix'
import { lngToTileX, latToTileY } from '../../../renderer/mercator.ts'
import { TILE_SIZE, TILE_EXTENT } from '../../../core/constants.ts'
import Point from '@mapbox/point-geometry'

const FOV = 0.6435011087932844
const DEG = Math.PI / 180
const EARTH_CIRC = 2 * Math.PI * 6371008.8

export class TransformAdapter implements ISymbolTransform {
    readonly width: number
    readonly height: number
    readonly cameraToCenterDistance: number
    readonly pitch: number
    readonly angle: number
    readonly zoom: number

    // Cached view-projection matrix (same for all tiles with the same camera)
    private readonly _viewProj: Mat4Type

    constructor(camera: CameraState, viewport: Viewport) {
        this.width = viewport.width
        this.height = viewport.height
        this.zoom = camera.zoom
        this.pitch = (camera.pitch ?? 0) * Math.PI / 180
        this.angle = -(camera.bearing ?? 0) * Math.PI / 180
        this.cameraToCenterDistance = (viewport.height / 2) / Math.tan(FOV / 2)

        // Build and cache the view-projection matrix
        const { center, zoom } = camera
        const pitchDeg = camera.pitch ?? 0
        const bearingDeg = camera.bearing ?? 0
        const { width, height } = viewport
        const worldSize = TILE_SIZE * Math.pow(2, zoom)

        const cx = lngToTileX(center.lng, zoom) * TILE_SIZE
        const cy = latToTileY(center.lat, zoom) * TILE_SIZE

        const latRad = center.lat * DEG
        const pixelsPerMeter = worldSize / (EARTH_CIRC * Math.cos(latRad))

        const nearZ = 0.5
        const farZ = this.cameraToCenterDistance * 10

        const m = mat4.create() as unknown as Mat4Type
        mat4.perspective(m, FOV, width / height, nearZ, farZ)
        mat4.scale(m, m, [1, -1, 1])
        mat4.translate(m, m, [0, 0, -this.cameraToCenterDistance])
        mat4.rotateX(m, m, pitchDeg * DEG)
        mat4.rotateZ(m, m, -bearingDeg * DEG)
        mat4.translate(m, m, [-cx, -cy, 0])
        mat4.scale(m, m, [1, 1, pixelsPerMeter])

        this._viewProj = m
    }

    calculatePosMatrix(_unwrappedTileID: UnwrappedTileIDLike): mat4 {
        throw new Error('Not implemented yet — Task 1.4')
    }

    projectTileCoordinates(x: number, y: number, unwrappedTileID: UnwrappedTileIDLike, _getElevation: (x: number, y: number) => number): PointProjection {
        const { canonical, wrap } = unwrappedTileID
        const worldSize = TILE_SIZE * Math.pow(2, this.zoom)
        const tileScale = worldSize / Math.pow(2, canonical.z)

        // Build tile matrix
        const t = mat4.create() as unknown as Mat4Type
        const tileX = canonical.x + wrap * Math.pow(2, canonical.z)
        mat4.translate(t, t, [tileX * tileScale, canonical.y * tileScale, 0])
        mat4.scale(t, t, [tileScale / TILE_EXTENT, tileScale / TILE_EXTENT, 1])

        // posMatrix = viewProj × tileMatrix
        const posMatrix = mat4.create() as unknown as Mat4Type
        mat4.multiply(posMatrix, this._viewProj as unknown as mat4, t as unknown as mat4)

        // Project point (x, y, 0, 1) through posMatrix
        const m = posMatrix as unknown as Float32Array
        const px = m[0] * x + m[4] * y + m[12]
        const py = m[1] * x + m[5] * y + m[13]
        const pw = m[3] * x + m[7] * y + m[15]

        // Perspective divide → clip space
        const clipX = px / pw
        const clipY = py / pw

        return {
            point: new Point(clipX, clipY),
            signedDistanceFromCamera: pw,
            isOccluded: false,
        }
    }
}
