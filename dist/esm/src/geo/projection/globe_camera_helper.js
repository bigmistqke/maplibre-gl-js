import { MercatorCameraHelper } from './mercator_camera_helper';
import { VerticalPerspectiveCameraHelper } from './vertical_perspective_camera_helper';
export class GlobeCameraHelper {
    constructor(globe) {
        this._globe = globe;
        this._mercatorCameraHelper = new MercatorCameraHelper();
        this._verticalPerspectiveCameraHelper = new VerticalPerspectiveCameraHelper();
    }
    get useGlobeControls() { return this._globe.useGlobeRendering; }
    get currentHelper() {
        return this.useGlobeControls ? this._verticalPerspectiveCameraHelper : this._mercatorCameraHelper;
    }
    handlePanInertia(pan, transform) {
        return this.currentHelper.handlePanInertia(pan, transform);
    }
    handleMapControlsRollPitchBearingZoom(deltas, tr) {
        return this.currentHelper.handleMapControlsRollPitchBearingZoom(deltas, tr);
    }
    handleMapControlsPan(deltas, tr, preZoomAroundLoc) {
        this.currentHelper.handleMapControlsPan(deltas, tr, preZoomAroundLoc);
    }
    cameraForBoxAndBearing(options, padding, bounds, bearing, tr) {
        return this.currentHelper.cameraForBoxAndBearing(options, padding, bounds, bearing, tr);
    }
    handleJumpToCenterZoom(tr, options) {
        this.currentHelper.handleJumpToCenterZoom(tr, options);
    }
    handleEaseTo(tr, options) {
        return this.currentHelper.handleEaseTo(tr, options);
    }
    handleFlyTo(tr, options) {
        return this.currentHelper.handleFlyTo(tr, options);
    }
}
//# sourceMappingURL=globe_camera_helper.js.map