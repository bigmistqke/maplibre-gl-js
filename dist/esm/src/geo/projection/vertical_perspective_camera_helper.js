import Point from '@mapbox/point-geometry';
import { cameraBoundsWarning, updateRotation, cameraForBoxAndBearing } from './camera_helper';
import { LngLat } from '../lng_lat';
import { angularCoordinatesToSurfaceVector, computeGlobePanCenter, getGlobeRadiusPixels, getZoomAdjustment, globeDistanceOfLocationsPixels, interpolateLngLatForGlobe } from './globe_utils';
import { clamp, createVec3f64, differenceOfAnglesDegrees, MAX_VALID_LATITUDE, remapSaturate, rollPitchBearingEqual, scaleZoom, warnOnce, zoomScale } from '../../util/util';
import { vec3 } from 'gl-matrix';
import { normalizeCenter } from '../transform_helper';
import { interpolates } from '@maplibre/maplibre-gl-style-spec';
export class VerticalPerspectiveCameraHelper {
    get useGlobeControls() { return true; }
    handlePanInertia(pan, transform) {
        const panCenter = computeGlobePanCenter(pan, transform);
        if (Math.abs(panCenter.lng - transform.center.lng) > 180) {
            panCenter.lng = transform.center.lng + 179.5 * Math.sign(panCenter.lng - transform.center.lng);
        }
        return {
            easingCenter: panCenter,
            easingOffset: new Point(0, 0),
        };
    }
    handleMapControlsRollPitchBearingZoom(deltas, tr) {
        const zoomPixel = deltas.around;
        const zoomLoc = tr.screenPointToLocation(zoomPixel);
        if (deltas.bearingDelta)
            tr.setBearing(tr.bearing + deltas.bearingDelta);
        if (deltas.pitchDelta)
            tr.setPitch(tr.pitch + deltas.pitchDelta);
        if (deltas.rollDelta)
            tr.setRoll(tr.roll + deltas.rollDelta);
        const oldZoomPreZoomDelta = tr.zoom;
        if (deltas.zoomDelta)
            tr.setZoom(tr.zoom + deltas.zoomDelta);
        const actualZoomDelta = tr.zoom - oldZoomPreZoomDelta;
        if (actualZoomDelta === 0) {
            return;
        }
        const raySurfaceDistanceForSlowingStart = 0.3;
        const slowingMultiplier = 0.5;
        const interpolateToHeuristicStartLng = 45;
        const interpolateToHeuristicEndLng = 85;
        const interpolateToHeuristicExponent = 0.25;
        const interpolateToHeuristicStartRadius = 0.75;
        const interpolateToHeuristicEndRadius = 0.35;
        const slowingRadiusStart = 0.9;
        const slowingRadiusStop = 0.5;
        const slowingRadiusSlowFactor = 0.25;
        const dLngRaw = differenceOfAnglesDegrees(tr.center.lng, zoomLoc.lng);
        const dLng = dLngRaw / (Math.abs(dLngRaw / 180) + 1.0);
        const dLat = differenceOfAnglesDegrees(tr.center.lat, zoomLoc.lat);
        const rayDirection = tr.getRayDirectionFromPixel(zoomPixel);
        const rayOrigin = tr.cameraPosition;
        const distanceToClosestPoint = vec3.dot(rayOrigin, rayDirection) * -1;
        const closestPoint = createVec3f64();
        vec3.add(closestPoint, rayOrigin, [
            rayDirection[0] * distanceToClosestPoint,
            rayDirection[1] * distanceToClosestPoint,
            rayDirection[2] * distanceToClosestPoint
        ]);
        const distanceFromSurface = vec3.length(closestPoint) - 1;
        const distanceFactor = Math.exp(-Math.max(distanceFromSurface - raySurfaceDistanceForSlowingStart, 0) * slowingMultiplier);
        const radius = getGlobeRadiusPixels(tr.worldSize, tr.center.lat) / Math.min(tr.width, tr.height);
        const radiusFactor = remapSaturate(radius, slowingRadiusStart, slowingRadiusStop, 1.0, slowingRadiusSlowFactor);
        const factor = (1.0 - zoomScale(-actualZoomDelta)) * Math.min(distanceFactor, radiusFactor);
        const oldCenterLat = tr.center.lat;
        const oldZoom = tr.zoom;
        const heuristicCenter = new LngLat(tr.center.lng + dLng * factor, clamp(tr.center.lat + dLat * factor, -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE));
        tr.setLocationAtPoint(zoomLoc, zoomPixel);
        const exactCenter = tr.center;
        const interpolationFactorLongitude = remapSaturate(Math.abs(dLngRaw), interpolateToHeuristicStartLng, interpolateToHeuristicEndLng, 0, 1);
        const interpolationFactorRadius = remapSaturate(radius, interpolateToHeuristicStartRadius, interpolateToHeuristicEndRadius, 0, 1);
        const heuristicFactor = Math.pow(Math.max(interpolationFactorLongitude, interpolationFactorRadius), interpolateToHeuristicExponent);
        const lngExactToHeuristic = differenceOfAnglesDegrees(exactCenter.lng, heuristicCenter.lng);
        const latExactToHeuristic = differenceOfAnglesDegrees(exactCenter.lat, heuristicCenter.lat);
        tr.setCenter(new LngLat(exactCenter.lng + lngExactToHeuristic * heuristicFactor, exactCenter.lat + latExactToHeuristic * heuristicFactor).wrap());
        tr.setZoom(oldZoom + getZoomAdjustment(oldCenterLat, tr.center.lat));
    }
    handleMapControlsPan(deltas, tr, _preZoomAroundLoc) {
        if (!deltas.panDelta) {
            return;
        }
        const oldLat = tr.center.lat;
        const oldZoom = tr.zoom;
        tr.setCenter(computeGlobePanCenter(deltas.panDelta, tr).wrap());
        tr.setZoom(oldZoom + getZoomAdjustment(oldLat, tr.center.lat));
    }
    cameraForBoxAndBearing(options, padding, bounds, bearing, tr) {
        const result = cameraForBoxAndBearing(options, padding, bounds, bearing, tr);
        const xLeft = (padding.left) / tr.width * 2.0 - 1.0;
        const xRight = (tr.width - padding.right) / tr.width * 2.0 - 1.0;
        const yTop = (padding.top) / tr.height * -2.0 + 1.0;
        const yBottom = (tr.height - padding.bottom) / tr.height * -2.0 + 1.0;
        const flipEastWest = differenceOfAnglesDegrees(bounds.getWest(), bounds.getEast()) < 0;
        const lngWest = flipEastWest ? bounds.getEast() : bounds.getWest();
        const lngEast = flipEastWest ? bounds.getWest() : bounds.getEast();
        const latNorth = Math.max(bounds.getNorth(), bounds.getSouth());
        const latSouth = Math.min(bounds.getNorth(), bounds.getSouth());
        const lngMid = lngWest + differenceOfAnglesDegrees(lngWest, lngEast) * 0.5;
        const latMid = latNorth + differenceOfAnglesDegrees(latNorth, latSouth) * 0.5;
        const clonedTr = tr.clone();
        clonedTr.setCenter(result.center);
        clonedTr.setBearing(result.bearing);
        clonedTr.setPitch(0);
        clonedTr.setRoll(0);
        clonedTr.setZoom(result.zoom);
        const matrix = clonedTr.modelViewProjectionMatrix;
        const testVectors = [
            angularCoordinatesToSurfaceVector(bounds.getNorthWest()),
            angularCoordinatesToSurfaceVector(bounds.getNorthEast()),
            angularCoordinatesToSurfaceVector(bounds.getSouthWest()),
            angularCoordinatesToSurfaceVector(bounds.getSouthEast()),
            angularCoordinatesToSurfaceVector(new LngLat(lngEast, latMid)),
            angularCoordinatesToSurfaceVector(new LngLat(lngWest, latMid)),
            angularCoordinatesToSurfaceVector(new LngLat(lngMid, latNorth)),
            angularCoordinatesToSurfaceVector(new LngLat(lngMid, latSouth))
        ];
        const vecToCenter = angularCoordinatesToSurfaceVector(result.center);
        let smallestNeededScale = Number.POSITIVE_INFINITY;
        for (const vec of testVectors) {
            if (xLeft < 0)
                smallestNeededScale = VerticalPerspectiveCameraHelper.getLesserNonNegativeNonNull(smallestNeededScale, VerticalPerspectiveCameraHelper.solveVectorScale(vec, vecToCenter, matrix, 'x', xLeft));
            if (xRight > 0)
                smallestNeededScale = VerticalPerspectiveCameraHelper.getLesserNonNegativeNonNull(smallestNeededScale, VerticalPerspectiveCameraHelper.solveVectorScale(vec, vecToCenter, matrix, 'x', xRight));
            if (yTop > 0)
                smallestNeededScale = VerticalPerspectiveCameraHelper.getLesserNonNegativeNonNull(smallestNeededScale, VerticalPerspectiveCameraHelper.solveVectorScale(vec, vecToCenter, matrix, 'y', yTop));
            if (yBottom < 0)
                smallestNeededScale = VerticalPerspectiveCameraHelper.getLesserNonNegativeNonNull(smallestNeededScale, VerticalPerspectiveCameraHelper.solveVectorScale(vec, vecToCenter, matrix, 'y', yBottom));
        }
        if (!Number.isFinite(smallestNeededScale) || smallestNeededScale === 0) {
            cameraBoundsWarning();
            return undefined;
        }
        result.zoom = clonedTr.zoom + scaleZoom(smallestNeededScale);
        return result;
    }
    handleJumpToCenterZoom(tr, options) {
        const startingLat = tr.center.lat;
        const constrainedCenter = tr.getConstrained(options.center ? LngLat.convert(options.center) : tr.center, tr.zoom).center;
        tr.setCenter(constrainedCenter.wrap());
        const targetZoom = (typeof options.zoom !== 'undefined') ? +options.zoom : (tr.zoom + getZoomAdjustment(startingLat, constrainedCenter.lat));
        if (tr.zoom !== targetZoom) {
            tr.setZoom(targetZoom);
        }
    }
    handleEaseTo(tr, options) {
        const startZoom = tr.zoom;
        const startCenter = tr.center;
        const startPadding = tr.padding;
        const startEulerAngles = { roll: tr.roll, pitch: tr.pitch, bearing: tr.bearing };
        const endRoll = options.roll === undefined ? tr.roll : options.roll;
        const endPitch = options.pitch === undefined ? tr.pitch : options.pitch;
        const endBearing = options.bearing === undefined ? tr.bearing : options.bearing;
        const endEulerAngles = { roll: endRoll, pitch: endPitch, bearing: endBearing };
        const optionsZoom = typeof options.zoom !== 'undefined';
        const doPadding = !tr.isPaddingEqual(options.padding);
        let isZooming = false;
        const preConstrainCenter = options.center ?
            LngLat.convert(options.center) :
            startCenter;
        const constrainedCenter = tr.getConstrained(preConstrainCenter, startZoom).center;
        normalizeCenter(tr, constrainedCenter);
        const clonedTr = tr.clone();
        clonedTr.setCenter(constrainedCenter);
        clonedTr.setZoom(optionsZoom ?
            +options.zoom :
            startZoom + getZoomAdjustment(startCenter.lat, preConstrainCenter.lat));
        clonedTr.setBearing(options.bearing);
        const clampedPoint = new Point(clamp(tr.centerPoint.x + options.offsetAsPoint.x, 0, tr.width), clamp(tr.centerPoint.y + options.offsetAsPoint.y, 0, tr.height));
        clonedTr.setLocationAtPoint(constrainedCenter, clampedPoint);
        const endCenterWithShift = (options.offset && options.offsetAsPoint.mag()) > 0 ? clonedTr.center : constrainedCenter;
        const endZoomWithShift = optionsZoom ?
            +options.zoom :
            startZoom + getZoomAdjustment(startCenter.lat, endCenterWithShift.lat);
        const normalizedStartZoom = startZoom + getZoomAdjustment(startCenter.lat, 0);
        const normalizedEndZoom = endZoomWithShift + getZoomAdjustment(endCenterWithShift.lat, 0);
        const deltaLng = differenceOfAnglesDegrees(startCenter.lng, endCenterWithShift.lng);
        const deltaLat = differenceOfAnglesDegrees(startCenter.lat, endCenterWithShift.lat);
        const finalScale = zoomScale(normalizedEndZoom - normalizedStartZoom);
        isZooming = (endZoomWithShift !== startZoom);
        const easeFunc = (k) => {
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
            }
            if (options.around) {
                warnOnce('Easing around a point is not supported under globe projection.');
                tr.setLocationAtPoint(options.around, options.aroundPoint);
            }
            else {
                const base = normalizedEndZoom > normalizedStartZoom ?
                    Math.min(2, finalScale) :
                    Math.max(0.5, finalScale);
                const speedup = Math.pow(base, 1 - k);
                const factor = k * speedup;
                const newCenter = interpolateLngLatForGlobe(startCenter, deltaLng, deltaLat, factor);
                tr.setCenter(newCenter.wrap());
            }
            if (isZooming) {
                const normalizedInterpolatedZoom = interpolates.number(normalizedStartZoom, normalizedEndZoom, k);
                const interpolatedZoom = normalizedInterpolatedZoom + getZoomAdjustment(0, tr.center.lat);
                tr.setZoom(interpolatedZoom);
            }
        };
        return {
            easeFunc,
            isZooming,
            elevationCenter: endCenterWithShift,
        };
    }
    handleFlyTo(tr, options) {
        const optionsZoom = typeof options.zoom !== 'undefined';
        const startCenter = tr.center;
        const startZoom = tr.zoom;
        const startPadding = tr.padding;
        const doPadding = !tr.isPaddingEqual(options.padding);
        const constrainedCenter = tr.getConstrained(LngLat.convert(options.center || options.locationAtOffset), startZoom).center;
        const targetZoom = optionsZoom ? +options.zoom : tr.zoom + getZoomAdjustment(tr.center.lat, constrainedCenter.lat);
        const clonedTr = tr.clone();
        clonedTr.setCenter(constrainedCenter);
        clonedTr.setZoom(targetZoom);
        clonedTr.setBearing(options.bearing);
        const clampedPoint = new Point(clamp(tr.centerPoint.x + options.offsetAsPoint.x, 0, tr.width), clamp(tr.centerPoint.y + options.offsetAsPoint.y, 0, tr.height));
        clonedTr.setLocationAtPoint(constrainedCenter, clampedPoint);
        const targetCenter = clonedTr.center;
        normalizeCenter(tr, targetCenter);
        const pixelPathLength = globeDistanceOfLocationsPixels(tr, startCenter, targetCenter);
        const normalizedStartZoom = startZoom + getZoomAdjustment(startCenter.lat, 0);
        const normalizedTargetZoom = targetZoom + getZoomAdjustment(targetCenter.lat, 0);
        const scaleOfZoom = zoomScale(normalizedTargetZoom - normalizedStartZoom);
        const optionsMinZoom = typeof options.minZoom === 'number';
        let scaleOfMinZoom;
        if (optionsMinZoom) {
            const normalizedOptionsMinZoom = +options.minZoom + getZoomAdjustment(targetCenter.lat, 0);
            const normalizedMinZoomPreConstrain = Math.min(normalizedOptionsMinZoom, normalizedStartZoom, normalizedTargetZoom);
            const minZoomPreConstrain = normalizedMinZoomPreConstrain + getZoomAdjustment(0, targetCenter.lat);
            const minZoom = tr.getConstrained(targetCenter, minZoomPreConstrain).zoom;
            const normalizedMinZoom = minZoom + getZoomAdjustment(targetCenter.lat, 0);
            scaleOfMinZoom = zoomScale(normalizedMinZoom - normalizedStartZoom);
        }
        const deltaLng = differenceOfAnglesDegrees(startCenter.lng, targetCenter.lng);
        const deltaLat = differenceOfAnglesDegrees(startCenter.lat, targetCenter.lat);
        const easeFunc = (k, scale, centerFactor, _pointAtOffset) => {
            const interpolatedCenter = interpolateLngLatForGlobe(startCenter, deltaLng, deltaLat, centerFactor);
            if (doPadding) {
                tr.interpolatePadding(startPadding, options.padding, k);
            }
            const newCenter = k === 1 ? targetCenter : interpolatedCenter;
            tr.setCenter(newCenter.wrap());
            const interpolatedZoom = normalizedStartZoom + scaleZoom(scale);
            tr.setZoom(k === 1 ? targetZoom : (interpolatedZoom + getZoomAdjustment(0, newCenter.lat)));
        };
        return {
            easeFunc,
            scaleOfZoom,
            targetCenter,
            scaleOfMinZoom,
            pixelPathLength,
        };
    }
    static solveVectorScale(vector, toCenter, projection, targetDimension, targetValue) {
        const k = targetValue;
        const columnXorY = targetDimension === 'x' ?
            [projection[0], projection[4], projection[8], projection[12]] :
            [projection[1], projection[5], projection[9], projection[13]];
        const columnZ = [projection[3], projection[7], projection[11], projection[15]];
        const vecDotXY = vector[0] * columnXorY[0] + vector[1] * columnXorY[1] + vector[2] * columnXorY[2];
        const vecDotZ = vector[0] * columnZ[0] + vector[1] * columnZ[1] + vector[2] * columnZ[2];
        const toCenterDotXY = toCenter[0] * columnXorY[0] + toCenter[1] * columnXorY[1] + toCenter[2] * columnXorY[2];
        const toCenterDotZ = toCenter[0] * columnZ[0] + toCenter[1] * columnZ[1] + toCenter[2] * columnZ[2];
        const t = (toCenterDotXY + columnXorY[3] - k * toCenterDotZ - k * columnZ[3]) / (toCenterDotXY - vecDotXY - k * toCenterDotZ + k * vecDotZ);
        if (toCenterDotXY + k * vecDotZ === vecDotXY + k * toCenterDotZ ||
            columnZ[3] * (vecDotXY - toCenterDotXY) + columnXorY[3] * (toCenterDotZ - vecDotZ) + vecDotXY * toCenterDotZ === toCenterDotXY * vecDotZ) {
            return null;
        }
        return t;
    }
    static getLesserNonNegativeNonNull(oldValue, newValue) {
        if (newValue !== null && newValue >= 0 && newValue < oldValue) {
            return newValue;
        }
        else {
            return oldValue;
        }
    }
}
//# sourceMappingURL=vertical_perspective_camera_helper.js.map