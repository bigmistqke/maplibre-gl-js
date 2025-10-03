export interface DragMoveStateManager<E extends Event> {
    startMove: (e: E) => void;
    endMove: (e?: E) => void;
    isValidStartEvent: (e: E) => boolean;
    isValidMoveEvent: (e: E) => boolean;
    isValidEndEvent: (e?: E) => boolean;
}
export declare class MouseMoveStateManager implements DragMoveStateManager<MouseEvent> {
    _eventButton: number | undefined;
    _correctEvent: (e: MouseEvent) => boolean;
    constructor(options: {
        checkCorrectEvent: (e: MouseEvent) => boolean;
    });
    startMove(e: MouseEvent): void;
    endMove(_e?: MouseEvent): void;
    isValidStartEvent(e: MouseEvent): boolean;
    isValidMoveEvent(e: MouseEvent): boolean;
    isValidEndEvent(e: MouseEvent): boolean;
}
export declare class OneFingerTouchMoveStateManager implements DragMoveStateManager<TouchEvent> {
    _firstTouch: number | undefined;
    constructor();
    _isOneFingerTouch(e: TouchEvent): boolean;
    _isSameTouchEvent(e: TouchEvent): boolean;
    startMove(e: TouchEvent): void;
    endMove(_e?: TouchEvent): void;
    isValidStartEvent(e: TouchEvent): boolean;
    isValidMoveEvent(e: TouchEvent): boolean;
    isValidEndEvent(e: TouchEvent): boolean;
}
export declare class MouseOrTouchMoveStateManager implements DragMoveStateManager<MouseEvent | TouchEvent> {
    private mouseMoveStateManager;
    private oneFingerTouchMoveStateManager;
    constructor(mouseMoveStateManager?: MouseMoveStateManager, oneFingerTouchMoveStateManager?: OneFingerTouchMoveStateManager);
    _executeRelevantHandler(e: MouseEvent | TouchEvent, onMouseEvent: (MouseEvent: any) => any, onTouchEvent: (TouchEvent: any) => any): any;
    startMove(e: MouseEvent | TouchEvent): void;
    endMove(e?: MouseEvent | TouchEvent): void;
    isValidStartEvent(e: MouseEvent | TouchEvent): any;
    isValidMoveEvent(e: MouseEvent | TouchEvent): any;
    isValidEndEvent(e?: MouseEvent | TouchEvent): any;
}
//# sourceMappingURL=drag_move_state_manager.d.ts.map