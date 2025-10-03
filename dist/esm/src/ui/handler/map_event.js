import { MapMouseEvent, MapTouchEvent, MapWheelEvent } from '../events';
export class MapEventHandler {
    constructor(map, options) {
        this._map = map;
        this._clickTolerance = options.clickTolerance;
    }
    reset() {
        delete this._mousedownPos;
    }
    wheel(e) {
        return this._firePreventable(new MapWheelEvent(e.type, this._map, e));
    }
    mousedown(e, point) {
        this._mousedownPos = point;
        return this._firePreventable(new MapMouseEvent(e.type, this._map, e));
    }
    mouseup(e) {
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }
    click(e, point) {
        if (this._mousedownPos && this._mousedownPos.dist(point) >= this._clickTolerance)
            return;
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }
    dblclick(e) {
        return this._firePreventable(new MapMouseEvent(e.type, this._map, e));
    }
    mouseover(e) {
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }
    mouseout(e) {
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }
    touchstart(e) {
        return this._firePreventable(new MapTouchEvent(e.type, this._map, e));
    }
    touchmove(e) {
        this._map.fire(new MapTouchEvent(e.type, this._map, e));
    }
    touchend(e) {
        this._map.fire(new MapTouchEvent(e.type, this._map, e));
    }
    touchcancel(e) {
        this._map.fire(new MapTouchEvent(e.type, this._map, e));
    }
    _firePreventable(mapEvent) {
        this._map.fire(mapEvent);
        if (mapEvent.defaultPrevented) {
            return {};
        }
    }
    isEnabled() {
        return true;
    }
    isActive() {
        return false;
    }
    enable() { }
    disable() { }
}
export class BlockableMapEventHandler {
    constructor(map) {
        this._map = map;
    }
    reset() {
        this._delayContextMenu = false;
        this._ignoreContextMenu = true;
        delete this._contextMenuEvent;
    }
    mousemove(e) {
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }
    mousedown() {
        this._delayContextMenu = true;
        this._ignoreContextMenu = false;
    }
    mouseup() {
        this._delayContextMenu = false;
        if (this._contextMenuEvent) {
            this._map.fire(new MapMouseEvent('contextmenu', this._map, this._contextMenuEvent));
            delete this._contextMenuEvent;
        }
    }
    contextmenu(e) {
        if (this._delayContextMenu) {
            this._contextMenuEvent = e;
        }
        else if (!this._ignoreContextMenu) {
            this._map.fire(new MapMouseEvent(e.type, this._map, e));
        }
        if (this._map.listens('contextmenu')) {
            e.preventDefault();
        }
    }
    isEnabled() {
        return true;
    }
    isActive() {
        return false;
    }
    enable() { }
    disable() { }
}
//# sourceMappingURL=map_event.js.map