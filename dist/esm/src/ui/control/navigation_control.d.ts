import Point from '@mapbox/point-geometry';
import { type DragMoveHandler, type DragRotateResult } from '../handler/drag_handler';
import type { Map } from '../map';
import type { IControl } from './control';
export type NavigationControlOptions = {
    showCompass?: boolean;
    showZoom?: boolean;
    visualizePitch?: boolean;
    visualizeRoll?: boolean;
};
export declare class NavigationControl implements IControl {
    _map: Map;
    options: NavigationControlOptions;
    _container: HTMLElement;
    _zoomInButton: HTMLButtonElement;
    _zoomOutButton: HTMLButtonElement;
    _compass: HTMLButtonElement;
    _compassIcon: HTMLElement;
    _handler: MouseRotateWrapper;
    constructor(options?: NavigationControlOptions);
    _updateZoomButtons: () => void;
    _rotateCompassArrow: () => void;
    onAdd(map: Map): HTMLElement;
    onRemove(): void;
    _createButton(className: string, fn: (e?: any) => unknown): HTMLButtonElement;
    _setButtonTitle: (button: HTMLButtonElement, title: "ZoomIn" | "ZoomOut" | "ResetBearing") => void;
}
declare class MouseRotateWrapper {
    map: Map;
    _clickTolerance: number;
    element: HTMLElement;
    _rotatePitchHandler: DragMoveHandler<DragRotateResult, MouseEvent | TouchEvent>;
    _startPos: Point;
    _lastPos: Point;
    constructor(map: Map, element: HTMLElement, pitch?: boolean);
    startMove(e: MouseEvent | TouchEvent, point: Point): void;
    move(e: MouseEvent | TouchEvent, point: Point): void;
    off(): void;
    offTemp(): void;
    mousedown: (e: MouseEvent) => void;
    mousemove: (e: MouseEvent) => void;
    mouseup: (e: MouseEvent) => void;
    touchstart: (e: TouchEvent) => void;
    touchmove: (e: TouchEvent) => void;
    touchend: (e: TouchEvent) => void;
    reset: () => void;
}
export {};
//# sourceMappingURL=navigation_control.d.ts.map