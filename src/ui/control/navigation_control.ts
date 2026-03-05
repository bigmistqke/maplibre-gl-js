import Point from '@mapbox/point-geometry';

import {DOM} from '../../util/dom';
import {assertedNotNullish, extend, getAngleDelta} from '../../util/util';
import {DragHandler, type DragMoveHandler, type DragRotateResult} from '../handler/drag_handler';
import {MouseOrTouchMoveStateManager} from '../handler/drag_move_state_manager';

import type {Map} from '../map';
import type {IControl} from './control';

/**
 * The {@link NavigationControl} options object
 */
export type NavigationControlOptions = {
    /**
     * If `true` the compass button is included.
     */
    showCompass?: boolean;
    /**
     * If `true` the zoom-in and zoom-out buttons are included.
     */
    showZoom?: boolean;
    /**
     * If `true` the pitch is visualized by rotating X-axis of compass.
     */
    visualizePitch?: boolean;
    /**
     * If `true` the roll is visualized by rotating the compass.
     */
    visualizeRoll?: boolean;
};

const defaultOptions: NavigationControlOptions = {
    showCompass: true,
    showZoom: true,
    visualizePitch: false,
    visualizeRoll: true
};

/**
 * A `NavigationControl` control contains zoom buttons and a compass.
 *
 * @group Markers and Controls
 *
 * @example
 * ```ts
 * let nav = new NavigationControl();
 * map.addControl(nav, 'top-left');
 * ```
 * @see [Display map navigation controls](https://maplibre.org/maplibre-gl-js/docs/examples/display-map-navigation-controls/)
 */
export class NavigationControl implements IControl {
    _map: Map | undefined;
    options: NavigationControlOptions;
    _container: HTMLElement;
    _zoomInButton: HTMLButtonElement | undefined;
    _zoomOutButton: HTMLButtonElement | undefined;
    _compass: HTMLButtonElement | undefined;
    _compassIcon: HTMLElement | undefined;
    _handler: MouseRotateWrapper | undefined;

    /**
     * @param options - the control's options
     */
    constructor(options?: NavigationControlOptions) {
        this.options = extend({}, defaultOptions, options);

        this._container = DOM.create('div', 'maplibregl-ctrl maplibregl-ctrl-group');
        this._container.addEventListener('contextmenu', (e) => e.preventDefault());

        if (this.options.showZoom) {
            this._zoomInButton = this._createButton('maplibregl-ctrl-zoom-in', (e) => assertedNotNullish(this._map).zoomIn({}, {originalEvent: e}));
            DOM.create('span', 'maplibregl-ctrl-icon', this._zoomInButton).setAttribute('aria-hidden', 'true');
            this._zoomOutButton = this._createButton('maplibregl-ctrl-zoom-out', (e) => assertedNotNullish(this._map).zoomOut({}, {originalEvent: e}));
            DOM.create('span', 'maplibregl-ctrl-icon', this._zoomOutButton).setAttribute('aria-hidden', 'true');
        }
        if (this.options.showCompass) {
            this._compass = this._createButton('maplibregl-ctrl-compass', (e) => {
                if (this.options.visualizePitch) {
                    assertedNotNullish(this._map).resetNorthPitch({}, {originalEvent: e});
                } else {
                    assertedNotNullish(this._map).resetNorth({}, {originalEvent: e});
                }
            });
            this._compassIcon = DOM.create('span', 'maplibregl-ctrl-icon', this._compass);
            this._compassIcon.setAttribute('aria-hidden', 'true');
        }
    }

    _updateZoomButtons = () => {
        const map = assertedNotNullish(this._map);
        const zoom = map.getZoom();
        const isMax = zoom === map.getMaxZoom();
        const isMin = zoom === map.getMinZoom();
        const zoomInButton = assertedNotNullish(this._zoomInButton);
        const zoomOutButton = assertedNotNullish(this._zoomOutButton);
        zoomInButton.disabled = isMax;
        zoomOutButton.disabled = isMin;
        zoomInButton.setAttribute('aria-disabled', isMax.toString());
        zoomOutButton.setAttribute('aria-disabled', isMin.toString());
    };

