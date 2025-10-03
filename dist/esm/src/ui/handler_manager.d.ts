import { Event } from '../util/evented';
import { type Map, type CompleteMapOptions } from './map';
import { HandlerInertia } from './handler_inertia';
import Point from '@mapbox/point-geometry';
export interface Handler {
    enable(): void;
    disable(): void;
    isEnabled(): boolean;
    isActive(): boolean;
    reset(): void;
    readonly touchstart?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => HandlerResult | void;
    readonly touchmove?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => HandlerResult | void;
    readonly touchmoveWindow?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => HandlerResult | void;
    readonly touchend?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => HandlerResult | void;
    readonly touchcancel?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => HandlerResult | void;
    readonly mousedown?: (e: MouseEvent, point: Point) => HandlerResult | void;
    readonly mousemove?: (e: MouseEvent, point: Point) => HandlerResult | void;
    readonly mousemoveWindow?: (e: MouseEvent, point: Point) => HandlerResult | void;
    readonly mouseup?: (e: MouseEvent, point: Point) => HandlerResult | void;
    readonly mouseupWindow?: (e: MouseEvent, point: Point) => HandlerResult | void;
    readonly dblclick?: (e: MouseEvent, point: Point) => HandlerResult | void;
    readonly contextmenu?: (e: MouseEvent) => HandlerResult | void;
    readonly wheel?: (e: WheelEvent, point: Point) => HandlerResult | void;
    readonly keydown?: (e: KeyboardEvent) => HandlerResult | void;
    readonly keyup?: (e: KeyboardEvent) => HandlerResult | void;
    readonly renderFrame?: () => HandlerResult | void;
}
export type HandlerResult = {
    panDelta?: Point;
    zoomDelta?: number;
    bearingDelta?: number;
    pitchDelta?: number;
    rollDelta?: number;
    around?: Point | null;
    pinchAround?: Point | null;
    cameraAnimation?: (map: Map) => any;
    originalEvent?: Event;
    needsRenderFrame?: boolean;
    noInertia?: boolean;
};
export type HandlerFactory = (map: Map, options: CompleteMapOptions, manager: HandlerManager) => void;
export declare function registerHandler(name: string, factory: HandlerFactory): void;
export declare function getHandlerFactory(name: string): HandlerFactory | undefined;
export type EventInProgress = {
    handlerName: string;
    originalEvent: Event;
};
export type EventsInProgress = {
    zoom?: EventInProgress;
    roll?: EventInProgress;
    pitch?: EventInProgress;
    rotate?: EventInProgress;
    drag?: EventInProgress;
};
export declare class HandlerManager {
    _map: Map;
    _el: HTMLElement;
    _handlers: Array<{
        handlerName: string;
        handler: Handler;
        allowed: Array<string>;
    }>;
    _eventsInProgress: EventsInProgress;
    _frameId: number;
    _inertia: HandlerInertia;
    _bearingSnap: number;
    _handlersById: {
        [x: string]: Handler;
    };
    _updatingCamera: boolean;
    _changes: Array<[HandlerResult, EventsInProgress, {
        [handlerName: string]: Event;
    }]>;
    _terrainMovement: boolean;
    _zoom: {
        handlerName: string;
    };
    _previousActiveHandlers: {
        [x: string]: Handler;
    };
    _listeners: Array<[
        Window | Document | HTMLElement,
        string,
        {
            passive?: boolean;
            capture?: boolean;
        } | undefined
    ]>;
    constructor(map: Map, options: CompleteMapOptions);
    destroy(): void;
    _addDefaultHandlers(options: CompleteMapOptions): void;
    _add(handlerName: string, handler: Handler, allowed?: Array<string>): void;
    stop(allowEndAnimation: boolean): void;
    isActive(): boolean;
    isZooming(): boolean;
    isRotating(): boolean;
    isMoving(): boolean;
    _blockedByActive(activeHandlers: {
        [x: string]: Handler;
    }, allowed: Array<string>, myName: string): boolean;
    handleWindowEvent: (e: {
        type: "mousemove" | "mouseup" | "touchmove";
    }) => void;
    _getMapTouches(touches: TouchList): TouchList;
    handleEvent: (e: Event, eventName?: keyof Handler) => void;
    mergeHandlerResult(mergedHandlerResult: HandlerResult, eventsInProgress: EventsInProgress, handlerResult: HandlerResult, name: string, e?: UIEvent): void;
    _applyChanges(): void;
    _updateMapTransform(combinedResult: HandlerResult, combinedEventsInProgress: EventsInProgress, deactivatedHandlers: {
        [handlerName: string]: Event;
    }): void;
    _fireEvents(newEventsInProgress: EventsInProgress, deactivatedHandlers: {
        [handlerName: string]: Event;
    }, allowEndAnimation: boolean): void;
    _fireEvent(type: string, e?: Event): void;
    _requestFrame(): number;
    _triggerRenderFrame(): void;
}
//# sourceMappingURL=handler_manager.d.ts.map