import { TransformProvider } from './transform-provider';
import type { Map } from '../map';
import type Point from '@mapbox/point-geometry';
import { type Handler } from '../handler_manager';
export declare class BoxZoomHandler implements Handler {
    _map: Map;
    _tr: TransformProvider;
    _el: HTMLElement;
    _container: HTMLElement;
    _enabled: boolean;
    _active: boolean;
    _startPos: Point;
    _lastPos: Point;
    _box: HTMLElement;
    _clickTolerance: number;
    constructor(map: Map, options: {
        clickTolerance: number;
    });
    isEnabled(): boolean;
    isActive(): boolean;
    enable(): void;
    disable(): void;
    mousedown(e: MouseEvent, point: Point): void;
    mousemoveWindow(e: MouseEvent, point: Point): void;
    mouseupWindow(e: MouseEvent, point: Point): {
        cameraAnimation: (map: any) => any;
    };
    keydown(e: KeyboardEvent): void;
    reset(): void;
    _fireEvent(type: string, e: any): Map;
}
//# sourceMappingURL=box_zoom.d.ts.map