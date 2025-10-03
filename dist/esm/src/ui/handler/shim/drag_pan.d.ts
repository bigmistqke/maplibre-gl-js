import type { MousePanHandler } from '../mouse';
import type { TouchPanHandler } from './../touch_pan';
export type DragPanOptions = {
    linearity?: number;
    easing?: (t: number) => number;
    deceleration?: number;
    maxSpeed?: number;
};
export declare class DragPanHandler {
    _el: HTMLElement;
    _mousePan?: MousePanHandler;
    _touchPan?: TouchPanHandler;
    _inertiaOptions: DragPanOptions | boolean;
    constructor(el: HTMLElement, mousePan?: MousePanHandler, touchPan?: TouchPanHandler);
    enable(options?: DragPanOptions | boolean): void;
    disable(): void;
    isEnabled(): boolean;
    isActive(): boolean;
}
//# sourceMappingURL=drag_pan.d.ts.map