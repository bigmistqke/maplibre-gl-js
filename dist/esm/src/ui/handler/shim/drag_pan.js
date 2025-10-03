export class DragPanHandler {
    constructor(el, mousePan, touchPan) {
        this._el = el;
        this._mousePan = mousePan;
        this._touchPan = touchPan;
    }
    enable(options) {
        var _a, _b;
        this._inertiaOptions = options || {};
        (_a = this._mousePan) === null || _a === void 0 ? void 0 : _a.enable();
        (_b = this._touchPan) === null || _b === void 0 ? void 0 : _b.enable();
        this._el.classList.add('maplibregl-touch-drag-pan');
    }
    disable() {
        var _a, _b;
        (_a = this._mousePan) === null || _a === void 0 ? void 0 : _a.disable();
        (_b = this._touchPan) === null || _b === void 0 ? void 0 : _b.disable();
        this._el.classList.remove('maplibregl-touch-drag-pan');
    }
    isEnabled() {
        var _a, _b;
        return !!(((_a = this._mousePan) === null || _a === void 0 ? void 0 : _a.isEnabled()) && ((_b = this._touchPan) === null || _b === void 0 ? void 0 : _b.isEnabled()));
    }
    isActive() {
        var _a, _b;
        return !!(((_a = this._mousePan) === null || _a === void 0 ? void 0 : _a.isActive()) || ((_b = this._touchPan) === null || _b === void 0 ? void 0 : _b.isActive()));
    }
}
//# sourceMappingURL=drag_pan.js.map