import type { Map } from './map';
import type { DragPanOptions } from './handler/shim/drag_pan';
import { type EaseToOptions } from './camera';
export type InertiaOptions = {
    linearity: number;
    easing: (t: number) => number;
    deceleration: number;
    maxSpeed: number;
};
export declare class HandlerInertia {
    _map: Map;
    _inertiaBuffer: Array<{
        time: number;
        settings: any;
    }>;
    constructor(map: Map);
    clear(): void;
    record(settings: any): void;
    _drainInertiaBuffer(): void;
    _onMoveEnd(panInertiaOptions?: DragPanOptions | boolean): EaseToOptions;
}
//# sourceMappingURL=handler_inertia.d.ts.map