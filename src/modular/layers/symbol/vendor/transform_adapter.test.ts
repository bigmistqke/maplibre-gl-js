import { describe, it, expect } from 'vitest'
import { TransformAdapter } from './transform_adapter.ts'

const camera = { center: { lng: 4.89, lat: 52.37 }, zoom: 14, bearing: 0, pitch: 0, groundElevation: 0 }
const viewport = { width: 512, height: 512 }

describe('TransformAdapter', () => {
    it('exposes width and height from viewport', () => {
        const adapter = new TransformAdapter(camera, viewport)
        expect(adapter.width).toBe(512)
        expect(adapter.height).toBe(512)
    })

    it('exposes zoom from camera', () => {
        const adapter = new TransformAdapter(camera, viewport)
        expect(adapter.zoom).toBe(14)
    })

    it('computes cameraToCenterDistance from viewport height and FOV', () => {
        const adapter = new TransformAdapter(camera, viewport)
        // FOV = 0.6435011087932844 (Math.atan(1) * 2)
        // cameraToCenterDistance = height/2 / tan(FOV/2) = 256 / tan(0.3217) ≈ 768
        expect(adapter.cameraToCenterDistance).toBeCloseTo(768, 0)
    })

    it('exposes pitch in radians', () => {
        const adapter = new TransformAdapter({ ...camera, pitch: 45 }, viewport)
        expect(adapter.pitch).toBeCloseTo(45 * Math.PI / 180)
    })

    it('exposes angle (bearing) in radians, negated', () => {
        // MapLibre's transform.angle = -bearing in radians
        const adapter = new TransformAdapter({ ...camera, bearing: 90 }, viewport)
        expect(adapter.angle).toBeCloseTo(-90 * Math.PI / 180)
    })

    it('throws on calculatePosMatrix (not yet implemented)', () => {
        const adapter = new TransformAdapter(camera, viewport)
        expect(() => adapter.calculatePosMatrix({ canonical: { z: 14, x: 8414, y: 5384 }, wrap: 0 })).toThrow('Not implemented yet')
    })

    it('projectTileCoordinates returns clip-space coords for tile center', () => {
        const adapter = new TransformAdapter(camera, viewport)
        const unwrapped = { canonical: { z: 14, x: 8414, y: 5384 }, wrap: 0 }
        const result = adapter.projectTileCoordinates(2048, 2048, unwrapped, () => 0)
        // Tile center should be near clip-space origin (0,0) when camera is centered on tile
        expect(result.point.x).toBeCloseTo(0, 0)
        expect(result.point.y).toBeCloseTo(0, 0)
        expect(result.signedDistanceFromCamera).toBeGreaterThan(0)
        expect(result.isOccluded).toBe(false)
    })

    it('projectTileCoordinates: tile corners map to expected clip-space', () => {
        const adapter = new TransformAdapter(camera, viewport)
        const unwrapped = { canonical: { z: 14, x: 8414, y: 5384 }, wrap: 0 }
        const topLeft = adapter.projectTileCoordinates(0, 0, unwrapped, () => 0)
        const bottomRight = adapter.projectTileCoordinates(4096, 4096, unwrapped, () => 0)
        // Top-left should be negative x, positive y (clip space Y up)
        expect(topLeft.point.x).toBeLessThan(0)
        // Bottom-right should be positive x, negative y
        expect(bottomRight.point.x).toBeGreaterThan(0)
    })

    it('signedDistanceFromCamera is the w component (positive = in front of camera)', () => {
        const adapter = new TransformAdapter(camera, viewport)
        const unwrapped = { canonical: { z: 14, x: 8414, y: 5384 }, wrap: 0 }
        const result = adapter.projectTileCoordinates(2048, 2048, unwrapped, () => 0)
        // w should be approximately cameraToCenterDistance for points at the ground plane
        expect(result.signedDistanceFromCamera).toBeCloseTo(adapter.cameraToCenterDistance, -1)
    })
})
