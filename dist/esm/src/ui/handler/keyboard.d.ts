import { type Handler } from '../handler_manager';
import type { Map } from '../map';
import { TransformProvider } from './transform-provider';
export declare class KeyboardHandler implements Handler {
    _tr: TransformProvider;
    _enabled: boolean;
    _active: boolean;
    _panStep: number;
    _bearingStep: number;
    _pitchStep: number;
    _rotationDisabled: boolean;
    constructor(map: Map);
    reset(): void;
    keydown(e: KeyboardEvent): {
        cameraAnimation: (map: Map) => void;
    };
    enable(): void;
    disable(): void;
    isEnabled(): boolean;
    isActive(): boolean;
    disableRotation(): void;
    enableRotation(): void;
}
//# sourceMappingURL=keyboard.d.ts.map