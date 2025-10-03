import type Point from '@mapbox/point-geometry';
import { type DragMoveStateManager } from './drag_move_state_manager';
import { type Handler } from '../handler_manager';
interface DragMovementResult {
    bearingDelta?: number;
    pitchDelta?: number;
    rollDelta?: number;
    around?: Point;
    panDelta?: Point;
}
export interface DragPanResult extends DragMovementResult {
    around: Point;
    panDelta: Point;
}
export interface DragRotateResult extends DragMovementResult {
    bearingDelta: number;
}
export interface DragPitchResult extends DragMovementResult {
    pitchDelta: number;
}
export interface DragRollResult extends DragMovementResult {
    rollDelta: number;
}
type DragMoveFunction<T extends DragMovementResult> = (lastPoint: Point, currnetPoint: Point) => T;
export interface DragMoveHandler<T extends DragMovementResult, E extends Event> extends Handler {
    dragStart: (e: E, point: Point) => void;
    dragMove: (e: E, point: Point) => T | void;
    dragEnd: (e: E) => void;
}
export type DragMoveHandlerOptions<T, E extends Event> = {
    clickTolerance: number;
    move: DragMoveFunction<T>;
    moveStateManager: DragMoveStateManager<E>;
    assignEvents: (handler: DragMoveHandler<T, E>) => void;
    activateOnStart?: boolean;
    enable?: boolean;
};
export declare class DragHandler<T extends DragMovementResult, E extends Event> implements DragMoveHandler<T, E> {
    contextmenu?: Handler['contextmenu'];
    mousedown?: Handler['mousedown'];
    mousemoveWindow?: Handler['mousemoveWindow'];
    mouseup?: Handler['mouseup'];
    touchstart?: Handler['touchstart'];
    touchmoveWindow?: Handler['touchmoveWindow'];
    touchend?: Handler['touchend'];
    _clickTolerance: number;
    _moveFunction: DragMoveFunction<T>;
    _activateOnStart: boolean;
    _active: boolean;
    _enabled: boolean;
    _moved: boolean;
    _lastPoint: Point | null;
    _moveStateManager: DragMoveStateManager<E>;
    constructor(options: DragMoveHandlerOptions<T, E>);
    reset(e?: E): void;
    _move(...params: Parameters<DragMoveFunction<T>>): T;
    dragStart(e: E, point: Point): any;
    dragStart(e: E, point: Point[]): any;
    dragMove(e: E, point: Point): any;
    dragMove(e: E, point: Point[]): any;
    dragEnd(e: E): void;
    enable(): void;
    disable(): void;
    isEnabled(): boolean;
    isActive(): boolean;
    getClickTolerance(): number;
}
export {};
//# sourceMappingURL=drag_handler.d.ts.map