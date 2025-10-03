import type { ClickZoomHandler } from '../click_zoom';
import type { TapZoomHandler } from './../tap_zoom';
export declare class DoubleClickZoomHandler {
    _clickZoom: ClickZoomHandler;
    _tapZoom: TapZoomHandler;
    constructor(clickZoom: ClickZoomHandler, TapZoom: TapZoomHandler);
    enable(): void;
    disable(): void;
    isEnabled(): boolean;
    isActive(): boolean;
}
//# sourceMappingURL=dblclick_zoom.d.ts.map