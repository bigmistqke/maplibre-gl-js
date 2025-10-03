import { TransformHelper } from '../transform_helper';
import { MercatorTransform } from './mercator_transform';
import { VerticalPerspectiveTransform } from './vertical_perspective_transform';
import { lerp } from '../../util/util';
export class GlobeTransform {
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
    resize(width, height, constrainTransform = true) {
        this._helper.resize(width, height, constrainTransform);
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
    get isGlobeRendering() {
        return this._globeness > 0;
    }
    setTransitionState(globeness, errorCorrectionValue) {
        this._globeness = globeness;
        this._globeLatitudeErrorCorrectionRadians = errorCorrectionValue;
        this._calcMatrices();
        this._verticalPerspectiveTransform.getCoveringTilesDetailsProvider().prepareNextFrame();
        this._mercatorTransform.getCoveringTilesDetailsProvider().prepareNextFrame();
    }
    get currentTransform() {
        return this.isGlobeRendering ? this._verticalPerspectiveTransform : this._mercatorTransform;
    }
    constructor() {
        this._globeLatitudeErrorCorrectionRadians = 0;
        this._globeness = 1.0;
        this._helper = new TransformHelper({
            calcMatrices: () => { this._calcMatrices(); },
            getConstrained: (center, zoom) => { return this.getConstrained(center, zoom); }
        });
        this._globeness = 1;
        this._mercatorTransform = new MercatorTransform();
        this._verticalPerspectiveTransform = new VerticalPerspectiveTransform();
    }
    clone() {
        const clone = new GlobeTransform();
        clone._globeness = this._globeness;
        clone._globeLatitudeErrorCorrectionRadians = this._globeLatitudeErrorCorrectionRadians;
        clone.apply(this);
        return clone;
    }
    apply(that) {
        this._helper.apply(that);
        this._mercatorTransform.apply(this);
        this._verticalPerspectiveTransform.apply(this, this._globeLatitudeErrorCorrectionRadians);
    }
    get projectionMatrix() { return this.currentTransform.projectionMatrix; }
    get modelViewProjectionMatrix() { return this.currentTransform.modelViewProjectionMatrix; }
    get inverseProjectionMatrix() { return this.currentTransform.inverseProjectionMatrix; }
    get cameraPosition() { return this.currentTransform.cameraPosition; }
    getProjectionData(params) {
        const mercatorProjectionData = this._mercatorTransform.getProjectionData(params);
        const verticalPerspectiveProjectionData = this._verticalPerspectiveTransform.getProjectionData(params);
        return {
            mainMatrix: this.isGlobeRendering ? verticalPerspectiveProjectionData.mainMatrix : mercatorProjectionData.mainMatrix,
            clippingPlane: verticalPerspectiveProjectionData.clippingPlane,
            tileMercatorCoords: verticalPerspectiveProjectionData.tileMercatorCoords,
            projectionTransition: params.applyGlobeMatrix ? this._globeness : 0,
            fallbackMatrix: mercatorProjectionData.fallbackMatrix,
        };
    }
    isLocationOccluded(location) {
        return this.currentTransform.isLocationOccluded(location);
    }
    transformLightDirection(dir) {
        return this.currentTransform.transformLightDirection(dir);
    }
    getPixelScale() {
        return lerp(this._mercatorTransform.getPixelScale(), this._verticalPerspectiveTransform.getPixelScale(), this._globeness);
    }
    getCircleRadiusCorrection() {
        return lerp(this._mercatorTransform.getCircleRadiusCorrection(), this._verticalPerspectiveTransform.getCircleRadiusCorrection(), this._globeness);
    }
    getPitchedTextCorrection(textAnchorX, textAnchorY, tileID) {
        const mercatorCorrection = this._mercatorTransform.getPitchedTextCorrection(textAnchorX, textAnchorY, tileID);
        const verticalCorrection = this._verticalPerspectiveTransform.getPitchedTextCorrection(textAnchorX, textAnchorY, tileID);
        return lerp(mercatorCorrection, verticalCorrection, this._globeness);
    }
    projectTileCoordinates(x, y, unwrappedTileID, getElevation) {
        return this.currentTransform.projectTileCoordinates(x, y, unwrappedTileID, getElevation);
    }
    _calcMatrices() {
        if (!this._helper._width || !this._helper._height) {
            return;
        }
        this._verticalPerspectiveTransform.apply(this, this._globeLatitudeErrorCorrectionRadians);
        this._helper._nearZ = this._verticalPerspectiveTransform.nearZ;
        this._helper._farZ = this._verticalPerspectiveTransform.farZ;
        this._mercatorTransform.apply(this, true, this.isGlobeRendering);
        this._helper._nearZ = this._mercatorTransform.nearZ;
        this._helper._farZ = this._mercatorTransform.farZ;
    }
    calculateFogMatrix(unwrappedTileID) {
        return this.currentTransform.calculateFogMatrix(unwrappedTileID);
    }
    getVisibleUnwrappedCoordinates(tileID) {
        return this.currentTransform.getVisibleUnwrappedCoordinates(tileID);
    }
    getCameraFrustum() {
        return this.currentTransform.getCameraFrustum();
    }
    getClippingPlane() {
        return this.currentTransform.getClippingPlane();
    }
    getCoveringTilesDetailsProvider() {
        return this.currentTransform.getCoveringTilesDetailsProvider();
    }
    recalculateZoomAndCenter(terrain) {
        this._mercatorTransform.recalculateZoomAndCenter(terrain);
        this._verticalPerspectiveTransform.recalculateZoomAndCenter(terrain);
    }
    maxPitchScaleFactor() {
        return this._mercatorTransform.maxPitchScaleFactor();
    }
    getCameraPoint() {
        return this._helper.getCameraPoint();
    }
    getCameraAltitude() {
        return this._helper.getCameraAltitude();
    }
    getCameraLngLat() {
        return this._helper.getCameraLngLat();
    }
    lngLatToCameraDepth(lngLat, elevation) {
        return this.currentTransform.lngLatToCameraDepth(lngLat, elevation);
    }
    populateCache(coords) {
        this._mercatorTransform.populateCache(coords);
        this._verticalPerspectiveTransform.populateCache(coords);
    }
    getBounds() {
        return this.currentTransform.getBounds();
    }
    getConstrained(lngLat, zoom) {
        return this.currentTransform.getConstrained(lngLat, zoom);
    }
    calculateCenterFromCameraLngLatAlt(lngLat, alt, bearing, pitch) {
        return this._helper.calculateCenterFromCameraLngLatAlt(lngLat, alt, bearing, pitch);
    }
    setLocationAtPoint(lnglat, point) {
        if (!this.isGlobeRendering) {
            this._mercatorTransform.setLocationAtPoint(lnglat, point);
            this.apply(this._mercatorTransform);
            return;
        }
        this._verticalPerspectiveTransform.setLocationAtPoint(lnglat, point);
        this.apply(this._verticalPerspectiveTransform);
        return;
    }
    locationToScreenPoint(lnglat, terrain) {
        return this.currentTransform.locationToScreenPoint(lnglat, terrain);
    }
    screenPointToMercatorCoordinate(p, terrain) {
        return this.currentTransform.screenPointToMercatorCoordinate(p, terrain);
    }
    screenPointToLocation(p, terrain) {
        return this.currentTransform.screenPointToLocation(p, terrain);
    }
    isPointOnMapSurface(p, terrain) {
        return this.currentTransform.isPointOnMapSurface(p, terrain);
    }
    getRayDirectionFromPixel(p) {
        return this._verticalPerspectiveTransform.getRayDirectionFromPixel(p);
    }
    getMatrixForModel(location, altitude) {
        return this.currentTransform.getMatrixForModel(location, altitude);
    }
    getProjectionDataForCustomLayer(applyGlobeMatrix = true) {
        const mercatorData = this._mercatorTransform.getProjectionDataForCustomLayer(applyGlobeMatrix);
        if (!this.isGlobeRendering) {
            return mercatorData;
        }
        const globeData = this._verticalPerspectiveTransform.getProjectionDataForCustomLayer(applyGlobeMatrix);
        globeData.fallbackMatrix = mercatorData.mainMatrix;
        return globeData;
    }
    getFastPathSimpleProjectionMatrix(tileID) {
        return this.currentTransform.getFastPathSimpleProjectionMatrix(tileID);
    }
}
//# sourceMappingURL=globe_transform.js.map