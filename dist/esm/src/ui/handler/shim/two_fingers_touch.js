export class TwoFingersTouchZoomRotateHandler {
    constructor(el, touchZoom, touchRotate, tapDragZoom) {
        this._el = el;
        this._touchZoom = touchZoom;
        this._touchRotate = touchRotate;
        this._tapDragZoom = tapDragZoom;
        this._rotationDisabled = false;
        this._enabled = true;
    }
    enable(options) {
        this._touchZoom.enable(options);
        if (!this._rotationDisabled)
            this._touchRotate.enable(options);
        this._tapDragZoom.enable();
        this._el.classList.add('maplibregl-touch-zoom-rotate');
    }
    disable() {
        this._touchZoom.disable();
        this._touchRotate.disable();
        this._tapDragZoom.disable();
        this._el.classList.remove('maplibregl-touch-zoom-rotate');
    }
    isEnabled() {
        return this._touchZoom.isEnabled() &&
            (this._rotationDisabled || this._touchRotate.isEnabled()) &&
            this._tapDragZoom.isEnabled();
    }
    isActive() {
        return this._touchZoom.isActive() || this._touchRotate.isActive() || this._tapDragZoom.isActive();
    }
    disableRotation() {
        this._rotationDisabled = true;
        this._touchRotate.disable();
    }
    enableRotation() {
        this._rotationDisabled = false;
        if (this._touchZoom.isEnabled())
            this._touchRotate.enable();
    }
}
//# sourceMappingURL=two_fingers_touch.js.map