import { DOM } from '../../util/dom';
export class DragHandler {
    constructor(options) {
        this._enabled = !!options.enable;
        this._moveStateManager = options.moveStateManager;
        this._clickTolerance = options.clickTolerance || 1;
        this._moveFunction = options.move;
        this._activateOnStart = !!options.activateOnStart;
        options.assignEvents(this);
        this.reset();
    }
    reset(e) {
        this._active = false;
        this._moved = false;
        delete this._lastPoint;
        this._moveStateManager.endMove(e);
    }
    _move(...params) {
        const move = this._moveFunction(...params);
        if (move.bearingDelta || move.pitchDelta || move.rollDelta || move.around || move.panDelta) {
            this._active = true;
            return move;
        }
    }
    dragStart(e, point) {
        if (!this.isEnabled() || this._lastPoint)
            return;
        if (!this._moveStateManager.isValidStartEvent(e))
            return;
        this._moveStateManager.startMove(e);
        this._lastPoint = Array.isArray(point) ? point[0] : point;
        if (this._activateOnStart && this._lastPoint)
            this._active = true;
    }
    dragMove(e, point) {
        if (!this.isEnabled())
            return;
        const lastPoint = this._lastPoint;
        if (!lastPoint)
            return;
        e.preventDefault();
        if (!this._moveStateManager.isValidMoveEvent(e)) {
            this.reset(e);
            return;
        }
        const movePoint = Array.isArray(point) ? point[0] : point;
        if (!this._moved && movePoint.dist(lastPoint) < this._clickTolerance)
            return;
        this._moved = true;
        this._lastPoint = movePoint;
        return this._move(lastPoint, movePoint);
    }
    dragEnd(e) {
        if (!this.isEnabled() || !this._lastPoint)
            return;
        if (!this._moveStateManager.isValidEndEvent(e))
            return;
        if (this._moved)
            DOM.suppressClick();
        this.reset(e);
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
    getClickTolerance() {
        return this._clickTolerance;
    }
}
//# sourceMappingURL=drag_handler.js.map