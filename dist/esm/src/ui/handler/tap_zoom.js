import { TapRecognizer } from './tap_recognizer';
import { TransformProvider } from './transform-provider';
export class TapZoomHandler {
    constructor(map) {
        this._tr = new TransformProvider(map);
        this._zoomIn = new TapRecognizer({
            numTouches: 1,
            numTaps: 2
        });
        this._zoomOut = new TapRecognizer({
            numTouches: 2,
            numTaps: 1
        });
        this.reset();
    }
    reset() {
        this._active = false;
        this._zoomIn.reset();
        this._zoomOut.reset();
    }
    touchstart(e, points, mapTouches) {
        this._zoomIn.touchstart(e, points, mapTouches);
        this._zoomOut.touchstart(e, points, mapTouches);
    }
    touchmove(e, points, mapTouches) {
        this._zoomIn.touchmove(e, points, mapTouches);
        this._zoomOut.touchmove(e, points, mapTouches);
    }
    touchend(e, points, mapTouches) {
        const zoomInPoint = this._zoomIn.touchend(e, points, mapTouches);
        const zoomOutPoint = this._zoomOut.touchend(e, points, mapTouches);
        const tr = this._tr;
        if (zoomInPoint) {
            this._active = true;
            e.preventDefault();
            setTimeout(() => this.reset(), 0);
            return {
                cameraAnimation: (map) => map.easeTo({
                    duration: 300,
                    zoom: tr.zoom + 1,
                    around: tr.unproject(zoomInPoint)
                }, { originalEvent: e })
            };
        }
        else if (zoomOutPoint) {
            this._active = true;
            e.preventDefault();
            setTimeout(() => this.reset(), 0);
            return {
                cameraAnimation: (map) => map.easeTo({
                    duration: 300,
                    zoom: tr.zoom - 1,
                    around: tr.unproject(zoomOutPoint)
                }, { originalEvent: e })
            };
        }
    }
    touchcancel() {
        this.reset();
    }
    enable() {
        this._enabled = true;
    }
    disable() {
        this._enabled = false;
        this.reset();
    }
    isEnabled() {
        return this._enabled;
    }
    isActive() {
        return this._active;
    }
}
//# sourceMappingURL=tap_zoom.js.map