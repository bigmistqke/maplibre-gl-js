import { Event } from '../../util/evented';
import { type Handler } from '../handler_manager';
import type { Map } from '../map';
export type GestureOptions = boolean;
export declare class CooperativeGesturesHandler implements Handler {
    _options: GestureOptions;
    _map: Map;
    _container: HTMLElement;
    _bypassKey: 'metaKey' | 'ctrlKey';
    _enabled: boolean;
    constructor(map: Map, options: GestureOptions);
    isActive(): boolean;
    reset(): void;
    _setupUI(): void;
    _destroyUI(): void;
    enable(): void;
    disable(): void;
    isEnabled(): boolean;
    isBypassed(event: MouseEvent | WheelEvent | PointerEvent): boolean;
    notifyGestureBlocked(gestureType: 'wheel_zoom' | 'touch_pan', originalEvent: Event): void;
}
//# sourceMappingURL=cooperative_gestures.d.ts.map