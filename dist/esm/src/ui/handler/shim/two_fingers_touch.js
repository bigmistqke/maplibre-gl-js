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
        var _a, _b, _c;
        (_a = this._touchZoom) === null || _a === void 0 ? void 0 : _a.enable(options);
        if (!this._rotationDisabled)
            (_b = this._touchRotate) === null || _b === void 0 ? void 0 : _b.enable(options);
        (_c = this._tapDragZoom) === null || _c === void 0 ? void 0 : _c.enable();
        this._el.classList.add('maplibregl-touch-zoom-rotate');
    }
    disable() {
        var _a, _b, _c;
        (_a = this._touchZoom) === null || _a === void 0 ? void 0 : _a.disable();
        (_b = this._touchRotate) === null || _b === void 0 ? void 0 : _b.disable();
        (_c = this._tapDragZoom) === null || _c === void 0 ? void 0 : _c.disable();
        this._el.classList.remove('maplibregl-touch-zoom-rotate');
    }
    isEnabled() {
        var _a, _b, _c;
        return !!(((_a = this._touchZoom) === null || _a === void 0 ? void 0 : _a.isEnabled()) &&
            (this._rotationDisabled || ((_b = this._touchRotate) === null || _b === void 0 ? void 0 : _b.isEnabled())) &&
            ((_c = this._tapDragZoom) === null || _c === void 0 ? void 0 : _c.isEnabled()));
    }
    isActive() {
        var _a, _b, _c;
        return !!(((_a = this._touchZoom) === null || _a === void 0 ? void 0 : _a.isActive()) || ((_b = this._touchRotate) === null || _b === void 0 ? void 0 : _b.isActive()) || ((_c = this._tapDragZoom) === null || _c === void 0 ? void 0 : _c.isActive()));
    }
    disableRotation() {
        var _a;
        this._rotationDisabled = true;
        (_a = this._touchRotate) === null || _a === void 0 ? void 0 : _a.disable();
    }
    enableRotation() {
        var _a, _b;
        this._rotationDisabled = false;
        if ((_a = this._touchZoom) === null || _a === void 0 ? void 0 : _a.isEnabled())
            (_b = this._touchRotate) === null || _b === void 0 ? void 0 : _b.enable();
    }
}
//# sourceMappingURL=two_fingers_touch.js.map