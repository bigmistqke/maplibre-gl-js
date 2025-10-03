import type Point from '@mapbox/point-geometry';
import type { Map } from '../map';
import { type Handler, type HandlerResult } from '../handler_manager';
export type AroundCenterOptions = {
    around: 'center';
};
declare abstract class TwoFingersTouchHandler implements Handler {
    _enabled?: boolean;
    _active?: boolean;
    _firstTwoTouches?: [number, number];
    _vector?: Point;
    _startVector?: Point;
    _aroundCenter?: boolean;
    constructor();
    reset(): void;
    abstract _start(points: [Point, Point]): void;
    abstract _move(points: [Point, Point], pinchAround: Point | null, e: TouchEvent): HandlerResult | void;
    touchstart(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>): void;
    touchmove(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>): HandlerResult | void;
    touchend(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>): void;
    touchcancel(): void;
    enable(options?: AroundCenterOptions | boolean | null): void;
    disable(): void;
    isEnabled(): boolean;
    isActive(): boolean;
}
export declare class TwoFingersTouchZoomHandler extends TwoFingersTouchHandler {
    _distance?: number;
    _startDistance?: number;
    reset(): void;
    _start(points: [Point, Point]): void;
    _move(points: [Point, Point], pinchAround: Point | null): HandlerResult | void;
}
export declare class TwoFingersTouchRotateHandler extends TwoFingersTouchHandler {
    _minDiameter?: number;
    reset(): void;
    _start(points: [Point, Point]): void;
    _move(points: [Point, Point], pinchAround: Point | null, _e: TouchEvent): HandlerResult | void;
    _isBelowThreshold(vector: Point): boolean;
}
export declare class TwoFingersTouchPitchHandler extends TwoFingersTouchHandler {
    _valid?: boolean;
    _firstMove?: number;
    _lastPoints?: [Point, Point];
    _map: Map;
    _currentTouchCount: number;
    constructor(map: Map);
    reset(): void;
    touchstart(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>): void;
    _start(points: [Point, Point]): void;
    _move(points: [Point, Point], center: Point | null, e: TouchEvent): HandlerResult | void;
    gestureBeginsVertically(vectorA: Point, vectorB: Point, timeStamp: number): boolean | undefined;
}
export {};
//# sourceMappingURL=two_fingers_touch.d.ts.map