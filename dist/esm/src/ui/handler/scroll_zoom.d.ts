import { TransformProvider } from './transform-provider';
import type { Map } from '../map';
import type Point from '@mapbox/point-geometry';
import type { AroundCenterOptions } from './two_fingers_touch';
import type { Handler } from '../handler_manager';
export declare class ScrollZoomHandler implements Handler {
    _map: Map;
    _tr: TransformProvider;
    _enabled: boolean;
    _active: boolean;
    _zooming: boolean;
    _aroundCenter: boolean;
    _aroundPoint: Point;
    _type: 'wheel' | 'trackpad' | null;
    _lastValue: number;
    _timeout: ReturnType<typeof setTimeout>;
    _finishTimeout: ReturnType<typeof setTimeout>;
    _lastWheelEvent: any;
    _lastWheelEventTime: number;
    _lastExpectedZoom: number;
    _startZoom: number;
    _targetZoom: number;
    _delta: number;
    _easing: ((a: number) => number);
    _prevEase: {
        start: number;
        duration: number;
        easing: (_: number) => number;
    };
    _frameId: boolean;
    _triggerRenderFrame: () => void;
    _defaultZoomRate: number;
    _wheelZoomRate: number;
    constructor(map: Map, triggerRenderFrame: () => void);
    setZoomRate(zoomRate: number): void;
    setWheelZoomRate(wheelZoomRate: number): void;
    isEnabled(): boolean;
    isActive(): boolean;
    isZooming(): boolean;
    enable(options?: AroundCenterOptions | boolean): void;
    disable(): void;
    _shouldBePrevented(e: WheelEvent): boolean;
    wheel(e: WheelEvent): void;
    _onTimeout: (initialEvent: MouseEvent) => void;
    _start(e: MouseEvent): void;
    renderFrame(): {
        noInertia: boolean;
        needsRenderFrame: boolean;
        zoomDelta: number;
        around: Point;
        originalEvent: any;
    };
    _smoothOutEasing(duration: number): (t: number) => number;
    reset(): void;
}
//# sourceMappingURL=scroll_zoom.d.ts.map