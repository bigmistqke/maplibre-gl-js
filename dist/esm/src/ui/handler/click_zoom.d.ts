import type Point from '@mapbox/point-geometry';
import type { Map } from '../map';
import { TransformProvider } from './transform-provider';
import { type Handler } from '../handler_manager';
export declare class ClickZoomHandler implements Handler {
    _tr: TransformProvider;
    _enabled: boolean;
    _active: boolean;
    constructor(map: Map);
    reset(): void;
    dblclick(e: MouseEvent, point: Point): {
        cameraAnimation: (map: Map) => void;
    };
    enable(): void;
    disable(): void;
    isEnabled(): boolean;
    isActive(): boolean;
}
//# sourceMappingURL=click_zoom.d.ts.map