    _rotateCompassArrow = () => {
        const map = assertedNotNullish(this._map);
        const compassIcon = assertedNotNullish(this._compassIcon);
        if (this.options.visualizePitch && this.options.visualizeRoll) {
            compassIcon.style.transform = `scale(${1 / Math.pow(Math.cos(map.transform.pitchInRadians), 0.5)}) rotateZ(${-map.transform.roll}deg) rotateX(${map.transform.pitch}deg) rotateZ(${-map.transform.bearing}deg)`;
            return;
        }
        if (this.options.visualizePitch) {
            compassIcon.style.transform = `scale(${1 / Math.pow(Math.cos(map.transform.pitchInRadians), 0.5)}) rotateX(${map.transform.pitch}deg) rotateZ(${-map.transform.bearing}deg)`;
            return;
        }
        if (this.options.visualizeRoll) {
            compassIcon.style.transform = `rotate(${-map.transform.bearing - map.transform.roll}deg)`;
            return;
        }
        compassIcon.style.transform = `rotate(${-map.transform.bearing}deg)`;
    };

    /** {@inheritDoc IControl.onAdd} */
    onAdd(map: Map) {
        this._map = map;
        if (this.options.showZoom) {
            this._setButtonTitle(assertedNotNullish(this._zoomInButton), 'ZoomIn');
            this._setButtonTitle(assertedNotNullish(this._zoomOutButton), 'ZoomOut');
            this._map.on('zoom', this._updateZoomButtons);
            this._updateZoomButtons();
        }
        if (this.options.showCompass) {
            this._setButtonTitle(assertedNotNullish(this._compass), 'ResetBearing');
            if (this.options.visualizePitch) {
                this._map.on('pitch', this._rotateCompassArrow);
            }
            if (this.options.visualizeRoll) {
                this._map.on('roll', this._rotateCompassArrow);
            }
            this._map.on('rotate', this._rotateCompassArrow);
            this._rotateCompassArrow();
            this._handler = new MouseRotateWrapper(this._map, assertedNotNullish(this._compass), this.options.visualizePitch);
        }
        return this._container;
    }

    /** {@inheritDoc IControl.onRemove} */
    onRemove() {
        DOM.remove(this._container);
        const map = assertedNotNullish(this._map);
        if (this.options.showZoom) {
            map.off('zoom', this._updateZoomButtons);
        }
        if (this.options.showCompass) {
            if (this.options.visualizePitch) {
                map.off('pitch', this._rotateCompassArrow);
            }
            if (this.options.visualizeRoll) {
                map.off('roll', this._rotateCompassArrow);
            }
            map.off('rotate', this._rotateCompassArrow);
            assertedNotNullish(this._handler).off();
            delete this._handler;
        }

        delete this._map;
    }

    _createButton(className: string, fn: (e?: any) => unknown) {
        const a = DOM.create('button', className, this._container) as HTMLButtonElement;
        a.type = 'button';
        a.addEventListener('click', fn);
        return a;
    }

    _setButtonTitle = (button: HTMLButtonElement, title: 'ZoomIn' | 'ZoomOut' | 'ResetBearing') => {
        const str = assertedNotNullish(this._map)._getUIString(`NavigationControl.${title}`);
        button.title = str;
        button.setAttribute('aria-label', str);
    };
}

class MouseRotateWrapper {

    map: Map;
    _clickTolerance: number;
    element: HTMLElement;
    _rotatePitchHandler: DragMoveHandler<DragRotateResult, MouseEvent | TouchEvent>;
    _startPos: Point | undefined;
    _lastPos: Point | undefined;

