import Point from '@mapbox/point-geometry';
import type { WorkerGlobalScopeInterface } from './web_worker';
import { mat4, quat, vec3, type vec4 } from 'gl-matrix';
import { type OverscaledTileID } from '../source/tile_id';
import type { Event } from './evented';
export declare function createVec4f64(): vec4;
export declare function createVec3f64(): vec3;
export declare function createMat4f64(): mat4;
export declare function createMat4f32(): mat4;
export declare function createIdentityMat4f64(): mat4;
export declare function createIdentityMat4f32(): mat4;
export declare function translatePosition(transform: {
    bearingInRadians: number;
    zoom: number;
}, tile: {
    tileID: OverscaledTileID;
    tileSize: number;
}, translate: [number, number], translateAnchor: 'map' | 'viewport', inViewportPixelUnitsUnits?: boolean): [number, number];
export declare function pointPlaneSignedDistance(plane: vec4 | [number, number, number, number], point: vec3 | [number, number, number]): number;
export declare function threePlaneIntersection(plane0: vec4, plane1: vec4, plane2: vec4): vec3 | null;
export declare function rayPlaneIntersection(origin: vec3, direction: vec3, plane: vec4): number | null;
export declare function solveQuadratic(a: number, b: number, c: number): {
    t0: number;
    t1: number;
};
export declare function angleToRotateBetweenVectors2D(vec1x: number, vec1y: number, vec2x: number, vec2y: number): number;
export declare function differenceOfAnglesDegrees(degreesA: number, degreesB: number): number;
export declare function differenceOfAnglesRadians(degreesA: number, degreesB: number): number;
export declare function distanceOfAnglesDegrees(degreesA: number, degreesB: number): number;
export declare function distanceOfAnglesRadians(radiansA: number, radiansB: number): number;
export declare function mod(n: any, m: any): number;
export declare function remapSaturate(value: number, oldRangeMin: number, oldRangeMax: number, newRangeMin: number, newRangeMax: number): number;
export declare function lerp(a: number, b: number, mix: number): number;
export declare function getAABB(points: Array<Point>): [number, number, number, number];
export declare function easeCubicInOut(t: number): number;
export declare function bezier(p1x: number, p1y: number, p2x: number, p2y: number): (t: number) => number;
export declare const defaultEasing: (t: number) => number;
export declare function clamp(n: number, min: number, max: number): number;
export declare function wrap(n: number, min: number, max: number): number;
export declare function keysDifference<S, T>(obj: {
    [key: string]: S;
}, other: {
    [key: string]: T;
}): Array<string>;
export declare function extend<T extends {}, U>(dest: T, source: U): T & U;
export declare function extend<T extends {}, U, V>(dest: T, source1: U, source2: V): T & U & V;
export declare function extend<T extends {}, U, V, W>(dest: T, source1: U, source2: V, source3: W): T & U & V & W;
export declare function extend(dest: object, ...sources: Array<any>): any;
type KeysOfUnion<T> = T extends T ? keyof T : never;
export declare function pick<T extends object>(src: T, properties: Array<KeysOfUnion<T>>): Partial<T>;
export declare function uniqueId(): number;
export declare function isPowerOfTwo(value: number): boolean;
export declare function nextPowerOfTwo(value: number): number;
export declare function zoomScale(zoom: number): number;
export declare function scaleZoom(scale: number): number;
export declare function mapObject(input: any, iterator: Function, context?: any): any;
export declare function filterObject(input: any, iterator: Function, context?: any): any;
export declare function deepEqual(a?: unknown | null, b?: unknown | null): boolean;
export declare function clone<T>(input: T): T;
export declare function arraysIntersect<T>(a: Array<T>, b: Array<T>): boolean;
export declare function warnOnce(message: string): void;
export declare function isCounterClockwise(a: Point, b: Point, c: Point): boolean;
export declare function findLineIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null;
export declare function sphericalToCartesian([r, azimuthal, polar]: [number, number, number]): {
    x: number;
    y: number;
    z: number;
};
export declare function isWorker(self: any): self is WorkerGlobalScopeInterface;
export declare function parseCacheControl(cacheControl: string): any;
export declare function isSafari(scope: any): boolean;
export declare function storageAvailable(type: string): boolean;
export declare function b64EncodeUnicode(str: string): string;
export declare function b64DecodeUnicode(str: string): string;
export declare function isImageBitmap(image: any): image is ImageBitmap;
export declare const arrayBufferToImageBitmap: (data: ArrayBuffer) => Promise<ImageBitmap>;
export declare const arrayBufferToImage: (data: ArrayBuffer) => Promise<HTMLImageElement>;
export declare function readImageUsingVideoFrame(image: HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas, x: number, y: number, width: number, height: number): Promise<Uint8ClampedArray>;
export declare function readImageDataUsingOffscreenCanvas(imgBitmap: HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas, x: number, y: number, width: number, height: number): Uint8ClampedArray;
export declare function getImageData(image: HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas, x: number, y: number, width: number, height: number): Promise<Uint8ClampedArray>;
export interface Subscription {
    unsubscribe(): void;
}
export interface Subscriber {
    addEventListener: typeof window.addEventListener;
    removeEventListener: typeof window.removeEventListener;
}
export declare function subscribe(target: Subscriber, message: keyof WindowEventMap, listener: (...args: any) => void, options: boolean | AddEventListenerOptions): Subscription;
export declare function degreesToRadians(degrees: number): number;
export declare function radiansToDegrees(degrees: number): number;
export type RollPitchBearing = {
    roll: number;
    pitch: number;
    bearing: number;
};
export declare function rollPitchBearingEqual(a: RollPitchBearing, b: RollPitchBearing): boolean;
export declare function getRollPitchBearing(rotation: quat): RollPitchBearing;
export declare function getAngleDelta(lastPoint: Point, currentPoint: Point, center: Point): number;
export declare function rollPitchBearingToQuat(roll: number, pitch: number, bearing: number): quat;
export type Complete<T> = {
    [P in keyof Required<T>]: Pick<T, P> extends Required<Pick<T, P>> ? T[P] : (T[P] | undefined);
};
export type RequireAtLeastOne<T> = {
    [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>;
}[keyof T];
export type TileJSON = {
    tilejson: '2.2.0' | '2.1.0' | '2.0.1' | '2.0.0' | '1.0.0';
    name?: string;
    description?: string;
    version?: string;
    attribution?: string;
    template?: string;
    tiles: Array<string>;
    grids?: Array<string>;
    data?: Array<string>;
    minzoom?: number;
    maxzoom?: number;
    bounds?: [number, number, number, number];
    center?: [number, number, number];
    vector_layers: [{
        id: string;
    }];
};
export declare const MAX_TILE_ZOOM = 25;
export declare const MIN_TILE_ZOOM = 0;
export declare const MAX_VALID_LATITUDE = 85.051129;
export declare function isTouchableEvent(event: Event, eventType: string): event is TouchEvent;
export declare function isPointableEvent(event: Event, eventType: string): event is MouseEvent;
export declare function isTouchableOrPointableType(eventType: string): boolean;
export {};
//# sourceMappingURL=util.d.ts.map