import { LngLat } from '../lng_lat';
import { MercatorCoordinate, mercatorXfromLng, mercatorYfromLat, mercatorZfromAltitude } from '../mercator_coordinate';
import Point from '@mapbox/point-geometry';
import { wrap, clamp, createIdentityMat4f64, createMat4f64, degreesToRadians, createIdentityMat4f32, zoomScale, scaleZoom } from '../../util/util';
import { mat4, vec3, vec4 } from 'gl-matrix';
import { UnwrappedTileID, OverscaledTileID, calculateTileKey } from '../../source/tile_id';
import { interpolates } from '@maplibre/maplibre-gl-style-spec';
import { xyTransformMat4 } from '../../symbol/projection';
import { LngLatBounds } from '../lng_lat_bounds';
import { getMercatorHorizon, projectToWorldCoordinates, unprojectFromWorldCoordinates, calculateTileMatrix, maxMercatorHorizonAngle, cameraMercatorCoordinateFromCenterAndRotation } from './mercator_utils';
import { EXTENT } from '../../data/extent';
import { TransformHelper } from '../transform_helper';
import { MercatorCoveringTilesDetailsProvider } from './mercator_covering_tiles_details_provider';
import { Frustum } from '../../util/primitives/frustum';
export class MercatorTransform {
    get pixelsToClipSpaceMatrix() {
        return this._helper.pixelsToClipSpaceMatrix;
    }
    get clipSpaceToPixelsMatrix() {
        return this._helper.clipSpaceToPixelsMatrix;
    }
    get pixelsToGLUnits() {
        return this._helper.pixelsToGLUnits;
    }
    get centerOffset() {
        return this._helper.centerOffset;
    }
    get size() {
        return this._helper.size;
    }
    get rotationMatrix() {
        return this._helper.rotationMatrix;
    }
    get centerPoint() {
        return this._helper.centerPoint;
    }
    get pixelsPerMeter() {
        return this._helper.pixelsPerMeter;
    }
    setMinZoom(zoom) {
        this._helper.setMinZoom(zoom);
    }
    setMaxZoom(zoom) {
        this._helper.setMaxZoom(zoom);
    }
    setMinPitch(pitch) {
        this._helper.setMinPitch(pitch);
    }
    setMaxPitch(pitch) {
        this._helper.setMaxPitch(pitch);
    }
    setRenderWorldCopies(renderWorldCopies) {
        this._helper.setRenderWorldCopies(renderWorldCopies);
    }
    setBearing(bearing) {
        this._helper.setBearing(bearing);
    }
    setPitch(pitch) {
        this._helper.setPitch(pitch);
    }
    setRoll(roll) {
        this._helper.setRoll(roll);
    }
    setFov(fov) {
        this._helper.setFov(fov);
    }
    setZoom(zoom) {
        this._helper.setZoom(zoom);
    }
    setCenter(center) {
        this._helper.setCenter(center);
    }
    setElevation(elevation) {
        this._helper.setElevation(elevation);
    }
    setMinElevationForCurrentTile(elevation) {
        this._helper.setMinElevationForCurrentTile(elevation);
    }
    setPadding(padding) {
        this._helper.setPadding(padding);
    }
    interpolatePadding(start, target, t) {
        return this._helper.interpolatePadding(start, target, t);
    }
    isPaddingEqual(padding) {
        return this._helper.isPaddingEqual(padding);
    }
    resize(width, height, constrain = true) {
        this._helper.resize(width, height, constrain);
    }
    getMaxBounds() {
        return this._helper.getMaxBounds();
    }
    setMaxBounds(bounds) {
        this._helper.setMaxBounds(bounds);
    }
    overrideNearFarZ(nearZ, farZ) {
        this._helper.overrideNearFarZ(nearZ, farZ);
    }
    clearNearFarZOverride() {
        this._helper.clearNearFarZOverride();
    }
    getCameraQueryGeometry(queryGeometry) {
        return this._helper.getCameraQueryGeometry(this.getCameraPoint(), queryGeometry);
    }
    get tileSize() {
        return this._helper.tileSize;
    }
    get tileZoom() {
        return this._helper.tileZoom;
    }
    get scale() {
        return this._helper.scale;
    }
    get worldSize() {
        return this._helper.worldSize;
    }
    get width() {
        return this._helper.width;
    }
    get height() {
        return this._helper.height;
    }
    get lngRange() {
        return this._helper.lngRange;
    }
    get latRange() {
        return this._helper.latRange;
    }
    get minZoom() {
        return this._helper.minZoom;
    }
    get maxZoom() {
        return this._helper.maxZoom;
    }
    get zoom() {
        return this._helper.zoom;
    }
    get center() {
        return this._helper.center;
    }
    get minPitch() {
        return this._helper.minPitch;
    }
    get maxPitch() {
        return this._helper.maxPitch;
    }
    get pitch() {
        return this._helper.pitch;
    }
    get pitchInRadians() {
        return this._helper.pitchInRadians;
    }
    get roll() {
        return this._helper.roll;
    }
    get rollInRadians() {
        return this._helper.rollInRadians;
    }
    get bearing() {
        return this._helper.bearing;
    }
    get bearingInRadians() {
        return this._helper.bearingInRadians;
    }
    get fov() {
        return this._helper.fov;
    }
    get fovInRadians() {
        return this._helper.fovInRadians;
    }
    get elevation() {
        return this._helper.elevation;
    }
    get minElevationForCurrentTile() {
        return this._helper.minElevationForCurrentTile;
    }
    get padding() {
        return this._helper.padding;
    }
    get unmodified() {
        return this._helper.unmodified;
    }
    get renderWorldCopies() {
        return this._helper.renderWorldCopies;
    }
    get cameraToCenterDistance() {
        return this._helper.cameraToCenterDistance;
    }
    get nearZ() {
        return this._helper.nearZ;
    }
    get farZ() {
        return this._helper.farZ;
    }
    get autoCalculateNearFarZ() {
        return this._helper.autoCalculateNearFarZ;
    }
    setTransitionState(_value, _error) {
    }
    constructor(minZoom, maxZoom, minPitch, maxPitch, renderWorldCopies) {
        this._posMatrixCache = new Map();
        this._alignedPosMatrixCache = new Map();
        this._fogMatrixCacheF32 = new Map();
        this._helper = new TransformHelper({
            calcMatrices: () => { this._calcMatrices(); },
            getConstrained: (center, zoom) => { return this.getConstrained(center, zoom); }
        }, minZoom, maxZoom, minPitch, maxPitch, renderWorldCopies);
        this._coveringTilesDetailsProvider = new MercatorCoveringTilesDetailsProvider();
    }
    clone() {
        const clone = new MercatorTransform();
        clone.apply(this);
        return clone;
    }
    apply(that, constrain, forceOverrideZ) {
        this._helper.apply(that, constrain, forceOverrideZ);
    }
    get cameraPosition() { return this._cameraPosition; }
    get projectionMatrix() { return this._projectionMatrix; }
    get modelViewProjectionMatrix() { return this._viewProjMatrix; }
    get inverseProjectionMatrix() { return this._invProjMatrix; }
    get mercatorMatrix() { return this._mercatorMatrix; }
    getVisibleUnwrappedCoordinates(tileID) {
        const result = [new UnwrappedTileID(0, tileID)];
        if (this._helper._renderWorldCopies) {
            const utl = this.screenPointToMercatorCoordinate(new Point(0, 0));
            const utr = this.screenPointToMercatorCoordinate(new Point(this._helper._width, 0));
            const ubl = this.screenPointToMercatorCoordinate(new Point(this._helper._width, this._helper._height));
            const ubr = this.screenPointToMercatorCoordinate(new Point(0, this._helper._height));
            const w0 = Math.floor(Math.min(utl.x, utr.x, ubl.x, ubr.x));
            const w1 = Math.floor(Math.max(utl.x, utr.x, ubl.x, ubr.x));
            const extraWorldCopy = 1;
            for (let w = w0 - extraWorldCopy; w <= w1 + extraWorldCopy; w++) {
                if (w === 0)
                    continue;
                result.push(new UnwrappedTileID(w, tileID));
            }
        }
        return result;
    }
    getCameraFrustum() {
        return Frustum.fromInvProjectionMatrix(this._invViewProjMatrix, this.worldSize);
    }
    getClippingPlane() {
        return null;
    }
    getCoveringTilesDetailsProvider() {
        return this._coveringTilesDetailsProvider;
    }
    recalculateZoomAndCenter(terrain) {
        const center = this.screenPointToLocation(this.centerPoint, terrain);
        const elevation = terrain ? terrain.getElevationForLngLatZoom(center, this._helper._tileZoom) : 0;
        this._helper.recalculateZoomAndCenter(elevation);
    }
    setLocationAtPoint(lnglat, point) {
        const z = mercatorZfromAltitude(this.elevation, this.center.lat);
        const a = this.screenPointToMercatorCoordinateAtZ(point, z);
        const b = this.screenPointToMercatorCoordinateAtZ(this.centerPoint, z);
        const loc = MercatorCoordinate.fromLngLat(lnglat);
        const newCenter = new MercatorCoordinate(loc.x - (a.x - b.x), loc.y - (a.y - b.y));
        this.setCenter(newCenter === null || newCenter === void 0 ? void 0 : newCenter.toLngLat());
        if (this._helper._renderWorldCopies) {
            this.setCenter(this.center.wrap());
        }
    }
    locationToScreenPoint(lnglat, terrain) {
        return terrain ?
            this.coordinatePoint(MercatorCoordinate.fromLngLat(lnglat), terrain.getElevationForLngLatZoom(lnglat, this._helper._tileZoom), this._pixelMatrix3D) :
            this.coordinatePoint(MercatorCoordinate.fromLngLat(lnglat));
    }
    screenPointToLocation(p, terrain) {
        var _a;
        return (_a = this.screenPointToMercatorCoordinate(p, terrain)) === null || _a === void 0 ? void 0 : _a.toLngLat();
    }
    screenPointToMercatorCoordinate(p, terrain) {
        if (terrain) {
            const coordinate = terrain.pointCoordinate(p);
            if (coordinate != null) {
                return coordinate;
            }
        }
        return this.screenPointToMercatorCoordinateAtZ(p);
    }
    screenPointToMercatorCoordinateAtZ(p, mercatorZ) {
        const targetZ = mercatorZ ? mercatorZ : 0;
        const coord0 = [p.x, p.y, 0, 1];
        const coord1 = [p.x, p.y, 1, 1];
        vec4.transformMat4(coord0, coord0, this._pixelMatrixInverse);
        vec4.transformMat4(coord1, coord1, this._pixelMatrixInverse);
        const w0 = coord0[3];
        const w1 = coord1[3];
        const x0 = coord0[0] / w0;
        const x1 = coord1[0] / w1;
        const y0 = coord0[1] / w0;
        const y1 = coord1[1] / w1;
        const z0 = coord0[2] / w0;
        const z1 = coord1[2] / w1;
        const t = z0 === z1 ? 0 : (targetZ - z0) / (z1 - z0);
        return new MercatorCoordinate(interpolates.number(x0, x1, t) / this.worldSize, interpolates.number(y0, y1, t) / this.worldSize, targetZ);
    }
    coordinatePoint(coord, elevation = 0, pixelMatrix = this._pixelMatrix) {
        const p = [coord.x * this.worldSize, coord.y * this.worldSize, elevation, 1];
        vec4.transformMat4(p, p, pixelMatrix);
        return new Point(p[0] / p[3], p[1] / p[3]);
    }
    getBounds() {
        const top = Math.max(0, this._helper._height / 2 - getMercatorHorizon(this));
        return new LngLatBounds()
            .extend(this.screenPointToLocation(new Point(0, top)))
            .extend(this.screenPointToLocation(new Point(this._helper._width, top)))
            .extend(this.screenPointToLocation(new Point(this._helper._width, this._helper._height)))
            .extend(this.screenPointToLocation(new Point(0, this._helper._height)));
    }
    isPointOnMapSurface(p, terrain) {
        if (terrain) {
            const coordinate = terrain.pointCoordinate(p);
            return coordinate != null;
        }
        return (p.y > this.height / 2 - getMercatorHorizon(this));
    }
    calculatePosMatrix(tileID, aligned = false, useFloat32) {
        var _a;
        const posMatrixKey = (_a = tileID.key) !== null && _a !== void 0 ? _a : calculateTileKey(tileID.wrap, tileID.canonical.z, tileID.canonical.z, tileID.canonical.x, tileID.canonical.y);
        const cache = aligned ? this._alignedPosMatrixCache : this._posMatrixCache;
        if (cache.has(posMatrixKey)) {
            const matrices = cache.get(posMatrixKey);
            return useFloat32 ? matrices.f32 : matrices.f64;
        }
        const tileMatrix = calculateTileMatrix(tileID, this.worldSize);
        mat4.multiply(tileMatrix, aligned ? this._alignedProjMatrix : this._viewProjMatrix, tileMatrix);
        const matrices = {
            f64: tileMatrix,
            f32: new Float32Array(tileMatrix),
        };
        cache.set(posMatrixKey, matrices);
        return useFloat32 ? matrices.f32 : matrices.f64;
    }
    calculateFogMatrix(unwrappedTileID) {
        const posMatrixKey = unwrappedTileID.key;
        const cache = this._fogMatrixCacheF32;
        if (cache.has(posMatrixKey)) {
            return cache.get(posMatrixKey);
        }
        const fogMatrix = calculateTileMatrix(unwrappedTileID, this.worldSize);
        mat4.multiply(fogMatrix, this._fogMatrix, fogMatrix);
        cache.set(posMatrixKey, new Float32Array(fogMatrix));
        return cache.get(posMatrixKey);
    }
    getConstrained(lngLat, zoom) {
        zoom = clamp(+zoom, this.minZoom, this.maxZoom);
        const result = {
            center: new LngLat(lngLat.lng, lngLat.lat),
            zoom
        };
        let lngRange = this._helper._lngRange;
        if (!this._helper._renderWorldCopies && lngRange === null) {
            const almost180 = 180 - 1e-10;
            lngRange = [-almost180, almost180];
        }
        const worldSize = this.tileSize * zoomScale(result.zoom);
        let minY = 0;
        let maxY = worldSize;
        let minX = 0;
        let maxX = worldSize;
        let scaleY = 0;
        let scaleX = 0;
        const { x: screenWidth, y: screenHeight } = this.size;
        if (this._helper._latRange) {
            const latRange = this._helper._latRange;
            minY = mercatorYfromLat(latRange[1]) * worldSize;
            maxY = mercatorYfromLat(latRange[0]) * worldSize;
            const shouldZoomIn = maxY - minY < screenHeight;
            if (shouldZoomIn)
                scaleY = screenHeight / (maxY - minY);
        }
        if (lngRange) {
            minX = wrap(mercatorXfromLng(lngRange[0]) * worldSize, 0, worldSize);
            maxX = wrap(mercatorXfromLng(lngRange[1]) * worldSize, 0, worldSize);
            if (maxX < minX)
                maxX += worldSize;
            const shouldZoomIn = maxX - minX < screenWidth;
            if (shouldZoomIn)
                scaleX = screenWidth / (maxX - minX);
        }
        const { x: originalX, y: originalY } = projectToWorldCoordinates(worldSize, lngLat);
        let modifiedX, modifiedY;
        const scale = Math.max(scaleX || 0, scaleY || 0);
        if (scale) {
            const newPoint = new Point(scaleX ? (maxX + minX) / 2 : originalX, scaleY ? (maxY + minY) / 2 : originalY);
            result.center = unprojectFromWorldCoordinates(worldSize, newPoint).wrap();
            result.zoom += scaleZoom(scale);
            return result;
        }
        if (this._helper._latRange) {
            const h2 = screenHeight / 2;
            if (originalY - h2 < minY)
                modifiedY = minY + h2;
            if (originalY + h2 > maxY)
                modifiedY = maxY - h2;
        }
        if (lngRange) {
            const centerX = (minX + maxX) / 2;
            let wrappedX = originalX;
            if (this._helper._renderWorldCopies) {
                wrappedX = wrap(originalX, centerX - worldSize / 2, centerX + worldSize / 2);
            }
            const w2 = screenWidth / 2;
            if (wrappedX - w2 < minX)
                modifiedX = minX + w2;
            if (wrappedX + w2 > maxX)
                modifiedX = maxX - w2;
        }
        if (modifiedX !== undefined || modifiedY !== undefined) {
            const newPoint = new Point(modifiedX !== null && modifiedX !== void 0 ? modifiedX : originalX, modifiedY !== null && modifiedY !== void 0 ? modifiedY : originalY);
            result.center = unprojectFromWorldCoordinates(worldSize, newPoint).wrap();
        }
        return result;
    }
    calculateCenterFromCameraLngLatAlt(lnglat, alt, bearing, pitch) {
        return this._helper.calculateCenterFromCameraLngLatAlt(lnglat, alt, bearing, pitch);
    }
    _calculateNearFarZIfNeeded(cameraToSeaLevelDistance, limitedPitchRadians, offset) {
        if (!this._helper.autoCalculateNearFarZ) {
            return;
        }
        const minRenderDistanceBelowCameraInMeters = 100;
        const minElevation = Math.min(this.elevation, this.minElevationForCurrentTile, this.getCameraAltitude() - minRenderDistanceBelowCameraInMeters);
        const cameraToLowestPointDistance = cameraToSeaLevelDistance - minElevation * this._helper._pixelPerMeter / Math.cos(limitedPitchRadians);
        const lowestPlane = minElevation < 0 ? cameraToLowestPointDistance : cameraToSeaLevelDistance;
        const groundAngle = Math.PI / 2 + this.pitchInRadians;
        const zfov = degreesToRadians(this.fov) * (Math.abs(Math.cos(degreesToRadians(this.roll))) * this.height + Math.abs(Math.sin(degreesToRadians(this.roll))) * this.width) / this.height;
        const fovAboveCenter = zfov * (0.5 + offset.y / this.height);
        const topHalfSurfaceDistance = Math.sin(fovAboveCenter) * lowestPlane / Math.sin(clamp(Math.PI - groundAngle - fovAboveCenter, 0.01, Math.PI - 0.01));
        const horizon = getMercatorHorizon(this);
        const horizonAngle = Math.atan(horizon / this._helper.cameraToCenterDistance);
        const minFovCenterToHorizonRadians = degreesToRadians(90 - maxMercatorHorizonAngle);
        const fovCenterToHorizon = horizonAngle > minFovCenterToHorizonRadians ? 2 * horizonAngle * (0.5 + offset.y / (horizon * 2)) : minFovCenterToHorizonRadians;
        const topHalfSurfaceDistanceHorizon = Math.sin(fovCenterToHorizon) * lowestPlane / Math.sin(clamp(Math.PI - groundAngle - fovCenterToHorizon, 0.01, Math.PI - 0.01));
        const topHalfMinDistance = Math.min(topHalfSurfaceDistance, topHalfSurfaceDistanceHorizon);
        this._helper._farZ = (Math.cos(Math.PI / 2 - limitedPitchRadians) * topHalfMinDistance + lowestPlane) * 1.01;
        this._helper._nearZ = this._helper._height / 50;
    }
    _calcMatrices() {
        if (!this._helper._height)
            return;
        const offset = this.centerOffset;
        const point = projectToWorldCoordinates(this.worldSize, this.center);
        const x = point.x, y = point.y;
        this._helper._pixelPerMeter = mercatorZfromAltitude(1, this.center.lat) * this.worldSize;
        const limitedPitchRadians = degreesToRadians(Math.min(this.pitch, maxMercatorHorizonAngle));
        const cameraToSeaLevelDistance = Math.max(this._helper.cameraToCenterDistance / 2, this._helper.cameraToCenterDistance + this._helper._elevation * this._helper._pixelPerMeter / Math.cos(limitedPitchRadians));
        this._calculateNearFarZIfNeeded(cameraToSeaLevelDistance, limitedPitchRadians, offset);
        let m;
        m = new Float64Array(16);
        mat4.perspective(m, this.fovInRadians, this._helper._width / this._helper._height, this._helper._nearZ, this._helper._farZ);
        this._invProjMatrix = new Float64Array(16);
        mat4.invert(this._invProjMatrix, m);
        m[8] = -offset.x * 2 / this._helper._width;
        m[9] = offset.y * 2 / this._helper._height;
        this._projectionMatrix = mat4.clone(m);
        mat4.scale(m, m, [1, -1, 1]);
        mat4.translate(m, m, [0, 0, -this._helper.cameraToCenterDistance]);
        mat4.rotateZ(m, m, -this.rollInRadians);
        mat4.rotateX(m, m, this.pitchInRadians);
        mat4.rotateZ(m, m, -this.bearingInRadians);
        mat4.translate(m, m, [-x, -y, 0]);
        this._mercatorMatrix = mat4.scale([], m, [this.worldSize, this.worldSize, this.worldSize]);
        mat4.scale(m, m, [1, 1, this._helper._pixelPerMeter]);
        this._pixelMatrix = mat4.multiply(new Float64Array(16), this.clipSpaceToPixelsMatrix, m);
        mat4.translate(m, m, [0, 0, -this.elevation]);
        this._viewProjMatrix = m;
        this._invViewProjMatrix = mat4.invert([], m);
        const cameraPos = [0, 0, -1, 1];
        vec4.transformMat4(cameraPos, cameraPos, this._invViewProjMatrix);
        this._cameraPosition = [
            cameraPos[0] / cameraPos[3],
            cameraPos[1] / cameraPos[3],
            cameraPos[2] / cameraPos[3]
        ];
        this._fogMatrix = new Float64Array(16);
        mat4.perspective(this._fogMatrix, this.fovInRadians, this.width / this.height, cameraToSeaLevelDistance, this._helper._farZ);
        this._fogMatrix[8] = -offset.x * 2 / this.width;
        this._fogMatrix[9] = offset.y * 2 / this.height;
        mat4.scale(this._fogMatrix, this._fogMatrix, [1, -1, 1]);
        mat4.translate(this._fogMatrix, this._fogMatrix, [0, 0, -this.cameraToCenterDistance]);
        mat4.rotateZ(this._fogMatrix, this._fogMatrix, -this.rollInRadians);
        mat4.rotateX(this._fogMatrix, this._fogMatrix, this.pitchInRadians);
        mat4.rotateZ(this._fogMatrix, this._fogMatrix, -this.bearingInRadians);
        mat4.translate(this._fogMatrix, this._fogMatrix, [-x, -y, 0]);
        mat4.scale(this._fogMatrix, this._fogMatrix, [1, 1, this._helper._pixelPerMeter]);
        mat4.translate(this._fogMatrix, this._fogMatrix, [0, 0, -this.elevation]);
        this._pixelMatrix3D = mat4.multiply(new Float64Array(16), this.clipSpaceToPixelsMatrix, m);
        const xShift = (this._helper._width % 2) / 2, yShift = (this._helper._height % 2) / 2, angleCos = Math.cos(this.bearingInRadians), angleSin = Math.sin(-this.bearingInRadians), dx = x - Math.round(x) + angleCos * xShift + angleSin * yShift, dy = y - Math.round(y) + angleCos * yShift + angleSin * xShift;
        const alignedM = new Float64Array(m);
        mat4.translate(alignedM, alignedM, [dx > 0.5 ? dx - 1 : dx, dy > 0.5 ? dy - 1 : dy, 0]);
        this._alignedProjMatrix = alignedM;
        m = mat4.invert(new Float64Array(16), this._pixelMatrix);
        if (!m)
            throw new Error('failed to invert matrix');
        this._pixelMatrixInverse = m;
        this._clearMatrixCaches();
    }
    _clearMatrixCaches() {
        this._posMatrixCache.clear();
        this._alignedPosMatrixCache.clear();
        this._fogMatrixCacheF32.clear();
    }
    maxPitchScaleFactor() {
        if (!this._pixelMatrixInverse)
            return 1;
        const coord = this.screenPointToMercatorCoordinate(new Point(0, 0));
        const p = [coord.x * this.worldSize, coord.y * this.worldSize, 0, 1];
        const topPoint = vec4.transformMat4(p, p, this._pixelMatrix);
        return topPoint[3] / this._helper.cameraToCenterDistance;
    }
    getCameraPoint() {
        return this._helper.getCameraPoint();
    }
    getCameraAltitude() {
        return this._helper.getCameraAltitude();
    }
    getCameraLngLat() {
        const pixelPerMeter = mercatorZfromAltitude(1, this.center.lat) * this.worldSize;
        const cameraToCenterDistanceMeters = this._helper.cameraToCenterDistance / pixelPerMeter;
        const camMercator = cameraMercatorCoordinateFromCenterAndRotation(this.center, this.elevation, this.pitch, this.bearing, cameraToCenterDistanceMeters);
        return camMercator.toLngLat();
    }
    lngLatToCameraDepth(lngLat, elevation) {
        const coord = MercatorCoordinate.fromLngLat(lngLat);
        const p = [coord.x * this.worldSize, coord.y * this.worldSize, elevation, 1];
        vec4.transformMat4(p, p, this._viewProjMatrix);
        return (p[2] / p[3]);
    }
    getProjectionData(params) {
        const { overscaledTileID, aligned, applyTerrainMatrix } = params;
        const mercatorTileCoordinates = this._helper.getMercatorTileCoordinates(overscaledTileID);
        const tilePosMatrix = overscaledTileID ? this.calculatePosMatrix(overscaledTileID, aligned, true) : null;
        let mainMatrix;
        if (overscaledTileID && overscaledTileID.terrainRttPosMatrix32f && applyTerrainMatrix) {
            mainMatrix = overscaledTileID.terrainRttPosMatrix32f;
        }
        else if (tilePosMatrix) {
            mainMatrix = tilePosMatrix;
        }
        else {
            mainMatrix = createIdentityMat4f32();
        }
        return {
            mainMatrix,
            tileMercatorCoords: mercatorTileCoordinates,
            clippingPlane: [0, 0, 0, 0],
            projectionTransition: 0.0,
            fallbackMatrix: mainMatrix,
        };
    }
    isLocationOccluded(_) {
        return false;
    }
    getPixelScale() {
        return 1.0;
    }
    getCircleRadiusCorrection() {
        return 1.0;
    }
    getPitchedTextCorrection(_textAnchorX, _textAnchorY, _tileID) {
        return 1.0;
    }
    transformLightDirection(dir) {
        return vec3.clone(dir);
    }
    getRayDirectionFromPixel(_p) {
        throw new Error('Not implemented.');
    }
    projectTileCoordinates(x, y, unwrappedTileID, getElevation) {
        const matrix = this.calculatePosMatrix(unwrappedTileID);
        let pos;
        if (getElevation) {
            pos = [x, y, getElevation(x, y), 1];
            vec4.transformMat4(pos, pos, matrix);
        }
        else {
            pos = [x, y, 0, 1];
            xyTransformMat4(pos, pos, matrix);
        }
        const w = pos[3];
        return {
            point: new Point(pos[0] / w, pos[1] / w),
            signedDistanceFromCamera: w,
            isOccluded: false
        };
    }
    populateCache(coords) {
        for (const coord of coords) {
            this.calculatePosMatrix(coord);
        }
    }
    getMatrixForModel(location, altitude) {
        const modelAsMercatorCoordinate = MercatorCoordinate.fromLngLat(location, altitude);
        const scale = modelAsMercatorCoordinate.meterInMercatorCoordinateUnits();
        const m = createIdentityMat4f64();
        mat4.translate(m, m, [modelAsMercatorCoordinate.x, modelAsMercatorCoordinate.y, modelAsMercatorCoordinate.z]);
        mat4.rotateZ(m, m, Math.PI);
        mat4.rotateX(m, m, Math.PI / 2);
        mat4.scale(m, m, [-scale, scale, scale]);
        return m;
    }
    getProjectionDataForCustomLayer(applyGlobeMatrix = true) {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const projectionData = this.getProjectionData({ overscaledTileID: tileID, applyGlobeMatrix });
        const tileMatrix = calculateTileMatrix(tileID, this.worldSize);
        mat4.multiply(tileMatrix, this._viewProjMatrix, tileMatrix);
        projectionData.tileMercatorCoords = [0, 0, 1, 1];
        const scale = [EXTENT, EXTENT, this.worldSize / this._helper.pixelsPerMeter];
        const projectionMatrixScaled = createMat4f64();
        mat4.scale(projectionMatrixScaled, tileMatrix, scale);
        projectionData.fallbackMatrix = projectionMatrixScaled;
        projectionData.mainMatrix = projectionMatrixScaled;
        return projectionData;
    }
    getFastPathSimpleProjectionMatrix(tileID) {
        return this.calculatePosMatrix(tileID);
    }
}
//# sourceMappingURL=mercator_transform.js.map