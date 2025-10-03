import { DOM } from '../../util/dom';
const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;
const BUTTONS_FLAGS = {
    [LEFT_BUTTON]: 1,
    [RIGHT_BUTTON]: 2
};
function buttonNoLongerPressed(e, button) {
    const flag = BUTTONS_FLAGS[button];
    return e.buttons === undefined || (e.buttons & flag) !== flag;
}
export class MouseMoveStateManager {
    constructor(options) {
        this._correctEvent = options.checkCorrectEvent;
    }
    startMove(e) {
        const eventButton = DOM.mouseButton(e);
        this._eventButton = eventButton;
    }
    endMove(_e) {
        delete this._eventButton;
    }
    isValidStartEvent(e) {
        return this._correctEvent(e);
    }
    isValidMoveEvent(e) {
        return !buttonNoLongerPressed(e, this._eventButton);
    }
    isValidEndEvent(e) {
        const eventButton = DOM.mouseButton(e);
        return eventButton === this._eventButton;
    }
}
export class OneFingerTouchMoveStateManager {
    constructor() {
        this._firstTouch = undefined;
    }
    _isOneFingerTouch(e) {
        return e.targetTouches.length === 1;
    }
    _isSameTouchEvent(e) {
        return e.targetTouches[0].identifier === this._firstTouch;
    }
    startMove(e) {
        const firstTouch = e.targetTouches[0].identifier;
        this._firstTouch = firstTouch;
    }
    endMove(_e) {
        delete this._firstTouch;
    }
    isValidStartEvent(e) {
        return this._isOneFingerTouch(e);
    }
    isValidMoveEvent(e) {
        return this._isOneFingerTouch(e) && this._isSameTouchEvent(e);
    }
    isValidEndEvent(e) {
        return this._isOneFingerTouch(e) && this._isSameTouchEvent(e);
    }
}
export class MouseOrTouchMoveStateManager {
    constructor(mouseMoveStateManager = new MouseMoveStateManager({ checkCorrectEvent: () => true }), oneFingerTouchMoveStateManager = new OneFingerTouchMoveStateManager()) {
        this.mouseMoveStateManager = mouseMoveStateManager;
        this.oneFingerTouchMoveStateManager = oneFingerTouchMoveStateManager;
    }
    _executeRelevantHandler(e, onMouseEvent, onTouchEvent) {
        if (e instanceof MouseEvent)
            return onMouseEvent(e);
        if (typeof TouchEvent !== 'undefined' && e instanceof TouchEvent)
            return onTouchEvent(e);
    }
    startMove(e) {
        this._executeRelevantHandler(e, e => this.mouseMoveStateManager.startMove(e), e => this.oneFingerTouchMoveStateManager.startMove(e));
    }
    endMove(e) {
        this._executeRelevantHandler(e, e => this.mouseMoveStateManager.endMove(e), e => this.oneFingerTouchMoveStateManager.endMove(e));
    }
    isValidStartEvent(e) {
        return this._executeRelevantHandler(e, e => this.mouseMoveStateManager.isValidStartEvent(e), e => this.oneFingerTouchMoveStateManager.isValidStartEvent(e));
    }
    isValidMoveEvent(e) {
        return this._executeRelevantHandler(e, e => this.mouseMoveStateManager.isValidMoveEvent(e), e => this.oneFingerTouchMoveStateManager.isValidMoveEvent(e));
    }
    isValidEndEvent(e) {
        return this._executeRelevantHandler(e, e => this.mouseMoveStateManager.isValidEndEvent(e), e => this.oneFingerTouchMoveStateManager.isValidEndEvent(e));
    }
}
//# sourceMappingURL=drag_move_state_manager.js.map