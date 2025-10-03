export class DragPanHandler {
    constructor(el, mousePan, touchPan) {
        this._el = el;
        this._mousePan = mousePan;
        this._touchPan = touchPan;
    }
    enable(options) {
        this._inertiaOptions = options || {};
        this._mousePan.enable();
        this._touchPan.enable();
        this._el.classList.add('maplibregl-touch-drag-pan');
    }
    disable() {
        this._mousePan.disable();
        this._touchPan.disable();
        this._el.classList.remove('maplibregl-touch-drag-pan');
    }
    isEnabled() {
        return this._mousePan.isEnabled() && this._touchPan.isEnabled();
    }
    isActive() {
        return this._mousePan.isActive() || this._touchPan.isActive();
    }
}
//# sourceMappingURL=drag_pan.js.map