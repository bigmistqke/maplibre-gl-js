import Point from '@mapbox/point-geometry';
import { type DragMoveHandler, type DragPanResult, type DragRotateResult, type DragPitchResult, type DragRollResult } from './drag_handler';
export interface MousePanHandler extends DragMoveHandler<DragPanResult, MouseEvent> {
}
export interface MouseRotateHandler extends DragMoveHandler<DragRotateResult, MouseEvent> {
}
export interface MousePitchHandler extends DragMoveHandler<DragPitchResult, MouseEvent> {
}
export interface MouseRollHandler extends DragMoveHandler<DragRollResult, MouseEvent> {
}
export declare function generateMousePanHandler({ enable, clickTolerance }: {
    clickTolerance: number;
    enable?: boolean;
}): MousePanHandler;
export declare function generateMouseRotationHandler({ enable, clickTolerance, aroundCenter, minPixelCenterThreshold, rotateDegreesPerPixelMoved }: {
    clickTolerance: number;
    enable?: boolean;
    aroundCenter?: boolean;
    minPixelCenterThreshold?: number;
    rotateDegreesPerPixelMoved?: number;
}, getCenter: () => Point): MouseRotateHandler;
export declare function generateMousePitchHandler({ enable, clickTolerance, pitchDegreesPerPixelMoved }: {
    clickTolerance: number;
    pitchDegreesPerPixelMoved?: number;
    enable?: boolean;
}): MousePitchHandler;
export declare function generateMouseRollHandler({ enable, clickTolerance, rollDegreesPerPixelMoved }: {
    clickTolerance: number;
    rollDegreesPerPixelMoved?: number;
    enable?: boolean;
}, getCenter: () => Point): MouseRollHandler;
//# sourceMappingURL=mouse.d.ts.map