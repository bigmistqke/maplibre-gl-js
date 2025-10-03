import Point from '@mapbox/point-geometry';
import { DOM } from '../../util/dom';
import { DragHandler } from './drag_handler';
import { MouseMoveStateManager } from './drag_move_state_manager';
import { getAngleDelta } from '../../util/util';
const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;
const assignEvents = (handler) => {
    handler.mousedown = handler.dragStart;
    handler.mousemoveWindow = handler.dragMove;
    handler.mouseup = handler.dragEnd;
    handler.contextmenu = (e) => {
        e.preventDefault();
    };
};
export function generateMousePanHandler({ enable, clickTolerance }) {
    const mouseMoveStateManager = new MouseMoveStateManager({
        checkCorrectEvent: (e) => DOM.mouseButton(e) === LEFT_BUTTON && !e.ctrlKey,
    });
    return new DragHandler({
        clickTolerance,
        move: (lastPoint, point) => ({ around: point, panDelta: point.sub(lastPoint) }),
        activateOnStart: true,
        moveStateManager: mouseMoveStateManager,
        enable,
        assignEvents,
    });
}
;
export function generateMouseRotationHandler({ enable, clickTolerance, aroundCenter = true, minPixelCenterThreshold = 100, rotateDegreesPerPixelMoved = 0.8 }, getCenter) {
    const mouseMoveStateManager = new MouseMoveStateManager({
        checkCorrectEvent: (e) => (DOM.mouseButton(e) === LEFT_BUTTON && e.ctrlKey) ||
            (DOM.mouseButton(e) === RIGHT_BUTTON && !e.ctrlKey),
    });
    return new DragHandler({
        clickTolerance,
        move: (lastPoint, currentPoint) => {
            const center = getCenter();
            if (aroundCenter && Math.abs(center.y - lastPoint.y) > minPixelCenterThreshold) {
                return { bearingDelta: getAngleDelta(new Point(lastPoint.x, currentPoint.y), currentPoint, center) };
            }
            let bearingDelta = (currentPoint.x - lastPoint.x) * rotateDegreesPerPixelMoved;
            if (aroundCenter && currentPoint.y < center.y) {
                bearingDelta = -bearingDelta;
            }
            return { bearingDelta };
        },
        moveStateManager: mouseMoveStateManager,
        enable,
        assignEvents,
    });
}
;
export function generateMousePitchHandler({ enable, clickTolerance, pitchDegreesPerPixelMoved = -0.5 }) {
    const mouseMoveStateManager = new MouseMoveStateManager({
        checkCorrectEvent: (e) => (DOM.mouseButton(e) === LEFT_BUTTON && e.ctrlKey) ||
            (DOM.mouseButton(e) === RIGHT_BUTTON),
    });
    return new DragHandler({
        clickTolerance,
        move: (lastPoint, point) => ({ pitchDelta: (point.y - lastPoint.y) * pitchDegreesPerPixelMoved }),
        moveStateManager: mouseMoveStateManager,
        enable,
        assignEvents,
    });
}
;
export function generateMouseRollHandler({ enable, clickTolerance, rollDegreesPerPixelMoved = 0.3 }, getCenter) {
    const mouseMoveStateManager = new MouseMoveStateManager({
        checkCorrectEvent: (e) => (DOM.mouseButton(e) === RIGHT_BUTTON && e.ctrlKey),
    });
    return new DragHandler({
        clickTolerance,
        move: (lastPoint, currentPoint) => {
            const center = getCenter();
            let rollDelta = (currentPoint.x - lastPoint.x) * rollDegreesPerPixelMoved;
            if (currentPoint.y < center.y) {
                rollDelta = -rollDelta;
            }
            return { rollDelta };
        },
        moveStateManager: mouseMoveStateManager,
        enable,
        assignEvents,
    });
}
;
//# sourceMappingURL=mouse.js.map