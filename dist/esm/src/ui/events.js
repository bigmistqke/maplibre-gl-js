import { Event } from '../util/evented';
import { DOM } from '../util/dom';
import Point from '@mapbox/point-geometry';
import { extend } from '../util/util';
export class MapMouseEvent extends Event {
    preventDefault() {
        this._defaultPrevented = true;
    }
    get defaultPrevented() {
        return this._defaultPrevented;
    }
    constructor(type, map, originalEvent, data = {}) {
        originalEvent = originalEvent instanceof MouseEvent ? originalEvent : new MouseEvent(type, originalEvent);
        const point = DOM.mousePos(map.getCanvas(), originalEvent);
        const lngLat = map.unproject(point);
        super(type, extend({ point, lngLat, originalEvent }, data));
        this._defaultPrevented = false;
        this.target = map;
    }
}
export class MapTouchEvent extends Event {
    preventDefault() {
        this._defaultPrevented = true;
    }
    get defaultPrevented() {
        return this._defaultPrevented;
    }
    constructor(type, map, originalEvent) {
        const touches = type === 'touchend' ? originalEvent.changedTouches : originalEvent.touches;
        const points = DOM.touchPos(map.getCanvasContainer(), touches);
        const lngLats = points.map((t) => map.unproject(t));
        const point = points.reduce((prev, curr, i, arr) => {
            return prev.add(curr.div(arr.length));
        }, new Point(0, 0));
        const lngLat = map.unproject(point);
        super(type, { points, point, lngLats, lngLat, originalEvent });
        this._defaultPrevented = false;
    }
}
export class MapWheelEvent extends Event {
    preventDefault() {
        this._defaultPrevented = true;
    }
    get defaultPrevented() {
        return this._defaultPrevented;
    }
    constructor(type, map, originalEvent) {
        super(type, { originalEvent });
        this._defaultPrevented = false;
    }
}
//# sourceMappingURL=events.js.map