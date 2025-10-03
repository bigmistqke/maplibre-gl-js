export class DoubleClickZoomHandler {
    constructor(clickZoom, TapZoom) {
        this._clickZoom = clickZoom;
        this._tapZoom = TapZoom;
    }
    enable() {
        var _a, _b;
        (_a = this._clickZoom) === null || _a === void 0 ? void 0 : _a.enable();
        (_b = this._tapZoom) === null || _b === void 0 ? void 0 : _b.enable();
    }
    disable() {
        var _a, _b;
        (_a = this._clickZoom) === null || _a === void 0 ? void 0 : _a.disable();
        (_b = this._tapZoom) === null || _b === void 0 ? void 0 : _b.disable();
    }
    isEnabled() {
        var _a, _b;
        return !!(((_a = this._clickZoom) === null || _a === void 0 ? void 0 : _a.isEnabled()) && ((_b = this._tapZoom) === null || _b === void 0 ? void 0 : _b.isEnabled()));
    }
    isActive() {
        var _a, _b;
        return !!(((_a = this._clickZoom) === null || _a === void 0 ? void 0 : _a.isActive()) || ((_b = this._tapZoom) === null || _b === void 0 ? void 0 : _b.isActive()));
    }
}
//# sourceMappingURL=dblclick_zoom.js.map