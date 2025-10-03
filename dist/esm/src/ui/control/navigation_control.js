import Point from '@mapbox/point-geometry';
import { DOM } from '../../util/dom';
import { extend, getAngleDelta } from '../../util/util';
import { DragHandler } from '../handler/drag_handler';
import { MouseOrTouchMoveStateManager } from '../handler/drag_move_state_manager';
const defaultOptions = {
    showCompass: true,
    showZoom: true,
    visualizePitch: false,
    visualizeRoll: true
};
export class NavigationControl {
    constructor(options) {
        this._updateZoomButtons = () => {
            const zoom = this._map.getZoom();
            const isMax = zoom === this._map.getMaxZoom();
            const isMin = zoom === this._map.getMinZoom();
            this._zoomInButton.disabled = isMax;
            this._zoomOutButton.disabled = isMin;
            this._zoomInButton.setAttribute('aria-disabled', isMax.toString());
            this._zoomOutButton.setAttribute('aria-disabled', isMin.toString());
        };
        this._rotateCompassArrow = () => {
            if (this.options.visualizePitch && this.options.visualizeRoll) {
                this._compassIcon.style.transform = `scale(${1 / Math.pow(Math.cos(this._map.transform.pitchInRadians), 0.5)}) rotateZ(${-this._map.transform.roll}deg) rotateX(${this._map.transform.pitch}deg) rotateZ(${-this._map.transform.bearing}deg)`;
                return;
            }
            if (this.options.visualizePitch) {
                this._compassIcon.style.transform = `scale(${1 / Math.pow(Math.cos(this._map.transform.pitchInRadians), 0.5)}) rotateX(${this._map.transform.pitch}deg) rotateZ(${-this._map.transform.bearing}deg)`;
                return;
            }
            if (this.options.visualizeRoll) {
                this._compassIcon.style.transform = `rotate(${-this._map.transform.bearing - this._map.transform.roll}deg)`;
                return;
            }
            this._compassIcon.style.transform = `rotate(${-this._map.transform.bearing}deg)`;
        };
        this._setButtonTitle = (button, title) => {
            const str = this._map._getUIString(`NavigationControl.${title}`);
            button.title = str;
            button.setAttribute('aria-label', str);
        };
        this.options = extend({}, defaultOptions, options);
        this._container = DOM.create('div', 'maplibregl-ctrl maplibregl-ctrl-group');
        this._container.addEventListener('contextmenu', (e) => e.preventDefault());
        if (this.options.showZoom) {
            this._zoomInButton = this._createButton('maplibregl-ctrl-zoom-in', (e) => this._map.zoomIn({}, { originalEvent: e }));
            DOM.create('span', 'maplibregl-ctrl-icon', this._zoomInButton).setAttribute('aria-hidden', 'true');
            this._zoomOutButton = this._createButton('maplibregl-ctrl-zoom-out', (e) => this._map.zoomOut({}, { originalEvent: e }));
            DOM.create('span', 'maplibregl-ctrl-icon', this._zoomOutButton).setAttribute('aria-hidden', 'true');
        }
        if (this.options.showCompass) {
            this._compass = this._createButton('maplibregl-ctrl-compass', (e) => {
                if (this.options.visualizePitch) {
                    this._map.resetNorthPitch({}, { originalEvent: e });
                }
                else {
                    this._map.resetNorth({}, { originalEvent: e });
                }
            });
            this._compassIcon = DOM.create('span', 'maplibregl-ctrl-icon', this._compass);
            this._compassIcon.setAttribute('aria-hidden', 'true');
        }
    }
    onAdd(map) {
        this._map = map;
        if (this.options.showZoom) {
            this._setButtonTitle(this._zoomInButton, 'ZoomIn');
            this._setButtonTitle(this._zoomOutButton, 'ZoomOut');
            this._map.on('zoom', this._updateZoomButtons);
            this._updateZoomButtons();
        }
        if (this.options.showCompass) {
            this._setButtonTitle(this._compass, 'ResetBearing');
            if (this.options.visualizePitch) {
                this._map.on('pitch', this._rotateCompassArrow);
            }
            if (this.options.visualizeRoll) {
                this._map.on('roll', this._rotateCompassArrow);
            }
            this._map.on('rotate', this._rotateCompassArrow);
            this._rotateCompassArrow();
            this._handler = new MouseRotateWrapper(this._map, this._compass, this.options.visualizePitch);
        }
        return this._container;
    }
    onRemove() {
        DOM.remove(this._container);
        if (this.options.showZoom) {
            this._map.off('zoom', this._updateZoomButtons);
        }
        if (this.options.showCompass) {
            if (this.options.visualizePitch) {
                this._map.off('pitch', this._rotateCompassArrow);
            }
            if (this.options.visualizeRoll) {
                this._map.off('roll', this._rotateCompassArrow);
            }
            this._map.off('rotate', this._rotateCompassArrow);
            this._handler.off();
            delete this._handler;
        }
        delete this._map;
    }
    _createButton(className, fn) {
        const a = DOM.create('button', className, this._container);
        a.type = 'button';
        a.addEventListener('click', fn);
        return a;
    }
}
class MouseRotateWrapper {
    constructor(map, element, pitch = false) {
        this.mousedown = (e) => {
            this.startMove(e, DOM.mousePos(this.element, e));
            DOM.addEventListener(window, 'mousemove', this.mousemove);
            DOM.addEventListener(window, 'mouseup', this.mouseup);
        };
        this.mousemove = (e) => {
            this.move(e, DOM.mousePos(this.element, e));
        };
        this.mouseup = (e) => {
            this._rotatePitchHandler.dragEnd(e);
            this.offTemp();
        };
        this.touchstart = (e) => {
            if (e.targetTouches.length !== 1) {
                this.reset();
            }
            else {
                this._startPos = this._lastPos = DOM.touchPos(this.element, e.targetTouches)[0];
                this.startMove(e, this._startPos);
                DOM.addEventListener(window, 'touchmove', this.touchmove, { passive: false });
                DOM.addEventListener(window, 'touchend', this.touchend);
            }
        };
        this.touchmove = (e) => {
            if (e.targetTouches.length !== 1) {
                this.reset();
            }
            else {
                this._lastPos = DOM.touchPos(this.element, e.targetTouches)[0];
                this.move(e, this._lastPos);
            }
        };
        this.touchend = (e) => {
            if (e.targetTouches.length === 0 &&
                this._startPos &&
                this._lastPos &&
                this._startPos.dist(this._lastPos) < this._clickTolerance) {
                this.element.click();
            }
            delete this._startPos;
            delete this._lastPos;
            this.offTemp();
        };
        this.reset = () => {
            this._rotatePitchHandler.reset();
            delete this._startPos;
            delete this._lastPos;
            this.offTemp();
        };
        this._clickTolerance = 10;
        this.element = element;
        const moveStateManager = new MouseOrTouchMoveStateManager();
        this._rotatePitchHandler = new DragHandler({
            clickTolerance: 3,
            move: (lastPoint, currentPoint) => {
                const rect = element.getBoundingClientRect();
                const center = new Point((rect.bottom - rect.top) / 2, (rect.right - rect.left) / 2);
                const bearingDelta = getAngleDelta(new Point(lastPoint.x, currentPoint.y), currentPoint, center);
                const pitchDelta = pitch ? (currentPoint.y - lastPoint.y) * -0.5 : undefined;
                return { bearingDelta, pitchDelta };
            },
            moveStateManager,
            enable: true,
            assignEvents: () => { },
        });
        this.map = map;
        DOM.addEventListener(element, 'mousedown', this.mousedown);
        DOM.addEventListener(element, 'touchstart', this.touchstart, { passive: false });
        DOM.addEventListener(element, 'touchcancel', this.reset);
    }
    startMove(e, point) {
        this._rotatePitchHandler.dragStart(e, point);
        DOM.disableDrag();
    }
    move(e, point) {
        const map = this.map;
        const { bearingDelta, pitchDelta } = this._rotatePitchHandler.dragMove(e, point) || {};
        if (bearingDelta)
            map.setBearing(map.getBearing() + bearingDelta);
        if (pitchDelta)
            map.setPitch(map.getPitch() + pitchDelta);
    }
    off() {
        const element = this.element;
        DOM.removeEventListener(element, 'mousedown', this.mousedown);
        DOM.removeEventListener(element, 'touchstart', this.touchstart, { passive: false });
        DOM.removeEventListener(window, 'touchmove', this.touchmove, { passive: false });
        DOM.removeEventListener(window, 'touchend', this.touchend);
        DOM.removeEventListener(element, 'touchcancel', this.reset);
        this.offTemp();
    }
    offTemp() {
        DOM.enableDrag();
        DOM.removeEventListener(window, 'mousemove', this.mousemove);
        DOM.removeEventListener(window, 'mouseup', this.mouseup);
        DOM.removeEventListener(window, 'touchmove', this.touchmove, { passive: false });
        DOM.removeEventListener(window, 'touchend', this.touchend);
    }
}
//# sourceMappingURL=navigation_control.js.map