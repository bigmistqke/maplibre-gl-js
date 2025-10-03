import { Event } from '../util/evented';
import { DOM } from '../util/dom';
import { HandlerInertia } from './handler_inertia';
import { MapEventHandler, BlockableMapEventHandler } from './handler/map_event';
import { extend, isPointableEvent, isTouchableEvent, isTouchableOrPointableType } from '../util/util';
import { browser } from '../util/browser';
import Point from '@mapbox/point-geometry';
const isMoving = (p) => p.zoom || p.drag || p.roll || p.pitch || p.rotate;
class RenderFrameEvent extends Event {
}
const handlerRegistry = new globalThis.Map();
export function registerHandler(name, factory) {
    handlerRegistry.set(name, factory);
}
export function getHandlerFactory(name) {
    return handlerRegistry.get(name);
}
function hasChange(result) {
    return (result.panDelta && result.panDelta.mag()) || result.zoomDelta || result.bearingDelta || result.pitchDelta || result.rollDelta;
}
export class HandlerManager {
    constructor(map, options) {
        this.handleWindowEvent = (e) => {
            this.handleEvent(e, `${e.type}Window`);
        };
        this.handleEvent = (e, eventName) => {
            if (e.type === 'blur') {
                this.stop(true);
                return;
            }
            this._updatingCamera = true;
            const inputEvent = e.type === 'renderFrame' ? undefined : e;
            const mergedHandlerResult = { needsRenderFrame: false };
            const eventsInProgress = {};
            const activeHandlers = {};
            for (const { handlerName, handler, allowed } of this._handlers) {
                if (!handler.isEnabled())
                    continue;
                let data;
                if (this._blockedByActive(activeHandlers, allowed, handlerName)) {
                    handler.reset();
                }
                else {
                    if (handler[eventName || e.type]) {
                        if (isPointableEvent(e, eventName || e.type)) {
                            const point = DOM.mousePos(this._map.getCanvas(), e);
                            data = handler[eventName || e.type](e, point);
                        }
                        else if (isTouchableEvent(e, eventName || e.type)) {
                            const eventTouches = e.touches;
                            const mapTouches = this._getMapTouches(eventTouches);
                            const points = DOM.touchPos(this._map.getCanvas(), mapTouches);
                            data = handler[eventName || e.type](e, points, mapTouches);
                        }
                        else if (!isTouchableOrPointableType(eventName || e.type)) {
                            data = handler[eventName || e.type](e);
                        }
                        this.mergeHandlerResult(mergedHandlerResult, eventsInProgress, data, handlerName, inputEvent);
                        if (data && data.needsRenderFrame) {
                            this._triggerRenderFrame();
                        }
                    }
                }
                if (data || handler.isActive()) {
                    activeHandlers[handlerName] = handler;
                }
            }
            const deactivatedHandlers = {};
            for (const name in this._previousActiveHandlers) {
                if (!activeHandlers[name]) {
                    deactivatedHandlers[name] = inputEvent;
                }
            }
            this._previousActiveHandlers = activeHandlers;
            if (Object.keys(deactivatedHandlers).length || hasChange(mergedHandlerResult)) {
                this._changes.push([mergedHandlerResult, eventsInProgress, deactivatedHandlers]);
                this._triggerRenderFrame();
            }
            if (Object.keys(activeHandlers).length || hasChange(mergedHandlerResult)) {
                this._map._stop(true);
            }
            this._updatingCamera = false;
            const { cameraAnimation } = mergedHandlerResult;
            if (cameraAnimation) {
                this._inertia.clear();
                this._fireEvents({}, {}, true);
                this._changes = [];
                cameraAnimation(this._map);
            }
        };
        this._map = map;
        this._el = this._map.getCanvasContainer();
        this._handlers = [];
        this._handlersById = {};
        this._changes = [];
        this._inertia = new HandlerInertia(map);
        this._bearingSnap = options.bearingSnap;
        this._previousActiveHandlers = {};
        this._eventsInProgress = {};
        this._addDefaultHandlers(options);
        const el = this._el;
        this._listeners = [
            [el, 'touchstart', { passive: true }],
            [el, 'touchmove', { passive: false }],
            [el, 'touchend', undefined],
            [el, 'touchcancel', undefined],
            [el, 'mousedown', undefined],
            [el, 'mousemove', undefined],
            [el, 'mouseup', undefined],
            [document, 'mousemove', { capture: true }],
            [document, 'mouseup', undefined],
            [el, 'mouseover', undefined],
            [el, 'mouseout', undefined],
            [el, 'dblclick', undefined],
            [el, 'click', undefined],
            [el, 'keydown', { capture: false }],
            [el, 'keyup', undefined],
            [el, 'wheel', { passive: false }],
            [el, 'contextmenu', undefined],
            [window, 'blur', undefined]
        ];
        for (const [target, type, listenerOptions] of this._listeners) {
            DOM.addEventListener(target, type, target === document ? this.handleWindowEvent : this.handleEvent, listenerOptions);
        }
    }
    destroy() {
        for (const [target, type, listenerOptions] of this._listeners) {
            DOM.removeEventListener(target, type, target === document ? this.handleWindowEvent : this.handleEvent, listenerOptions);
        }
    }
    _addDefaultHandlers(options) {
        const map = this._map;
        this._add('mapEvent', new MapEventHandler(map, options));
        this._add('blockableMapEvent', new BlockableMapEventHandler(map));
        const handlerNames = [
            'mouseRotate',
            'mousePitch',
            'mouseRoll',
            'mousePan',
            'touchPan',
            'clickZoom',
            'tapZoom',
            'touchRotate',
            'touchZoom',
            'boxZoom',
            'cooperativeGestures',
            'doubleClickZoom',
            'tapDragZoom',
            'touchPitch',
            'dragRotate',
            'dragPan',
            'touchZoomRotate',
            'scrollZoom',
            'keyboard'
        ];
        for (const name of handlerNames) {
            const factory = handlerRegistry.get(name);
            if (factory) {
                try {
                    factory(map, options, this);
                }
                catch (e) {
                    console.warn(`Handler '${name}' failed to initialize:`, e);
                }
            }
        }
    }
    _add(handlerName, handler, allowed) {
        this._handlers.push({ handlerName, handler, allowed });
        this._handlersById[handlerName] = handler;
    }
    stop(allowEndAnimation) {
        if (this._updatingCamera)
            return;
        for (const { handler } of this._handlers) {
            handler.reset();
        }
        this._inertia.clear();
        this._fireEvents({}, {}, allowEndAnimation);
        this._changes = [];
    }
    isActive() {
        for (const { handler } of this._handlers) {
            if (handler.isActive())
                return true;
        }
        return false;
    }
    isZooming() {
        var _a, _b;
        return !!this._eventsInProgress.zoom || ((_b = (_a = this._map.scrollZoom) === null || _a === void 0 ? void 0 : _a.isZooming()) !== null && _b !== void 0 ? _b : false);
    }
    isRotating() {
        return !!this._eventsInProgress.rotate;
    }
    isMoving() {
        return Boolean(isMoving(this._eventsInProgress)) || this.isZooming();
    }
    _blockedByActive(activeHandlers, allowed, myName) {
        for (const name in activeHandlers) {
            if (name === myName)
                continue;
            if (!allowed || allowed.indexOf(name) < 0) {
                return true;
            }
        }
        return false;
    }
    _getMapTouches(touches) {
        const mapTouches = [];
        for (const t of touches) {
            const target = t.target;
            if (this._el.contains(target)) {
                mapTouches.push(t);
            }
        }
        return mapTouches;
    }
    mergeHandlerResult(mergedHandlerResult, eventsInProgress, handlerResult, name, e) {
        if (!handlerResult)
            return;
        extend(mergedHandlerResult, handlerResult);
        const eventData = { handlerName: name, originalEvent: handlerResult.originalEvent || e };
        if (handlerResult.zoomDelta !== undefined) {
            eventsInProgress.zoom = eventData;
        }
        if (handlerResult.panDelta !== undefined) {
            eventsInProgress.drag = eventData;
        }
        if (handlerResult.rollDelta !== undefined) {
            eventsInProgress.roll = eventData;
        }
        if (handlerResult.pitchDelta !== undefined) {
            eventsInProgress.pitch = eventData;
        }
        if (handlerResult.bearingDelta !== undefined) {
            eventsInProgress.rotate = eventData;
        }
    }
    _applyChanges() {
        const combined = {};
        const combinedEventsInProgress = {};
        const combinedDeactivatedHandlers = {};
        for (const [change, eventsInProgress, deactivatedHandlers] of this._changes) {
            if (change.panDelta)
                combined.panDelta = (combined.panDelta || new Point(0, 0))._add(change.panDelta);
            if (change.zoomDelta)
                combined.zoomDelta = (combined.zoomDelta || 0) + change.zoomDelta;
            if (change.bearingDelta)
                combined.bearingDelta = (combined.bearingDelta || 0) + change.bearingDelta;
            if (change.pitchDelta)
                combined.pitchDelta = (combined.pitchDelta || 0) + change.pitchDelta;
            if (change.rollDelta)
                combined.rollDelta = (combined.rollDelta || 0) + change.rollDelta;
            if (change.around !== undefined)
                combined.around = change.around;
            if (change.pinchAround !== undefined)
                combined.pinchAround = change.pinchAround;
            if (change.noInertia)
                combined.noInertia = change.noInertia;
            extend(combinedEventsInProgress, eventsInProgress);
            extend(combinedDeactivatedHandlers, deactivatedHandlers);
        }
        this._updateMapTransform(combined, combinedEventsInProgress, combinedDeactivatedHandlers);
        this._changes = [];
    }
    _updateMapTransform(combinedResult, combinedEventsInProgress, deactivatedHandlers) {
        const map = this._map;
        const tr = map._getTransformForUpdate();
        const terrain = map.terrain;
        if (!hasChange(combinedResult) && !(terrain && this._terrainMovement)) {
            return this._fireEvents(combinedEventsInProgress, deactivatedHandlers, true);
        }
        map._stop(true);
        let { panDelta, zoomDelta, bearingDelta, pitchDelta, rollDelta, around, pinchAround } = combinedResult;
        if (pinchAround !== undefined) {
            around = pinchAround;
        }
        around = around || map.transform.centerPoint;
        if (terrain && !tr.isPointOnMapSurface(around)) {
            around = tr.centerPoint;
        }
        const deltasForHelper = {
            panDelta,
            zoomDelta,
            rollDelta,
            pitchDelta,
            bearingDelta,
            around,
        };
        if (this._map.cameraHelper.useGlobeControls && !tr.isPointOnMapSurface(around)) {
            around = tr.centerPoint;
        }
        const preZoomAroundLoc = around.distSqr(tr.centerPoint) < 1.0e-2 ?
            tr.center :
            tr.screenPointToLocation(panDelta ? around.sub(panDelta) : around);
        if (!terrain) {
            this._map.cameraHelper.handleMapControlsRollPitchBearingZoom(deltasForHelper, tr);
            this._map.cameraHelper.handleMapControlsPan(deltasForHelper, tr, preZoomAroundLoc);
        }
        else {
            this._map.cameraHelper.handleMapControlsRollPitchBearingZoom(deltasForHelper, tr);
            if (!this._terrainMovement &&
                (combinedEventsInProgress.drag || combinedEventsInProgress.zoom)) {
                this._terrainMovement = true;
                this._map._elevationFreeze = true;
                this._map.cameraHelper.handleMapControlsPan(deltasForHelper, tr, preZoomAroundLoc);
            }
            else if (combinedEventsInProgress.drag && this._terrainMovement) {
                tr.setCenter(tr.screenPointToLocation(tr.centerPoint.sub(panDelta)));
            }
            else {
                this._map.cameraHelper.handleMapControlsPan(deltasForHelper, tr, preZoomAroundLoc);
            }
        }
        map._applyUpdatedTransform(tr);
        this._map._update();
        if (!combinedResult.noInertia)
            this._inertia.record(combinedResult);
        this._fireEvents(combinedEventsInProgress, deactivatedHandlers, true);
    }
    _fireEvents(newEventsInProgress, deactivatedHandlers, allowEndAnimation) {
        var _a;
        const wasMoving = isMoving(this._eventsInProgress);
        const nowMoving = isMoving(newEventsInProgress);
        const startEvents = {};
        for (const eventName in newEventsInProgress) {
            const { originalEvent } = newEventsInProgress[eventName];
            if (!this._eventsInProgress[eventName]) {
                startEvents[`${eventName}start`] = originalEvent;
            }
            this._eventsInProgress[eventName] = newEventsInProgress[eventName];
        }
        if (!wasMoving && nowMoving) {
            this._fireEvent('movestart', nowMoving.originalEvent);
        }
        for (const name in startEvents) {
            this._fireEvent(name, startEvents[name]);
        }
        if (nowMoving) {
            this._fireEvent('move', nowMoving.originalEvent);
        }
        for (const eventName in newEventsInProgress) {
            const { originalEvent } = newEventsInProgress[eventName];
            this._fireEvent(eventName, originalEvent);
        }
        const endEvents = {};
        let originalEndEvent;
        for (const eventName in this._eventsInProgress) {
            const { handlerName, originalEvent } = this._eventsInProgress[eventName];
            if (!this._handlersById[handlerName].isActive()) {
                delete this._eventsInProgress[eventName];
                originalEndEvent = deactivatedHandlers[handlerName] || originalEvent;
                endEvents[`${eventName}end`] = originalEndEvent;
            }
        }
        for (const name in endEvents) {
            this._fireEvent(name, endEvents[name]);
        }
        const stillMoving = isMoving(this._eventsInProgress);
        const finishedMoving = (wasMoving || nowMoving) && !stillMoving;
        if (finishedMoving && this._terrainMovement) {
            this._map._elevationFreeze = false;
            this._terrainMovement = false;
            const tr = this._map._getTransformForUpdate();
            if (this._map.getCenterClampedToGround()) {
                tr.recalculateZoomAndCenter(this._map.terrain);
            }
            this._map._applyUpdatedTransform(tr);
        }
        if (allowEndAnimation && finishedMoving) {
            this._updatingCamera = true;
            const inertialEase = this._inertia._onMoveEnd((_a = this._map.dragPan) === null || _a === void 0 ? void 0 : _a._inertiaOptions);
            const shouldSnapToNorth = bearing => bearing !== 0 && -this._bearingSnap < bearing && bearing < this._bearingSnap;
            if (inertialEase && (inertialEase.essential || !browser.prefersReducedMotion)) {
                if (shouldSnapToNorth(inertialEase.bearing || this._map.getBearing())) {
                    inertialEase.bearing = 0;
                }
                inertialEase.freezeElevation = true;
                this._map.easeTo(inertialEase, { originalEvent: originalEndEvent });
            }
            else {
                this._map.fire(new Event('moveend', { originalEvent: originalEndEvent }));
                if (shouldSnapToNorth(this._map.getBearing())) {
                    this._map.resetNorth();
                }
            }
            this._updatingCamera = false;
        }
    }
    _fireEvent(type, e) {
        this._map.fire(new Event(type, e ? { originalEvent: e } : {}));
    }
    _requestFrame() {
        this._map.triggerRepaint();
        return this._map._renderTaskQueue.add(timeStamp => {
            delete this._frameId;
            this.handleEvent(new RenderFrameEvent('renderFrame', { timeStamp }));
            this._applyChanges();
        });
    }
    _triggerRenderFrame() {
        if (this._frameId === undefined) {
            this._frameId = this._requestFrame();
        }
    }
}
//# sourceMappingURL=handler_manager.js.map