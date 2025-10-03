import { TransformProvider } from './transform-provider';
const defaultOptions = {
    panStep: 100,
    bearingStep: 15,
    pitchStep: 10
};
export class KeyboardHandler {
    constructor(map) {
        this._tr = new TransformProvider(map);
        const stepOptions = defaultOptions;
        this._panStep = stepOptions.panStep;
        this._bearingStep = stepOptions.bearingStep;
        this._pitchStep = stepOptions.pitchStep;
        this._rotationDisabled = false;
    }
    reset() {
        this._active = false;
    }
    keydown(e) {
        if (e.altKey || e.ctrlKey || e.metaKey)
            return;
        let zoomDir = 0;
        let bearingDir = 0;
        let pitchDir = 0;
        let xDir = 0;
        let yDir = 0;
        switch (e.keyCode) {
            case 61:
            case 107:
            case 171:
            case 187:
                zoomDir = 1;
                break;
            case 189:
            case 109:
            case 173:
                zoomDir = -1;
                break;
            case 37:
                if (e.shiftKey) {
                    bearingDir = -1;
                }
                else {
                    e.preventDefault();
                    xDir = -1;
                }
                break;
            case 39:
                if (e.shiftKey) {
                    bearingDir = 1;
                }
                else {
                    e.preventDefault();
                    xDir = 1;
                }
                break;
            case 38:
                if (e.shiftKey) {
                    pitchDir = 1;
                }
                else {
                    e.preventDefault();
                    yDir = -1;
                }
                break;
            case 40:
                if (e.shiftKey) {
                    pitchDir = -1;
                }
                else {
                    e.preventDefault();
                    yDir = 1;
                }
                break;
            default:
                return;
        }
        if (this._rotationDisabled) {
            bearingDir = 0;
            pitchDir = 0;
        }
        return {
            cameraAnimation: (map) => {
                const tr = this._tr;
                map.easeTo({
                    duration: 300,
                    easeId: 'keyboardHandler',
                    easing: easeOut,
                    zoom: zoomDir ? Math.round(tr.zoom) + zoomDir * (e.shiftKey ? 2 : 1) : tr.zoom,
                    bearing: tr.bearing + bearingDir * this._bearingStep,
                    pitch: tr.pitch + pitchDir * this._pitchStep,
                    offset: [-xDir * this._panStep, -yDir * this._panStep],
                    center: tr.center
                }, { originalEvent: e });
            }
        };
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
    disableRotation() {
        this._rotationDisabled = true;
    }
    enableRotation() {
        this._rotationDisabled = false;
    }
}
function easeOut(t) {
    return t * (2 - t);
}
//# sourceMappingURL=keyboard.js.map