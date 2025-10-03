import Point from '@mapbox/point-geometry';
import { degreesToRadians, getRollPitchBearing, rollPitchBearingToQuat, scaleZoom, warnOnce, zoomScale } from '../../util/util';
import { quat } from 'gl-matrix';
import { interpolates } from '@maplibre/maplibre-gl-style-spec';
import { projectToWorldCoordinates, unprojectFromWorldCoordinates } from './mercator_utils';
export function cameraBoundsWarning() {
    warnOnce('Map cannot fit within canvas with the given bounds, padding, and/or offset.');
}
export function updateRotation(args) {
    if (args.useSlerp) {
        if (args.k < 1) {
            const startRotation = rollPitchBearingToQuat(args.startEulerAngles.roll, args.startEulerAngles.pitch, args.startEulerAngles.bearing);
            const endRotation = rollPitchBearingToQuat(args.endEulerAngles.roll, args.endEulerAngles.pitch, args.endEulerAngles.bearing);
            const rotation = new Float64Array(4);
            quat.slerp(rotation, startRotation, endRotation, args.k);
            const eulerAngles = getRollPitchBearing(rotation);
            args.tr.setRoll(eulerAngles.roll);
            args.tr.setPitch(eulerAngles.pitch);
            args.tr.setBearing(eulerAngles.bearing);
        }
        else {
            args.tr.setRoll(args.endEulerAngles.roll);
            args.tr.setPitch(args.endEulerAngles.pitch);
            args.tr.setBearing(args.endEulerAngles.bearing);
        }
    }
    else {
        args.tr.setRoll(interpolates.number(args.startEulerAngles.roll, args.endEulerAngles.roll, args.k));
        args.tr.setPitch(interpolates.number(args.startEulerAngles.pitch, args.endEulerAngles.pitch, args.k));
        args.tr.setBearing(interpolates.number(args.startEulerAngles.bearing, args.endEulerAngles.bearing, args.k));
    }
}
export function cameraForBoxAndBearing(options, padding, bounds, bearing, tr) {
    const edgePadding = tr.padding;
    const nwWorld = projectToWorldCoordinates(tr.worldSize, bounds.getNorthWest());
    const neWorld = projectToWorldCoordinates(tr.worldSize, bounds.getNorthEast());
    const seWorld = projectToWorldCoordinates(tr.worldSize, bounds.getSouthEast());
    const swWorld = projectToWorldCoordinates(tr.worldSize, bounds.getSouthWest());
    const bearingRadians = degreesToRadians(-bearing);
    const nwRotatedWorld = nwWorld.rotate(bearingRadians);
    const neRotatedWorld = neWorld.rotate(bearingRadians);
    const seRotatedWorld = seWorld.rotate(bearingRadians);
    const swRotatedWorld = swWorld.rotate(bearingRadians);
    const upperRight = new Point(Math.max(nwRotatedWorld.x, neRotatedWorld.x, swRotatedWorld.x, seRotatedWorld.x), Math.max(nwRotatedWorld.y, neRotatedWorld.y, swRotatedWorld.y, seRotatedWorld.y));
    const lowerLeft = new Point(Math.min(nwRotatedWorld.x, neRotatedWorld.x, swRotatedWorld.x, seRotatedWorld.x), Math.min(nwRotatedWorld.y, neRotatedWorld.y, swRotatedWorld.y, seRotatedWorld.y));
    const size = upperRight.sub(lowerLeft);
    const availableWidth = (tr.width - (edgePadding.left + edgePadding.right + padding.left + padding.right));
    const availableHeight = (tr.height - (edgePadding.top + edgePadding.bottom + padding.top + padding.bottom));
    const scaleX = availableWidth / size.x;
    const scaleY = availableHeight / size.y;
    if (scaleY < 0 || scaleX < 0) {
        cameraBoundsWarning();
        return undefined;
    }
    const zoom = Math.min(scaleZoom(tr.scale * Math.min(scaleX, scaleY)), options.maxZoom);
    const offset = Point.convert(options.offset);
    const paddingOffsetX = (padding.left - padding.right) / 2;
    const paddingOffsetY = (padding.top - padding.bottom) / 2;
    const paddingOffset = new Point(paddingOffsetX, paddingOffsetY);
    const rotatedPaddingOffset = paddingOffset.rotate(degreesToRadians(bearing));
    const offsetAtInitialZoom = offset.add(rotatedPaddingOffset);
    const offsetAtFinalZoom = offsetAtInitialZoom.mult(tr.scale / zoomScale(zoom));
    const center = unprojectFromWorldCoordinates(tr.worldSize, nwWorld.add(seWorld).div(2).sub(offsetAtFinalZoom));
    const result = {
        center,
        zoom,
        bearing
    };
    return result;
}
//# sourceMappingURL=camera_helper.js.map