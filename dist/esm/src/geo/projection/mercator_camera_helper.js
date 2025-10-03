import { LngLat } from '../lng_lat';
import { cameraForBoxAndBearing, updateRotation } from './camera_helper';
import { normalizeCenter } from '../transform_helper';
import { rollPitchBearingEqual, scaleZoom, zoomScale } from '../../util/util';
import { getMercatorHorizon, projectToWorldCoordinates, unprojectFromWorldCoordinates } from './mercator_utils';
import { interpolates } from '@maplibre/maplibre-gl-style-spec';
export class MercatorCameraHelper {
    get useGlobeControls() { return false; }
    handlePanInertia(pan, transform) {
        const offsetLength = pan.mag();
        const pixelsToHorizon = Math.abs(getMercatorHorizon(transform));
        const horizonFactor = 0.75;
        const offsetAsPoint = pan.mult(Math.min(pixelsToHorizon * horizonFactor / offsetLength, 1.0));
        return {
            easingOffset: offsetAsPoint,
            easingCenter: transform.center,
        };
    }
    handleMapControlsRollPitchBearingZoom(deltas, tr) {
        if (deltas.bearingDelta)
            tr.setBearing(tr.bearing + deltas.bearingDelta);
        if (deltas.pitchDelta)
            tr.setPitch(tr.pitch + deltas.pitchDelta);
        if (deltas.rollDelta)
            tr.setRoll(tr.roll + deltas.rollDelta);
        if (deltas.zoomDelta)
            tr.setZoom(tr.zoom + deltas.zoomDelta);
    }
    handleMapControlsPan(deltas, tr, preZoomAroundLoc) {
        if (deltas.around.distSqr(tr.centerPoint) < 1.0e-2) {
            return;
        }
        tr.setLocationAtPoint(preZoomAroundLoc, deltas.around);
    }
    cameraForBoxAndBearing(options, padding, bounds, bearing, tr) {
        return cameraForBoxAndBearing(options, padding, bounds, bearing, tr);
    }
    handleJumpToCenterZoom(tr, options) {
        const optionsZoom = typeof options.zoom !== 'undefined';
        const zoom = optionsZoom ? +options.zoom : tr.zoom;
        if (tr.zoom !== zoom) {
            tr.setZoom(+options.zoom);
        }
        if (options.center !== undefined) {
            tr.setCenter(LngLat.convert(options.center));
        }
    }
    handleEaseTo(tr, options) {
        const startZoom = tr.zoom;
        const startPadding = tr.padding;
        const startEulerAngles = { roll: tr.roll, pitch: tr.pitch, bearing: tr.bearing };
        const endRoll = options.roll === undefined ? tr.roll : options.roll;
        const endPitch = options.pitch === undefined ? tr.pitch : options.pitch;
        const endBearing = options.bearing === undefined ? tr.bearing : options.bearing;
        const endEulerAngles = { roll: endRoll, pitch: endPitch, bearing: endBearing };
        const optionsZoom = typeof options.zoom !== 'undefined';
        const doPadding = !tr.isPaddingEqual(options.padding);
        let isZooming = false;
        const zoom = optionsZoom ? +options.zoom : tr.zoom;
        let pointAtOffset = tr.centerPoint.add(options.offsetAsPoint);
        const locationAtOffset = tr.screenPointToLocation(pointAtOffset);
        const { center, zoom: endZoom } = tr.getConstrained(LngLat.convert(options.center || locationAtOffset), zoom !== null && zoom !== void 0 ? zoom : startZoom);
        normalizeCenter(tr, center);
        const from = projectToWorldCoordinates(tr.worldSize, locationAtOffset);
        const delta = projectToWorldCoordinates(tr.worldSize, center).sub(from);
        const finalScale = zoomScale(endZoom - startZoom);
        isZooming = (endZoom !== startZoom);
        const easeFunc = (k) => {
            if (isZooming) {
                tr.setZoom(interpolates.number(startZoom, endZoom, k));
            }
            if (!rollPitchBearingEqual(startEulerAngles, endEulerAngles)) {
                updateRotation({
                    startEulerAngles,
                    endEulerAngles,
                    tr,
                    k,
                    useSlerp: startEulerAngles.roll != endEulerAngles.roll
                });
            }
            if (doPadding) {
                tr.interpolatePadding(startPadding, options.padding, k);
                pointAtOffset = tr.centerPoint.add(options.offsetAsPoint);
            }
            if (options.around) {
                tr.setLocationAtPoint(options.around, options.aroundPoint);
            }
            else {
                const scale = zoomScale(tr.zoom - startZoom);
                const base = endZoom > startZoom ?
                    Math.min(2, finalScale) :
                    Math.max(0.5, finalScale);
                const speedup = Math.pow(base, 1 - k);
                const newCenter = unprojectFromWorldCoordinates(tr.worldSize, from.add(delta.mult(k * speedup)).mult(scale));
                tr.setLocationAtPoint(tr.renderWorldCopies ? newCenter.wrap() : newCenter, pointAtOffset);
            }
        };
        return {
            easeFunc,
            isZooming,
            elevationCenter: center,
        };
    }
    handleFlyTo(tr, options) {
        const optionsZoom = typeof options.zoom !== 'undefined';
        const startZoom = tr.zoom;
        const constrained = tr.getConstrained(LngLat.convert(options.center || options.locationAtOffset), optionsZoom ? +options.zoom : startZoom);
        const targetCenter = constrained.center;
        const targetZoom = constrained.zoom;
        normalizeCenter(tr, targetCenter);
        const from = projectToWorldCoordinates(tr.worldSize, options.locationAtOffset);
        const delta = projectToWorldCoordinates(tr.worldSize, targetCenter).sub(from);
        const pixelPathLength = delta.mag();
        const scaleOfZoom = zoomScale(targetZoom - startZoom);
        const optionsMinZoom = typeof options.minZoom !== 'undefined';
        let scaleOfMinZoom;
        if (optionsMinZoom) {
            const minZoomPreConstrain = Math.min(+options.minZoom, startZoom, targetZoom);
            const minZoom = tr.getConstrained(targetCenter, minZoomPreConstrain).zoom;
            scaleOfMinZoom = zoomScale(minZoom - startZoom);
        }
        const easeFunc = (k, scale, centerFactor, pointAtOffset) => {
            tr.setZoom(k === 1 ? targetZoom : startZoom + scaleZoom(scale));
            const newCenter = k === 1 ? targetCenter : unprojectFromWorldCoordinates(tr.worldSize, from.add(delta.mult(centerFactor)).mult(scale));
            tr.setLocationAtPoint(tr.renderWorldCopies ? newCenter.wrap() : newCenter, pointAtOffset);
        };
        return {
            easeFunc,
            scaleOfZoom,
            targetCenter,
            scaleOfMinZoom,
            pixelPathLength,
        };
    }
}
//# sourceMappingURL=mercator_camera_helper.js.map