    constructor(map: Map, element: HTMLElement, pitch: boolean = false) {
        this._clickTolerance = 10;
        this.element = element;

        const moveStateManager = new MouseOrTouchMoveStateManager();
        this._rotatePitchHandler = new DragHandler<DragRotateResult, MouseEvent | TouchEvent>({
            clickTolerance: 3,
            move: (lastPoint: Point, currentPoint: Point) => {
                const rect = element.getBoundingClientRect();
                const center = new Point((rect.bottom - rect.top) / 2, (rect.right - rect.left) / 2);
                const bearingDelta = getAngleDelta(new Point(lastPoint.x, currentPoint.y), currentPoint, center);
                const pitchDelta = pitch ? (currentPoint.y - lastPoint.y) * -0.5 : undefined;
                return {bearingDelta, pitchDelta};
            },
            moveStateManager,
            enable: true,
            assignEvents: () => {},
        });
        this.map = map;

        DOM.addEventListener(element, 'mousedown', this.mousedown as EventListener);
        DOM.addEventListener(element, 'touchstart', this.touchstart as EventListener, {passive: false});
        DOM.addEventListener(element, 'touchcancel', this.reset);
    }

    startMove(e: MouseEvent | TouchEvent, point: Point) {
        this._rotatePitchHandler.dragStart(e, point);
        DOM.disableDrag();
    }

    move(e: MouseEvent | TouchEvent, point: Point) {
        const map = this.map;
        const {bearingDelta, pitchDelta} = this._rotatePitchHandler.dragMove(e, point) || {};
        if (bearingDelta) map.setBearing(map.getBearing() + bearingDelta);
        if (pitchDelta) map.setPitch(map.getPitch() + pitchDelta);
    }

    off() {
        const element = this.element;
        DOM.removeEventListener(element, 'mousedown', this.mousedown as EventListener);
        DOM.removeEventListener(element, 'touchstart', this.touchstart as EventListener, {passive: false});
        DOM.removeEventListener(window, 'touchmove', this.touchmove as EventListener, {passive: false});
        DOM.removeEventListener(window, 'touchend', this.touchend as EventListener);
        DOM.removeEventListener(element, 'touchcancel', this.reset);
        this.offTemp();
    }

    offTemp() {
        DOM.enableDrag();
        DOM.removeEventListener(window, 'mousemove', this.mousemove as EventListener);
        DOM.removeEventListener(window, 'mouseup', this.mouseup as EventListener);
        DOM.removeEventListener(window, 'touchmove', this.touchmove as EventListener, {passive: false});
        DOM.removeEventListener(window, 'touchend', this.touchend as EventListener);
    }

    mousedown = (e: MouseEvent) => {
        this.startMove(e, DOM.mousePos(this.element, e));
        DOM.addEventListener(window, 'mousemove', this.mousemove as EventListener);
        DOM.addEventListener(window, 'mouseup', this.mouseup as EventListener);
    };

    mousemove = (e: MouseEvent) => {
        this.move(e, DOM.mousePos(this.element, e));
    };

    mouseup = (e: MouseEvent) => {
        this._rotatePitchHandler.dragEnd(e);
        this.offTemp();
    };

    touchstart = (e: TouchEvent) => {
        if (e.targetTouches.length !== 1) {
            this.reset();
        } else {
            this._startPos = this._lastPos = DOM.touchPos(this.element, e.targetTouches)[0];
            this.startMove(e, this._startPos);
            DOM.addEventListener(window, 'touchmove', this.touchmove as EventListener, {passive: false});
            DOM.addEventListener(window, 'touchend', this.touchend as EventListener);
        }
    };

    touchmove = (e: TouchEvent) => {
        if (e.targetTouches.length !== 1) {
            this.reset();
        } else {
            this._lastPos = DOM.touchPos(this.element, e.targetTouches)[0];
            this.move(e, this._lastPos);
        }
    };

    touchend = (e: TouchEvent) => {
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

    reset = () => {
        this._rotatePitchHandler.reset();
        delete this._startPos;
        delete this._lastPos;
        this.offTemp();
    };
}
