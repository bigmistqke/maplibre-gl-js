import { DOM } from '../../util/dom';
import { defaultEasing, bezier, zoomScale, scaleZoom } from '../../util/util';
import { browser } from '../../util/browser';
import { interpolates } from '@maplibre/maplibre-gl-style-spec';
import { LngLat } from '../../geo/lng_lat';
import { TransformProvider } from './transform-provider';
const wheelZoomDelta = 4.000244140625;
const defaultZoomRate = 1 / 100;
const wheelZoomRate = 1 / 450;
const maxScalePerFrame = 2;
const wheelEventTimeDiffAdjustment = 5;
export class ScrollZoomHandler {
    constructor(map, triggerRenderFrame) {
        this._onTimeout = (initialEvent) => {
            this._type = 'wheel';
            this._delta -= this._lastValue;
            if (!this._active) {
                this._start(initialEvent);
            }
        };
        this._map = map;
        this._tr = new TransformProvider(map);
        this._triggerRenderFrame = triggerRenderFrame;
        this._delta = 0;
        this._defaultZoomRate = defaultZoomRate;
        this._wheelZoomRate = wheelZoomRate;
    }
    setZoomRate(zoomRate) {
        this._defaultZoomRate = zoomRate;
    }
    setWheelZoomRate(wheelZoomRate) {
        this._wheelZoomRate = wheelZoomRate;
    }
    isEnabled() {
        return !!this._enabled;
    }
    isActive() {
        return !!this._active || this._finishTimeout !== undefined;
    }
    isZooming() {
        return !!this._zooming;
    }
    enable(options) {
        if (this.isEnabled())
            return;
        this._enabled = true;
        this._aroundCenter = !!options && options.around === 'center';
    }
    disable() {
        if (!this.isEnabled())
            return;
        this._enabled = false;
    }
    _shouldBePrevented(e) {
        var _a;
        if (!((_a = this._map.cooperativeGestures) === null || _a === void 0 ? void 0 : _a.isEnabled())) {
            return false;
        }
        const isTrackpadPinch = e.ctrlKey;
        const isBypassed = isTrackpadPinch || this._map.cooperativeGestures.isBypassed(e);
        return !isBypassed;
    }
    wheel(e) {
        var _a;
        if (!this.isEnabled())
            return;
        if (this._shouldBePrevented(e)) {
            (_a = this._map.cooperativeGestures) === null || _a === void 0 ? void 0 : _a.notifyGestureBlocked('wheel_zoom', e);
            return;
        }
        let value = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 40 : e.deltaY;
        const now = browser.now(), timeDelta = now - (this._lastWheelEventTime || 0);
        this._lastWheelEventTime = now;
        if (value !== 0 && (value % wheelZoomDelta) === 0) {
            this._type = 'wheel';
        }
        else if (value !== 0 && Math.abs(value) < 4) {
            this._type = 'trackpad';
        }
        else if (timeDelta > 400) {
            this._type = null;
            this._lastValue = value;
            this._timeout = setTimeout(this._onTimeout, 40, e);
        }
        else if (!this._type) {
            this._type = (Math.abs(timeDelta * value) < 200) ? 'trackpad' : 'wheel';
            if (this._timeout) {
                clearTimeout(this._timeout);
                this._timeout = null;
                value += this._lastValue;
            }
        }
        if (e.shiftKey && value)
            value = value / 4;
        if (this._type) {
            this._lastWheelEvent = e;
            this._delta -= value;
            if (!this._active) {
                this._start(e);
            }
        }
        e.preventDefault();
    }
    _start(e) {
        if (!this._delta)
            return;
        if (this._frameId) {
            this._frameId = null;
        }
        this._active = true;
        if (!this.isZooming()) {
            this._zooming = true;
        }
        if (this._finishTimeout) {
            clearTimeout(this._finishTimeout);
            delete this._finishTimeout;
        }
        const pos = DOM.mousePos(this._map.getCanvas(), e);
        const tr = this._tr;
        if (this._aroundCenter) {
            this._aroundPoint = tr.transform.locationToScreenPoint(LngLat.convert(tr.center));
        }
        else {
            this._aroundPoint = pos;
        }
        if (!this._frameId) {
            this._frameId = true;
            this._triggerRenderFrame();
        }
    }
    renderFrame() {
        if (!this._frameId)
            return;
        this._frameId = null;
        if (!this.isActive())
            return;
        const tr = this._tr.transform;
        if (typeof this._lastExpectedZoom === 'number') {
            const externalZoomChange = tr.zoom - this._lastExpectedZoom;
            if (typeof this._startZoom === 'number') {
                this._startZoom += externalZoomChange;
            }
            if (typeof this._targetZoom === 'number') {
                this._targetZoom += externalZoomChange;
            }
        }
        if (this._delta !== 0) {
            const zoomRate = (this._type === 'wheel' && Math.abs(this._delta) > wheelZoomDelta) ? this._wheelZoomRate : this._defaultZoomRate;
            let scale = maxScalePerFrame / (1 + Math.exp(-Math.abs(this._delta * zoomRate)));
            if (this._delta < 0 && scale !== 0) {
                scale = 1 / scale;
            }
            const fromScale = typeof this._targetZoom !== 'number' ? tr.scale : zoomScale(this._targetZoom);
            this._targetZoom = tr.getConstrained(tr.getCameraLngLat(), scaleZoom(fromScale * scale)).zoom;
            if (this._type === 'wheel') {
                this._startZoom = tr.zoom;
                this._easing = this._smoothOutEasing(200);
            }
            this._delta = 0;
        }
        const targetZoom = typeof this._targetZoom !== 'number' ? tr.zoom : this._targetZoom;
        const startZoom = this._startZoom;
        const easing = this._easing;
        let finished = false;
        let zoom;
        if (this._type === 'wheel' && startZoom && easing) {
            const lastWheelEventTimeDiff = browser.now() - this._lastWheelEventTime;
            const t = Math.min((lastWheelEventTimeDiff + wheelEventTimeDiffAdjustment) / 200, 1);
            const k = easing(t);
            zoom = interpolates.number(startZoom, targetZoom, k);
            if (t < 1) {
                if (!this._frameId) {
                    this._frameId = true;
                }
            }
            else {
                finished = true;
            }
        }
        else {
            zoom = targetZoom;
            finished = true;
        }
        this._active = true;
        if (finished) {
            this._active = false;
            this._finishTimeout = setTimeout(() => {
                this._zooming = false;
                this._triggerRenderFrame();
                delete this._targetZoom;
                delete this._lastExpectedZoom;
                delete this._finishTimeout;
            }, 200);
        }
        this._lastExpectedZoom = zoom;
        return {
            noInertia: true,
            needsRenderFrame: !finished,
            zoomDelta: zoom - tr.zoom,
            around: this._aroundPoint,
            originalEvent: this._lastWheelEvent
        };
    }
    _smoothOutEasing(duration) {
        let easing = defaultEasing;
        if (this._prevEase) {
            const currentEase = this._prevEase;
            const t = (browser.now() - currentEase.start) / currentEase.duration;
            const speed = currentEase.easing(t + 0.01) - currentEase.easing(t);
            const x = 0.27 / Math.sqrt(speed * speed + 0.0001) * 0.01;
            const y = Math.sqrt(0.27 * 0.27 - x * x);
            easing = bezier(x, y, 0.25, 1);
        }
        this._prevEase = {
            start: browser.now(),
            duration,
            easing
        };
        return easing;
    }
    reset() {
        this._active = false;
        this._zooming = false;
        delete this._targetZoom;
        delete this._lastExpectedZoom;
        if (this._finishTimeout) {
            clearTimeout(this._finishTimeout);
            delete this._finishTimeout;
        }
    }
}
//# sourceMappingURL=scroll_zoom.js.map