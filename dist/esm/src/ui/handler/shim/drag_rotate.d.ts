import type { MousePitchHandler, MouseRollHandler, MouseRotateHandler } from '../mouse';
export type DragRotateHandlerOptions = {
    pitchWithRotate: boolean;
    rollEnabled: boolean;
};
export declare class DragRotateHandler {
    _mouseRotate: MouseRotateHandler;
    _mousePitch: MousePitchHandler;
    _mouseRoll: MouseRollHandler;
    _pitchWithRotate: boolean;
    _rollEnabled: boolean;
    constructor(options: DragRotateHandlerOptions, mouseRotate: MouseRotateHandler, mousePitch: MousePitchHandler, mouseRoll: MouseRollHandler);
    enable(): void;
    disable(): void;
    isEnabled(): boolean;
    isActive(): boolean;
}
//# sourceMappingURL=drag_rotate.d.ts.map