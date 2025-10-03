import { DOM } from '../../util/dom';
class TwoFingersTouchHandler {
    constructor() {
        this.reset();
    }
    reset() {
        this._active = false;
        delete this._firstTwoTouches;
    }
    touchstart(e, points, mapTouches) {
        if (this._firstTwoTouches || mapTouches.length < 2)
            return;
        this._firstTwoTouches = [
            mapTouches[0].identifier,
            mapTouches[1].identifier
        ];
        this._start([points[0], points[1]]);
    }
    touchmove(e, points, mapTouches) {
        if (!this._firstTwoTouches)
            return;
        e.preventDefault();
        const [idA, idB] = this._firstTwoTouches;
        const a = getTouchById(mapTouches, points, idA);
        const b = getTouchById(mapTouches, points, idB);
        if (!a || !b)
            return;
        const pinchAround = this._aroundCenter ? null : a.add(b).div(2);
        return this._move([a, b], pinchAround, e);
    }
    touchend(e, points, mapTouches) {
        if (!this._firstTwoTouches)
            return;
        const [idA, idB] = this._firstTwoTouches;
        const a = getTouchById(mapTouches, points, idA);
        const b = getTouchById(mapTouches, points, idB);
        if (a && b)
            return;
        if (this._active)
            DOM.suppressClick();
        this.reset();
    }
    touchcancel() {
        this.reset();
    }
    enable(options) {
        this._enabled = true;
        this._aroundCenter = !!options && options.around === 'center';
    }
    disable() {
        this._enabled = false;
        this.reset();
    }
    isEnabled() {
        return !!this._enabled;
    }
    isActive() {
        return !!this._active;
    }
}
function getTouchById(mapTouches, points, identifier) {
    for (let i = 0; i < mapTouches.length; i++) {
        if (mapTouches[i].identifier === identifier)
            return points[i];
    }
    return undefined;
}
const ZOOM_THRESHOLD = 0.1;
function getZoomDelta(distance, lastDistance) {
    return Math.log(distance / lastDistance) / Math.LN2;
}
export class TwoFingersTouchZoomHandler extends TwoFingersTouchHandler {
    reset() {
        super.reset();
        delete this._distance;
        delete this._startDistance;
    }
    _start(points) {
        this._startDistance = this._distance = points[0].dist(points[1]);
    }
    _move(points, pinchAround) {
        const lastDistance = this._distance;
        this._distance = points[0].dist(points[1]);
        if (!this._active && Math.abs(getZoomDelta(this._distance, this._startDistance)) < ZOOM_THRESHOLD)
            return;
        this._active = true;
        return {
            zoomDelta: getZoomDelta(this._distance, lastDistance),
            pinchAround
        };
    }
}
const ROTATION_THRESHOLD = 25;
function getBearingDelta(a, b) {
    return a.angleWith(b) * 180 / Math.PI;
}
export class TwoFingersTouchRotateHandler extends TwoFingersTouchHandler {
    reset() {
        super.reset();
        delete this._minDiameter;
        delete this._startVector;
        delete this._vector;
    }
    _start(points) {
        this._startVector = this._vector = points[0].sub(points[1]);
        this._minDiameter = points[0].dist(points[1]);
    }
    _move(points, pinchAround, _e) {
        const lastVector = this._vector;
        this._vector = points[0].sub(points[1]);
        if (!this._active && this._isBelowThreshold(this._vector))
            return;
        this._active = true;
        return {
            bearingDelta: getBearingDelta(this._vector, lastVector),
            pinchAround
        };
    }
    _isBelowThreshold(vector) {
        this._minDiameter = Math.min(this._minDiameter, vector.mag());
        const circumference = Math.PI * this._minDiameter;
        const threshold = ROTATION_THRESHOLD / circumference * 360;
        const bearingDeltaSinceStart = getBearingDelta(vector, this._startVector);
        return Math.abs(bearingDeltaSinceStart) < threshold;
    }
}
function isVertical(vector) {
    return Math.abs(vector.y) > Math.abs(vector.x);
}
const ALLOWED_SINGLE_TOUCH_TIME = 100;
export class TwoFingersTouchPitchHandler extends TwoFingersTouchHandler {
    constructor(map) {
        super();
        this._currentTouchCount = 0;
        this._map = map;
    }
    reset() {
        super.reset();
        this._valid = undefined;
        delete this._firstMove;
        delete this._lastPoints;
    }
    touchstart(e, points, mapTouches) {
        super.touchstart(e, points, mapTouches);
        this._currentTouchCount = mapTouches.length;
    }
    _start(points) {
        this._lastPoints = points;
        if (isVertical(points[0].sub(points[1]))) {
            this._valid = false;
        }
    }
    _move(points, center, e) {
        var _a;
        if (((_a = this._map.cooperativeGestures) === null || _a === void 0 ? void 0 : _a.isEnabled()) && this._currentTouchCount < 3) {
            return;
        }
        const vectorA = points[0].sub(this._lastPoints[0]);
        const vectorB = points[1].sub(this._lastPoints[1]);
        this._valid = this.gestureBeginsVertically(vectorA, vectorB, e.timeStamp);
        if (!this._valid)
            return;
        this._lastPoints = points;
        this._active = true;
        const yDeltaAverage = (vectorA.y + vectorB.y) / 2;
        const degreesPerPixelMoved = -0.5;
        return {
            pitchDelta: yDeltaAverage * degreesPerPixelMoved
        };
    }
    gestureBeginsVertically(vectorA, vectorB, timeStamp) {
        if (this._valid !== undefined)
            return this._valid;
        const threshold = 2;
        const movedA = vectorA.mag() >= threshold;
        const movedB = vectorB.mag() >= threshold;
        if (!movedA && !movedB)
            return;
        if (!movedA || !movedB) {
            if (this._firstMove === undefined) {
                this._firstMove = timeStamp;
            }
            if (timeStamp - this._firstMove < ALLOWED_SINGLE_TOUCH_TIME) {
                return undefined;
            }
            else {
                return false;
            }
        }
        const isSameDirection = vectorA.y > 0 === vectorB.y > 0;
        return isVertical(vectorA) && isVertical(vectorB) && isSameDirection;
    }
}
//# sourceMappingURL=two_fingers_touch.js.map