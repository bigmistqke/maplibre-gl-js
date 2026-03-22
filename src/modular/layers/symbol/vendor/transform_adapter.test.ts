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

    it('throws on projectTileCoordinates (not yet implemented)', () => {
        const adapter = new TransformAdapter(camera, viewport)
        expect(() => adapter.projectTileCoordinates(0, 0, { canonical: { z: 14, x: 8414, y: 5384 }, wrap: 0 }, () => 0)).toThrow('Not implemented yet')
    })
})
