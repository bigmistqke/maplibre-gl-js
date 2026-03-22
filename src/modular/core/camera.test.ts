import {describe, it, expect, vi} from 'vitest';
import {CameraController} from '@modular/core/camera.ts';

describe('CameraController', () => {
    it('has sensible defaults', () => {
        const cam = new CameraController();
        const state = cam.getState();
        expect(state.zoom).toBe(0);
        expect(state.bearing).toBe(0);
        expect(state.pitch).toBe(0);
        expect(state.center).toEqual({lng: 0, lat: 0});
        expect(state.groundElevation).toBe(0);
    });

    it('accepts initial state', () => {
        const cam = new CameraController({center: {lng: 4.9, lat: 52.3}, zoom: 10});
        expect(cam.getState().center).toEqual({lng: 4.9, lat: 52.3});
        expect(cam.getState().zoom).toBe(10);
    });

    it('setZoom clamps to [minZoom, maxZoom]', () => {
        const cam = new CameraController({}, {minZoom: 0, maxZoom: 22});
        cam.setZoom(-5);
        expect(cam.getState().zoom).toBe(0);
        cam.setZoom(30);
        expect(cam.getState().zoom).toBe(22);
    });

    it('notifies onChange when state changes', () => {
        const onChange = vi.fn();
        const cam = new CameraController({}, {onChange});
        cam.setZoom(5);
        expect(onChange).toHaveBeenCalledOnce();
        expect(onChange.mock.calls[0][0].zoom).toBe(5);
    });

    it('setCamera updates multiple fields at once', () => {
        const cam = new CameraController();
        cam.setCamera({zoom: 12, center: {lng: 2.3, lat: 48.8}});
        const state = cam.getState();
        expect(state.zoom).toBe(12);
        expect(state.center).toEqual({lng: 2.3, lat: 48.8});
    });

    it('setElevationProvider is used for groundElevation on next setCenter', () => {
        const cam = new CameraController({center: {lng: 0, lat: 0}});
        cam.setElevationProvider({getElevation: () => 42});
        cam.setCenter({lng: 0, lat: 0});
        expect(cam.getState().groundElevation).toBe(42);
    });
});
