import { LngLat } from './lng_lat';
import { LngLatBounds } from './lng_lat_bounds';
import Point from '@mapbox/point-geometry';
import { wrap, clamp, degreesToRadians, radiansToDegrees, zoomScale, MAX_VALID_LATITUDE, scaleZoom } from '../util/util';
import { mat4, mat2 } from 'gl-matrix';
import { EdgeInsets } from './edge_insets';
import { altitudeFromMercatorZ, MercatorCoordinate, mercatorZfromAltitude } from './mercator_coordinate';
import { cameraMercatorCoordinateFromCenterAndRotation } from './projection/mercator_utils';
import { EXTENT } from '../data/extent';
import { Bounds } from './bounds';
export function normalizeCenter(tr, center) {
    if (!tr.renderWorldCopies || tr.lngRange)
        return;
    const delta = center.lng - tr.center.lng;
    center.lng +=
        delta > 180 ? -360 :
            delta < -180 ? 360 : 0;
}
function getTileZoom(zoom) {
    return Math.max(0, Math.floor(zoom));
}
export class TransformHelper {
    constructor(callbacks, minZoom, maxZoom, minPitch, maxPitch, renderWorldCopies) {
        this._callbacks = callbacks;
        this._tileSize = 512;
        this._renderWorldCopies = renderWorldCopies === undefined ? true : !!renderWorldCopies;
        this._minZoom = minZoom || 0;
        this._maxZoom = maxZoom || 22;
        this._minPitch = (minPitch === undefined || minPitch === null) ? 0 : minPitch;
        this._maxPitch = (maxPitch === undefined || maxPitch === null) ? 60 : maxPitch;
        this.setMaxBounds();
        this._width = 0;
        this._height = 0;
        this._center = new LngLat(0, 0);
        this._elevation = 0;
        this._zoom = 0;
        this._tileZoom = getTileZoom(this._zoom);
        this._scale = zoomScale(this._zoom);
        this._bearingInRadians = 0;
        this._fovInRadians = 0.6435011087932844;
        this._pitchInRadians = 0;
        this._rollInRadians = 0;
        this._unmodified = true;
        this._edgeInsets = new EdgeInsets();
        this._minElevationForCurrentTile = 0;
        this._autoCalculateNearFarZ = true;
    }
    apply(thatI, constrain, forceOverrideZ) {
        this._latRange = thatI.latRange;
        this._lngRange = thatI.lngRange;
        this._width = thatI.width;
        this._height = thatI.height;
        this._center = thatI.center;
        this._elevation = thatI.elevation;
        this._minElevationForCurrentTile = thatI.minElevationForCurrentTile;
        this._zoom = thatI.zoom;
        this._tileZoom = getTileZoom(this._zoom);
        this._scale = zoomScale(this._zoom);
        this._bearingInRadians = thatI.bearingInRadians;
        this._fovInRadians = thatI.fovInRadians;
        this._pitchInRadians = thatI.pitchInRadians;
        this._rollInRadians = thatI.rollInRadians;
        this._unmodified = thatI.unmodified;
        this._edgeInsets = new EdgeInsets(thatI.padding.top, thatI.padding.bottom, thatI.padding.left, thatI.padding.right);
        this._minZoom = thatI.minZoom;
        this._maxZoom = thatI.maxZoom;
        this._minPitch = thatI.minPitch;
        this._maxPitch = thatI.maxPitch;
        this._renderWorldCopies = thatI.renderWorldCopies;
        this._cameraToCenterDistance = thatI.cameraToCenterDistance;
        this._nearZ = thatI.nearZ;
        this._farZ = thatI.farZ;
        this._autoCalculateNearFarZ = !forceOverrideZ && thatI.autoCalculateNearFarZ;
        if (constrain) {
            this._constrain();
        }
        this._calcMatrices();
    }
    get pixelsToClipSpaceMatrix() { return this._pixelsToClipSpaceMatrix; }
    get clipSpaceToPixelsMatrix() { return this._clipSpaceToPixelsMatrix; }
    get minElevationForCurrentTile() { return this._minElevationForCurrentTile; }
    setMinElevationForCurrentTile(ele) {
        this._minElevationForCurrentTile = ele;
    }
    get tileSize() { return this._tileSize; }
    get tileZoom() { return this._tileZoom; }
    get scale() { return this._scale; }
    get width() { return this._width; }
    get height() { return this._height; }
    get bearingInRadians() { return this._bearingInRadians; }
    get lngRange() { return this._lngRange; }
    get latRange() { return this._latRange; }
    get pixelsToGLUnits() { return this._pixelsToGLUnits; }
    get minZoom() { return this._minZoom; }
    setMinZoom(zoom) {
        if (this._minZoom === zoom)
            return;
        this._minZoom = zoom;
        this.setZoom(this.getConstrained(this._center, this.zoom).zoom);
    }
    get maxZoom() { return this._maxZoom; }
    setMaxZoom(zoom) {
        if (this._maxZoom === zoom)
            return;
        this._maxZoom = zoom;
        this.setZoom(this.getConstrained(this._center, this.zoom).zoom);
    }
    get minPitch() { return this._minPitch; }
    setMinPitch(pitch) {
        if (this._minPitch === pitch)
            return;
        this._minPitch = pitch;
        this.setPitch(Math.max(this.pitch, pitch));
    }
    get maxPitch() { return this._maxPitch; }
    setMaxPitch(pitch) {
        if (this._maxPitch === pitch)
            return;
        this._maxPitch = pitch;
        this.setPitch(Math.min(this.pitch, pitch));
    }
    get renderWorldCopies() { return this._renderWorldCopies; }
    setRenderWorldCopies(renderWorldCopies) {
        if (renderWorldCopies === undefined) {
            renderWorldCopies = true;
        }
        else if (renderWorldCopies === null) {
            renderWorldCopies = false;
        }
        this._renderWorldCopies = renderWorldCopies;
    }
    get worldSize() {
        return this._tileSize * this._scale;
    }
    get centerOffset() {
        return this.centerPoint._sub(this.size._div(2));
    }
    get size() {
        return new Point(this._width, this._height);
    }
    get bearing() {
        return this._bearingInRadians / Math.PI * 180;
    }
    setBearing(bearing) {
        const b = wrap(bearing, -180, 180) * Math.PI / 180;
        if (this._bearingInRadians === b)
            return;
        this._unmodified = false;
        this._bearingInRadians = b;
        this._calcMatrices();
        this._rotationMatrix = mat2.create();
        mat2.rotate(this._rotationMatrix, this._rotationMatrix, -this._bearingInRadians);
    }
    get rotationMatrix() { return this._rotationMatrix; }
    get pitchInRadians() {
        return this._pitchInRadians;
    }
    get pitch() {
        return this._pitchInRadians / Math.PI * 180;
    }
    setPitch(pitch) {
        const p = clamp(pitch, this.minPitch, this.maxPitch) / 180 * Math.PI;
        if (this._pitchInRadians === p)
            return;
        this._unmodified = false;
        this._pitchInRadians = p;
        this._calcMatrices();
    }
    get rollInRadians() {
        return this._rollInRadians;
    }
    get roll() {
        return this._rollInRadians / Math.PI * 180;
    }
    setRoll(roll) {
        const r = roll / 180 * Math.PI;
        if (this._rollInRadians === r)
            return;
        this._unmodified = false;
        this._rollInRadians = r;
        this._calcMatrices();
    }
    get fovInRadians() {
        return this._fovInRadians;
    }
    get fov() {
        return radiansToDegrees(this._fovInRadians);
    }
    setFov(fov) {
        fov = clamp(fov, 0.1, 150);
        if (this.fov === fov)
            return;
        this._unmodified = false;
        this._fovInRadians = degreesToRadians(fov);
        this._calcMatrices();
    }
    get zoom() { return this._zoom; }
    setZoom(zoom) {
        const constrainedZoom = this.getConstrained(this._center, zoom).zoom;
        if (this._zoom === constrainedZoom)
            return;
        this._unmodified = false;
        this._zoom = constrainedZoom;
        this._tileZoom = Math.max(0, Math.floor(constrainedZoom));
        this._scale = zoomScale(constrainedZoom);
        this._constrain();
        this._calcMatrices();
    }
    get center() { return this._center; }
    setCenter(center) {
        if (center.lat === this._center.lat && center.lng === this._center.lng)
            return;
        this._unmodified = false;
        this._center = center;
        this._constrain();
        this._calcMatrices();
    }
    get elevation() { return this._elevation; }
    setElevation(elevation) {
        if (elevation === this._elevation)
            return;
        this._elevation = elevation;
        this._constrain();
        this._calcMatrices();
    }
    get padding() { return this._edgeInsets.toJSON(); }
    setPadding(padding) {
        if (this._edgeInsets.equals(padding))
            return;
        this._unmodified = false;
        this._edgeInsets.interpolate(this._edgeInsets, padding, 1);
        this._calcMatrices();
    }
    get centerPoint() {
        return this._edgeInsets.getCenter(this._width, this._height);
    }
    get pixelsPerMeter() { return this._pixelPerMeter; }
    get unmodified() { return this._unmodified; }
    get cameraToCenterDistance() { return this._cameraToCenterDistance; }
    get nearZ() { return this._nearZ; }
    get farZ() { return this._farZ; }
    get autoCalculateNearFarZ() { return this._autoCalculateNearFarZ; }
    overrideNearFarZ(nearZ, farZ) {
        this._autoCalculateNearFarZ = false;
        this._nearZ = nearZ;
        this._farZ = farZ;
        this._calcMatrices();
    }
    clearNearFarZOverride() {
        this._autoCalculateNearFarZ = true;
        this._calcMatrices();
    }
    isPaddingEqual(padding) {
        return this._edgeInsets.equals(padding);
    }
    interpolatePadding(start, target, t) {
        this._unmodified = false;
        this._edgeInsets.interpolate(start, target, t);
        this._constrain();
        this._calcMatrices();
    }
    resize(width, height, constrain = true) {
        this._width = width;
        this._height = height;
        if (constrain)
            this._constrain();
        this._calcMatrices();
    }
    getMaxBounds() {
        if (!this._latRange || this._latRange.length !== 2 ||
            !this._lngRange || this._lngRange.length !== 2)
            return null;
        return new LngLatBounds([this._lngRange[0], this._latRange[0]], [this._lngRange[1], this._latRange[1]]);
    }
    setMaxBounds(bounds) {
        if (bounds) {
            this._lngRange = [bounds.getWest(), bounds.getEast()];
            this._latRange = [bounds.getSouth(), bounds.getNorth()];
            this._constrain();
        }
        else {
            this._lngRange = null;
            this._latRange = [-MAX_VALID_LATITUDE, MAX_VALID_LATITUDE];
        }
    }
    getConstrained(lngLat, zoom) {
        return this._callbacks.getConstrained(lngLat, zoom);
    }
    getCameraQueryGeometry(cameraPoint, queryGeometry) {
        if (queryGeometry.length === 1) {
            return [queryGeometry[0], cameraPoint];
        }
        else {
            const { minX, minY, maxX, maxY } = Bounds.fromPoints(queryGeometry).extend(cameraPoint);
            return [
                new Point(minX, minY),
                new Point(maxX, minY),
                new Point(maxX, maxY),
                new Point(minX, maxY),
                new Point(minX, minY)
            ];
        }
    }
    _constrain() {
        if (!this.center || !this._width || !this._height || this._constraining)
            return;
        this._constraining = true;
        const unmodified = this._unmodified;
        const { center, zoom } = this.getConstrained(this.center, this.zoom);
        this.setCenter(center);
        this.setZoom(zoom);
        this._unmodified = unmodified;
        this._constraining = false;
    }
    _calcMatrices() {
        if (this._width && this._height) {
            this._pixelsToGLUnits = [2 / this._width, -2 / this._height];
            let m = mat4.identity(new Float64Array(16));
            mat4.scale(m, m, [this._width / 2, -this._height / 2, 1]);
            mat4.translate(m, m, [1, -1, 0]);
            this._clipSpaceToPixelsMatrix = m;
            m = mat4.identity(new Float64Array(16));
            mat4.scale(m, m, [1, -1, 1]);
            mat4.translate(m, m, [-1, -1, 0]);
            mat4.scale(m, m, [2 / this._width, 2 / this._height, 1]);
            this._pixelsToClipSpaceMatrix = m;
            const halfFov = this.fovInRadians / 2;
            this._cameraToCenterDistance = 0.5 / Math.tan(halfFov) * this._height;
        }
        this._callbacks.calcMatrices();
    }
    calculateCenterFromCameraLngLatAlt(lnglat, alt, bearing, pitch) {
        const cameraBearing = bearing !== undefined ? bearing : this.bearing;
        const cameraPitch = pitch = pitch !== undefined ? pitch : this.pitch;
        const camMercator = MercatorCoordinate.fromLngLat(lnglat, alt);
        const dzNormalized = -Math.cos(degreesToRadians(cameraPitch));
        const dhNormalized = Math.sin(degreesToRadians(cameraPitch));
        const dxNormalized = dhNormalized * Math.sin(degreesToRadians(cameraBearing));
        const dyNormalized = -dhNormalized * Math.cos(degreesToRadians(cameraBearing));
        let elevation = this.elevation;
        const altitudeAGL = alt - elevation;
        let distanceToCenterMeters;
        if (dzNormalized * altitudeAGL >= 0.0 || Math.abs(dzNormalized) < 0.1) {
            distanceToCenterMeters = 10000;
            elevation = alt + distanceToCenterMeters * dzNormalized;
        }
        else {
            distanceToCenterMeters = -altitudeAGL / dzNormalized;
        }
        let metersPerMercUnit = altitudeFromMercatorZ(1, camMercator.y);
        let centerMercator;
        let dMercator;
        let iter = 0;
        const maxIter = 10;
        do {
            iter += 1;
            if (iter > maxIter) {
                break;
            }
            dMercator = distanceToCenterMeters / metersPerMercUnit;
            const dx = dxNormalized * dMercator;
            const dy = dyNormalized * dMercator;
            centerMercator = new MercatorCoordinate(camMercator.x + dx, camMercator.y + dy);
            metersPerMercUnit = 1 / centerMercator.meterInMercatorCoordinateUnits();
        } while (Math.abs(distanceToCenterMeters - dMercator * metersPerMercUnit) > 1.0e-12);
        const center = centerMercator.toLngLat();
        const zoom = scaleZoom(this.height / 2 / Math.tan(this.fovInRadians / 2) / dMercator / this.tileSize);
        return { center, elevation, zoom };
    }
    recalculateZoomAndCenter(elevation) {
        if (this.elevation - elevation === 0)
            return;
        const originalPixelPerMeter = mercatorZfromAltitude(1, this.center.lat) * this.worldSize;
        const cameraToCenterDistanceMeters = this.cameraToCenterDistance / originalPixelPerMeter;
        const origCenterMercator = MercatorCoordinate.fromLngLat(this.center, this.elevation);
        const cameraMercator = cameraMercatorCoordinateFromCenterAndRotation(this.center, this.elevation, this.pitch, this.bearing, cameraToCenterDistanceMeters);
        this._elevation = elevation;
        const centerInfo = this.calculateCenterFromCameraLngLatAlt(cameraMercator.toLngLat(), altitudeFromMercatorZ(cameraMercator.z, origCenterMercator.y), this.bearing, this.pitch);
        this._elevation = centerInfo.elevation;
        this._center = centerInfo.center;
        this.setZoom(centerInfo.zoom);
    }
    getCameraPoint() {
        const pitch = this.pitchInRadians;
        const offset = Math.tan(pitch) * (this.cameraToCenterDistance || 1);
        return this.centerPoint.add(new Point(offset * Math.sin(this.rollInRadians), offset * Math.cos(this.rollInRadians)));
    }
    getCameraAltitude() {
        const altitude = Math.cos(this.pitchInRadians) * this._cameraToCenterDistance / this._pixelPerMeter;
        return altitude + this.elevation;
    }
    getCameraLngLat() {
        const pixelPerMeter = mercatorZfromAltitude(1, this.center.lat) * this.worldSize;
        const cameraToCenterDistanceMeters = this.cameraToCenterDistance / pixelPerMeter;
        const camMercator = cameraMercatorCoordinateFromCenterAndRotation(this.center, this.elevation, this.pitch, this.bearing, cameraToCenterDistanceMeters);
        return camMercator.toLngLat();
    }
    getMercatorTileCoordinates(overscaledTileID) {
        if (!overscaledTileID) {
            return [0, 0, 1, 1];
        }
        const scale = (overscaledTileID.canonical.z >= 0) ? (1 << overscaledTileID.canonical.z) : Math.pow(2.0, overscaledTileID.canonical.z);
        return [
            overscaledTileID.canonical.x / scale,
            overscaledTileID.canonical.y / scale,
            1.0 / scale / EXTENT,
            1.0 / scale / EXTENT
        ];
    }
}
//# sourceMappingURL=transform_helper.js.map