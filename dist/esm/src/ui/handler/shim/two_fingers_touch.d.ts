import type { TwoFingersTouchZoomHandler, TwoFingersTouchRotateHandler, AroundCenterOptions } from '../two_fingers_touch';
import type { TapDragZoomHandler } from '../tap_drag_zoom';
export declare class TwoFingersTouchZoomRotateHandler {
    _el: HTMLElement;
    _touchZoom?: TwoFingersTouchZoomHandler;
    _touchRotate?: TwoFingersTouchRotateHandler;
    _tapDragZoom?: TapDragZoomHandler;
    _rotationDisabled: boolean;
    _enabled: boolean;
    constructor(el: HTMLElement, touchZoom?: TwoFingersTouchZoomHandler, touchRotate?: TwoFingersTouchRotateHandler, tapDragZoom?: TapDragZoomHandler);
    enable(options?: AroundCenterOptions | boolean | null): void;
    disable(): void;
    isEnabled(): boolean;
    isActive(): boolean;
    disableRotation(): void;
    enableRotation(): void;
}
//# sourceMappingURL=two_fingers_touch.d.ts.map