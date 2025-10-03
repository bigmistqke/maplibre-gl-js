import { type Handler } from '../handler_manager';
import { TapRecognizer } from './tap_recognizer';
import type Point from '@mapbox/point-geometry';
export declare class TapDragZoomHandler implements Handler {
    _enabled: boolean;
    _active: boolean;
    _swipePoint: Point;
    _swipeTouch: number;
    _tapTime: number;
    _tapPoint: Point;
    _tap: TapRecognizer;
    constructor();
    reset(): void;
    touchstart(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>): void;
    touchmove(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>): {
        zoomDelta: number;
    };
    touchend(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>): void;
    touchcancel(): void;
    enable(): void;
    disable(): void;
    isEnabled(): boolean;
    isActive(): boolean;
}
//# sourceMappingURL=tap_drag_zoom.d.ts.map