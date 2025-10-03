import { extend, wrap, defaultEasing, pick, scaleZoom } from '../util/util';
import { interpolates } from '@maplibre/maplibre-gl-style-spec';
import { browser } from '../util/browser';
import { LngLat } from '../geo/lng_lat';
import { LngLatBounds } from '../geo/lng_lat_bounds';
import Point from '@mapbox/point-geometry';
import { Event, Evented } from '../util/evented';
import { MercatorCoordinate } from '../geo/mercator_coordinate';
export class Camera extends Evented {
    constructor(transform, cameraHelper, options) {
        super();
        this._renderFrameCallback = () => {
            const t = Math.min((browser.now() - this._easeStart) / this._easeOptions.duration, 1);
            this._onEaseFrame(this._easeOptions.easing(t));
            if (t < 1 && this._easeFrameId) {
                this._easeFrameId = this._requestRenderFrame(this._renderFrameCallback);
            }
            else {
                this.stop();
            }
        };
        this._moving = false;
        this._zooming = false;
        this.transform = transform;
        this._bearingSnap = options.bearingSnap;
        this.cameraHelper = cameraHelper;
        this.on('moveend', () => {
            delete this._requestedCameraState;
        });
    }
    migrateProjection(newTransform, newCameraHelper) {
        newTransform.apply(this.transform);
        this.transform = newTransform;
        this.cameraHelper = newCameraHelper;
    }
    getCenter() { return new LngLat(this.transform.center.lng, this.transform.center.lat); }
    setCenter(center, eventData) {
        return this.jumpTo({ center }, eventData);
    }
    getCenterElevation() { return this.transform.elevation; }
    setCenterElevation(elevation, eventData) {
        this.jumpTo({ elevation }, eventData);
        return this;
    }
    getCenterClampedToGround() { return this._centerClampedToGround; }
    setCenterClampedToGround(centerClampedToGround) {
        this._centerClampedToGround = centerClampedToGround;
    }
    panBy(offset, options, eventData) {
        offset = Point.convert(offset).mult(-1);
        return this.panTo(this.transform.center, extend({ offset }, options), eventData);
    }
    panTo(lnglat, options, eventData) {
        return this.easeTo(extend({
            center: lnglat
        }, options), eventData);
    }
    getZoom() { return this.transform.zoom; }
    setZoom(zoom, eventData) {
        this.jumpTo({ zoom }, eventData);
        return this;
    }
    zoomTo(zoom, options, eventData) {
        return this.easeTo(extend({
            zoom
        }, options), eventData);
    }
    zoomIn(options, eventData) {
        this.zoomTo(this.getZoom() + 1, options, eventData);
        return this;
    }
    zoomOut(options, eventData) {
        this.zoomTo(this.getZoom() - 1, options, eventData);
        return this;
    }
    getVerticalFieldOfView() { return this.transform.fov; }
    setVerticalFieldOfView(fov, eventData) {
        if (fov != this.transform.fov) {
            this.transform.setFov(fov);
            this.fire(new Event('movestart', eventData))
                .fire(new Event('move', eventData))
                .fire(new Event('moveend', eventData));
        }
        return this;
    }
    getBearing() { return this.transform.bearing; }
    setBearing(bearing, eventData) {
        this.jumpTo({ bearing }, eventData);
        return this;
    }
    getPadding() { return this.transform.padding; }
    setPadding(padding, eventData) {
        this.jumpTo({ padding }, eventData);
        return this;
    }
    rotateTo(bearing, options, eventData) {
        return this.easeTo(extend({
            bearing
        }, options), eventData);
    }
    resetNorth(options, eventData) {
        this.rotateTo(0, extend({ duration: 1000 }, options), eventData);
        return this;
    }
    resetNorthPitch(options, eventData) {
        this.easeTo(extend({
            bearing: 0,
            pitch: 0,
            roll: 0,
            duration: 1000
        }, options), eventData);
        return this;
    }
    snapToNorth(options, eventData) {
        if (Math.abs(this.getBearing()) < this._bearingSnap) {
            return this.resetNorth(options, eventData);
        }
        return this;
    }
    getPitch() { return this.transform.pitch; }
    setPitch(pitch, eventData) {
        this.jumpTo({ pitch }, eventData);
        return this;
    }
    getRoll() { return this.transform.roll; }
    setRoll(roll, eventData) {
        this.jumpTo({ roll }, eventData);
        return this;
    }
    cameraForBounds(bounds, options) {
        bounds = LngLatBounds.convert(bounds).adjustAntiMeridian();
        const bearing = options && options.bearing || 0;
        return this._cameraForBoxAndBearing(bounds.getNorthWest(), bounds.getSouthEast(), bearing, options);
    }
    _cameraForBoxAndBearing(p0, p1, bearing, options) {
        const defaultPadding = {
            top: 0,
            bottom: 0,
            right: 0,
            left: 0
        };
        options = extend({
            padding: defaultPadding,
            offset: [0, 0],
            maxZoom: this.transform.maxZoom
        }, options);
        if (typeof options.padding === 'number') {
            const p = options.padding;
            options.padding = {
                top: p,
                bottom: p,
                right: p,
                left: p
            };
        }
        const padding = extend(defaultPadding, options.padding);
        options.padding = padding;
        const tr = this.transform;
        const bounds = new LngLatBounds(p0, p1);
        return this.cameraHelper.cameraForBoxAndBearing(options, padding, bounds, bearing, tr);
    }
    fitBounds(bounds, options, eventData) {
        return this._fitInternal(this.cameraForBounds(bounds, options), options, eventData);
    }
    fitScreenCoordinates(p0, p1, bearing, options, eventData) {
        return this._fitInternal(this._cameraForBoxAndBearing(this.transform.screenPointToLocation(Point.convert(p0)), this.transform.screenPointToLocation(Point.convert(p1)), bearing, options), options, eventData);
    }
    _fitInternal(calculatedOptions, options, eventData) {
        if (!calculatedOptions)
            return this;
        options = extend(calculatedOptions, options);
        delete options.padding;
        return options.linear ?
            this.easeTo(options, eventData) :
            this.flyTo(options, eventData);
    }
    jumpTo(options, eventData) {
        this.stop();
        const tr = this._getTransformForUpdate();
        let bearingChanged = false, pitchChanged = false;
        let rollChanged = false;
        const oldZoom = tr.zoom;
        this.cameraHelper.handleJumpToCenterZoom(tr, options);
        const zoomChanged = tr.zoom !== oldZoom;
        if ('elevation' in options && tr.elevation !== +options.elevation) {
            tr.setElevation(+options.elevation);
        }
        if ('bearing' in options && tr.bearing !== +options.bearing) {
            bearingChanged = true;
            tr.setBearing(+options.bearing);
        }
        if ('pitch' in options && tr.pitch !== +options.pitch) {
            pitchChanged = true;
            tr.setPitch(+options.pitch);
        }
        if ('roll' in options && tr.roll !== +options.roll) {
            rollChanged = true;
            tr.setRoll(+options.roll);
        }
        if (options.padding != null && !tr.isPaddingEqual(options.padding)) {
            tr.setPadding(options.padding);
        }
        this._applyUpdatedTransform(tr);
        this.fire(new Event('movestart', eventData))
            .fire(new Event('move', eventData));
        if (zoomChanged) {
            this.fire(new Event('zoomstart', eventData))
                .fire(new Event('zoom', eventData))
                .fire(new Event('zoomend', eventData));
        }
        if (bearingChanged) {
            this.fire(new Event('rotatestart', eventData))
                .fire(new Event('rotate', eventData))
                .fire(new Event('rotateend', eventData));
        }
        if (pitchChanged) {
            this.fire(new Event('pitchstart', eventData))
                .fire(new Event('pitch', eventData))
                .fire(new Event('pitchend', eventData));
        }
        if (rollChanged) {
            this.fire(new Event('rollstart', eventData))
                .fire(new Event('roll', eventData))
                .fire(new Event('rollend', eventData));
        }
        return this.fire(new Event('moveend', eventData));
    }
    calculateCameraOptionsFromTo(from, altitudeFrom, to, altitudeTo = 0) {
        const fromMercator = MercatorCoordinate.fromLngLat(from, altitudeFrom);
        const toMercator = MercatorCoordinate.fromLngLat(to, altitudeTo);
        const dx = toMercator.x - fromMercator.x;
        const dy = toMercator.y - fromMercator.y;
        const dz = toMercator.z - fromMercator.z;
        const distance3D = Math.hypot(dx, dy, dz);
        if (distance3D === 0)
            throw new Error('Can\'t calculate camera options with same From and To');
        const groundDistance = Math.hypot(dx, dy);
        const zoom = scaleZoom(this.transform.cameraToCenterDistance / distance3D / this.transform.tileSize);
        const bearing = (Math.atan2(dx, -dy) * 180) / Math.PI;
        let pitch = (Math.acos(groundDistance / distance3D) * 180) / Math.PI;
        pitch = dz < 0 ? 90 - pitch : 90 + pitch;
        return {
            center: toMercator.toLngLat(),
            elevation: altitudeTo,
            zoom,
            pitch,
            bearing
        };
    }
    calculateCameraOptionsFromCameraLngLatAltRotation(cameraLngLat, cameraAlt, bearing, pitch, roll) {
        const centerInfo = this.transform.calculateCenterFromCameraLngLatAlt(cameraLngLat, cameraAlt, bearing, pitch);
        return {
            center: centerInfo.center,
            elevation: centerInfo.elevation,
            zoom: centerInfo.zoom,
            bearing,
            pitch,
            roll
        };
    }
    easeTo(options, eventData) {
        this._stop(false, options.easeId);
        options = extend({
            offset: [0, 0],
            duration: 500,
            easing: defaultEasing
        }, options);
        if (options.animate === false || (!options.essential && browser.prefersReducedMotion)) {
            options.duration = 0;
        }
        const tr = this._getTransformForUpdate();
        const startBearing = this.getBearing(), startPitch = tr.pitch, startRoll = tr.roll, bearing = 'bearing' in options ? this._normalizeBearing(options.bearing, startBearing) : startBearing, pitch = 'pitch' in options ? +options.pitch : startPitch, roll = 'roll' in options ? this._normalizeBearing(options.roll, startRoll) : startRoll, padding = ('padding' in options ? options.padding : tr.padding);
        const offsetAsPoint = Point.convert(options.offset);
        let around, aroundPoint;
        if (options.around) {
            around = LngLat.convert(options.around);
            aroundPoint = tr.locationToScreenPoint(around);
        }
        const currently = {
            moving: this._moving,
            zooming: this._zooming,
            rotating: this._rotating,
            pitching: this._pitching,
            rolling: this._rolling
        };
        const easeHandler = this.cameraHelper.handleEaseTo(tr, {
            bearing,
            pitch,
            roll,
            padding,
            around,
            aroundPoint,
            offsetAsPoint,
            offset: options.offset,
            zoom: options.zoom,
            center: options.center,
        });
        this._rotating = this._rotating || (startBearing !== bearing);
        this._pitching = this._pitching || (pitch !== startPitch);
        this._rolling = this._rolling || (roll !== startRoll);
        this._padding = !tr.isPaddingEqual(padding);
        this._zooming = this._zooming || easeHandler.isZooming;
        this._easeId = options.easeId;
        this._prepareEase(eventData, options.noMoveStart, currently);
        if (this.terrain) {
            this._prepareElevation(easeHandler.elevationCenter);
        }
        this._ease((k) => {
            easeHandler.easeFunc(k);
            if (this.terrain && !options.freezeElevation)
                this._updateElevation(k);
            this._applyUpdatedTransform(tr);
            this._fireMoveEvents(eventData);
        }, (interruptingEaseId) => {
            if (this.terrain && options.freezeElevation)
                this._finalizeElevation();
            this._afterEase(eventData, interruptingEaseId);
        }, options);
        return this;
    }
    _prepareEase(eventData, noMoveStart, currently = {}) {
        this._moving = true;
        if (!noMoveStart && !currently.moving) {
            this.fire(new Event('movestart', eventData));
        }
        if (this._zooming && !currently.zooming) {
            this.fire(new Event('zoomstart', eventData));
        }
        if (this._rotating && !currently.rotating) {
            this.fire(new Event('rotatestart', eventData));
        }
        if (this._pitching && !currently.pitching) {
            this.fire(new Event('pitchstart', eventData));
        }
        if (this._rolling && !currently.rolling) {
            this.fire(new Event('rollstart', eventData));
        }
    }
    _prepareElevation(center) {
        this._elevationCenter = center;
        this._elevationStart = this.transform.elevation;
        this._elevationTarget = this.terrain.getElevationForLngLatZoom(center, this.transform.tileZoom);
        this._elevationFreeze = true;
    }
    _updateElevation(k) {
        if (this._elevationStart === undefined || this._elevationCenter === undefined) {
            this._prepareElevation(this.transform.center);
        }
        this.transform.setMinElevationForCurrentTile(this.terrain.getMinTileElevationForLngLatZoom(this._elevationCenter, this.transform.tileZoom));
        const elevation = this.terrain.getElevationForLngLatZoom(this._elevationCenter, this.transform.tileZoom);
        if (k < 1 && elevation !== this._elevationTarget) {
            const pitch1 = this._elevationTarget - this._elevationStart;
            const pitch2 = (elevation - (pitch1 * k + this._elevationStart)) / (1 - k);
            this._elevationStart += k * (pitch1 - pitch2);
            this._elevationTarget = elevation;
        }
        this.transform.setElevation(interpolates.number(this._elevationStart, this._elevationTarget, k));
    }
    _finalizeElevation() {
        this._elevationFreeze = false;
        if (this.getCenterClampedToGround()) {
            this.transform.recalculateZoomAndCenter(this.terrain);
        }
    }
    _getTransformForUpdate() {
        if (!this.transformCameraUpdate && !this.terrain)
            return this.transform;
        if (!this._requestedCameraState) {
            this._requestedCameraState = this.transform.clone();
        }
        return this._requestedCameraState;
    }
    _elevateCameraIfInsideTerrain(tr) {
        if (!this.terrain && tr.elevation >= 0 && tr.pitch <= 90) {
            return {};
        }
        const cameraLngLat = tr.getCameraLngLat();
        const cameraAltitude = tr.getCameraAltitude();
        const minAltitude = this.terrain ? this.terrain.getElevationForLngLatZoom(cameraLngLat, tr.zoom) : 0;
        if (cameraAltitude < minAltitude) {
            const newCamera = this.calculateCameraOptionsFromTo(cameraLngLat, minAltitude, tr.center, tr.elevation);
            return {
                pitch: newCamera.pitch,
                zoom: newCamera.zoom,
            };
        }
        return {};
    }
    _applyUpdatedTransform(tr) {
        const modifiers = [];
        modifiers.push(tr => this._elevateCameraIfInsideTerrain(tr));
        if (this.transformCameraUpdate) {
            modifiers.push(tr => this.transformCameraUpdate(tr));
        }
        if (!modifiers.length) {
            return;
        }
        const finalTransform = tr.clone();
        for (const modifier of modifiers) {
            const nextTransform = finalTransform.clone();
            const { center, zoom, roll, pitch, bearing, elevation } = modifier(nextTransform);
            if (center)
                nextTransform.setCenter(center);
            if (elevation !== undefined)
                nextTransform.setElevation(elevation);
            if (zoom !== undefined)
                nextTransform.setZoom(zoom);
            if (roll !== undefined)
                nextTransform.setRoll(roll);
            if (pitch !== undefined)
                nextTransform.setPitch(pitch);
            if (bearing !== undefined)
                nextTransform.setBearing(bearing);
            finalTransform.apply(nextTransform);
        }
        this.transform.apply(finalTransform);
    }
    _fireMoveEvents(eventData) {
        this.fire(new Event('move', eventData));
        if (this._zooming) {
            this.fire(new Event('zoom', eventData));
        }
        if (this._rotating) {
            this.fire(new Event('rotate', eventData));
        }
        if (this._pitching) {
            this.fire(new Event('pitch', eventData));
        }
        if (this._rolling) {
            this.fire(new Event('roll', eventData));
        }
    }
    _afterEase(eventData, easeId) {
        if (this._easeId && easeId && this._easeId === easeId) {
            return;
        }
        delete this._easeId;
        const wasZooming = this._zooming;
        const wasRotating = this._rotating;
        const wasPitching = this._pitching;
        const wasRolling = this._rolling;
        this._moving = false;
        this._zooming = false;
        this._rotating = false;
        this._pitching = false;
        this._rolling = false;
        this._padding = false;
        if (wasZooming) {
            this.fire(new Event('zoomend', eventData));
        }
        if (wasRotating) {
            this.fire(new Event('rotateend', eventData));
        }
        if (wasPitching) {
            this.fire(new Event('pitchend', eventData));
        }
        if (wasRolling) {
            this.fire(new Event('rollend', eventData));
        }
        this.fire(new Event('moveend', eventData));
    }
    flyTo(options, eventData) {
        if (!options.essential && browser.prefersReducedMotion) {
            const coercedOptions = pick(options, ['center', 'zoom', 'bearing', 'pitch', 'roll', 'elevation']);
            return this.jumpTo(coercedOptions, eventData);
        }
        this.stop();
        options = extend({
            offset: [0, 0],
            speed: 1.2,
            curve: 1.42,
            easing: defaultEasing
        }, options);
        const tr = this._getTransformForUpdate(), startBearing = tr.bearing, startPitch = tr.pitch, startRoll = tr.roll, startPadding = tr.padding;
        const bearing = 'bearing' in options ? this._normalizeBearing(options.bearing, startBearing) : startBearing;
        const pitch = 'pitch' in options ? +options.pitch : startPitch;
        const roll = 'roll' in options ? this._normalizeBearing(options.roll, startRoll) : startRoll;
        const padding = ('padding' in options ? options.padding : tr.padding);
        const offsetAsPoint = Point.convert(options.offset);
        let pointAtOffset = tr.centerPoint.add(offsetAsPoint);
        const locationAtOffset = tr.screenPointToLocation(pointAtOffset);
        const flyToHandler = this.cameraHelper.handleFlyTo(tr, {
            bearing,
            pitch,
            roll,
            padding,
            locationAtOffset,
            offsetAsPoint,
            center: options.center,
            minZoom: options.minZoom,
            zoom: options.zoom,
        });
        let rho = options.curve;
        const w0 = Math.max(tr.width, tr.height);
        const w1 = w0 / flyToHandler.scaleOfZoom;
        const u1 = flyToHandler.pixelPathLength;
        if (typeof flyToHandler.scaleOfMinZoom === 'number') {
            const wMax = w0 / flyToHandler.scaleOfMinZoom;
            rho = Math.sqrt(wMax / u1 * 2);
        }
        const rho2 = rho * rho;
        function zoomOutFactor(descent) {
            const b = (w1 * w1 - w0 * w0 + (descent ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (descent ? w1 : w0) * rho2 * u1);
            return Math.log(Math.sqrt(b * b + 1) - b);
        }
        function sinh(n) { return (Math.exp(n) - Math.exp(-n)) / 2; }
        function cosh(n) { return (Math.exp(n) + Math.exp(-n)) / 2; }
        function tanh(n) { return sinh(n) / cosh(n); }
        const r0 = zoomOutFactor(false);
        let w = function (s) {
            return (cosh(r0) / cosh(r0 + rho * s));
        };
        let u = function (s) {
            return w0 * ((cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2) / u1;
        };
        let S = (zoomOutFactor(true) - r0) / rho;
        if (Math.abs(u1) < 0.000002 || !isFinite(S)) {
            if (Math.abs(w0 - w1) < 0.000001)
                return this.easeTo(options, eventData);
            const k = w1 < w0 ? -1 : 1;
            S = Math.abs(Math.log(w1 / w0)) / rho;
            u = () => 0;
            w = (s) => Math.exp(k * rho * s);
        }
        if ('duration' in options) {
            options.duration = +options.duration;
        }
        else {
            const V = 'screenSpeed' in options ? +options.screenSpeed / rho : +options.speed;
            options.duration = 1000 * S / V;
        }
        if (options.maxDuration && options.duration > options.maxDuration) {
            options.duration = 0;
        }
        this._zooming = true;
        this._rotating = (startBearing !== bearing);
        this._pitching = (pitch !== startPitch);
        this._rolling = (roll !== startRoll);
        this._padding = !tr.isPaddingEqual(padding);
        this._prepareEase(eventData, false);
        if (this.terrain)
            this._prepareElevation(flyToHandler.targetCenter);
        this._ease((k) => {
            const s = k * S;
            const scale = 1 / w(s);
            const centerFactor = u(s);
            if (this._rotating) {
                tr.setBearing(interpolates.number(startBearing, bearing, k));
            }
            if (this._pitching) {
                tr.setPitch(interpolates.number(startPitch, pitch, k));
            }
            if (this._rolling) {
                tr.setRoll(interpolates.number(startRoll, roll, k));
            }
            if (this._padding) {
                tr.interpolatePadding(startPadding, padding, k);
                pointAtOffset = tr.centerPoint.add(offsetAsPoint);
            }
            flyToHandler.easeFunc(k, scale, centerFactor, pointAtOffset);
            if (this.terrain && !options.freezeElevation)
                this._updateElevation(k);
            this._applyUpdatedTransform(tr);
            this._fireMoveEvents(eventData);
        }, () => {
            if (this.terrain && options.freezeElevation)
                this._finalizeElevation();
            this._afterEase(eventData);
        }, options);
        return this;
    }
    isEasing() {
        return !!this._easeFrameId;
    }
    stop() {
        return this._stop();
    }
    _stop(allowGestures, easeId) {
        var _a;
        if (this._easeFrameId) {
            this._cancelRenderFrame(this._easeFrameId);
            delete this._easeFrameId;
            delete this._onEaseFrame;
        }
        if (this._onEaseEnd) {
            const onEaseEnd = this._onEaseEnd;
            delete this._onEaseEnd;
            onEaseEnd.call(this, easeId);
        }
        if (!allowGestures) {
            (_a = this.handlers) === null || _a === void 0 ? void 0 : _a.stop(false);
        }
        return this;
    }
    _ease(frame, finish, options) {
        if (options.animate === false || options.duration === 0) {
            frame(1);
            finish();
        }
        else {
            this._easeStart = browser.now();
            this._easeOptions = options;
            this._onEaseFrame = frame;
            this._onEaseEnd = finish;
            this._easeFrameId = this._requestRenderFrame(this._renderFrameCallback);
        }
    }
    _normalizeBearing(bearing, currentBearing) {
        bearing = wrap(bearing, -180, 180);
        const diff = Math.abs(bearing - currentBearing);
        if (Math.abs(bearing - 360 - currentBearing) < diff)
            bearing -= 360;
        if (Math.abs(bearing + 360 - currentBearing) < diff)
            bearing += 360;
        return bearing;
    }
    queryTerrainElevation(lngLatLike) {
        if (!this.terrain) {
            return null;
        }
        return this.terrain.getElevationForLngLatZoom(LngLat.convert(lngLatLike), this.transform.tileZoom);
    }
}
//# sourceMappingURL=camera.js.map