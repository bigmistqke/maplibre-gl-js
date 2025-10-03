export class DoubleClickZoomHandler {
    constructor(clickZoom, TapZoom) {
        this._clickZoom = clickZoom;
        this._tapZoom = TapZoom;
    }
    enable() {
        this._clickZoom.enable();
        this._tapZoom.enable();
    }
    disable() {
        this._clickZoom.disable();
        this._tapZoom.disable();
    }
    isEnabled() {
        return this._clickZoom.isEnabled() && this._tapZoom.isEnabled();
    }
    isActive() {
        return this._clickZoom.isActive() || this._tapZoom.isActive();
    }
}
//# sourceMappingURL=dblclick_zoom.js.map