import { LngLat } from '../geo/lng_lat';
import Point from '@mapbox/point-geometry';
import { Evented } from '../util/evented';
import type { Terrain } from '../render/terrain';
import type { ITransform } from '../geo/transform_interface';
import type { LngLatLike } from '../geo/lng_lat';
import type { LngLatBoundsLike } from '../geo/lng_lat_bounds';
import type { TaskID } from '../util/task_queue';
import type { PaddingOptions } from '../geo/edge_insets';
import type { HandlerManager } from './handler_manager';
import type { ICameraHelper } from '../geo/projection/camera_helper';
export type PointLike = Point | [number, number];
export type CameraOptions = CenterZoomBearing & {
    pitch?: number;
    roll?: number;
    elevation?: number;
};
export type CenterZoomBearing = {
    center?: LngLatLike;
    zoom?: number;
    bearing?: number;
};
export type JumpToOptions = CameraOptions & {
    padding?: PaddingOptions;
};
export type CameraForBoundsOptions = CameraOptions & {
    padding?: number | PaddingOptions;
    offset?: PointLike;
    maxZoom?: number;
};
export type FlyToOptions = AnimationOptions & CameraOptions & {
    curve?: number;
    minZoom?: number;
    speed?: number;
    screenSpeed?: number;
    maxDuration?: number;
    padding?: number | PaddingOptions;
};
export type EaseToOptions = AnimationOptions & CameraOptions & {
    delayEndEvents?: number;
    padding?: number | PaddingOptions;
    around?: LngLatLike;
    easeId?: string;
    noMoveStart?: boolean;
};
export type FitBoundsOptions = FlyToOptions & {
    linear?: boolean;
    offset?: PointLike;
    maxZoom?: number;
};
export type AnimationOptions = {
    duration?: number;
    easing?: (_: number) => number;
    offset?: PointLike;
    animate?: boolean;
    essential?: boolean;
    freezeElevation?: boolean;
};
export type CameraUpdateTransformFunction = (next: {
    center: LngLat;
    zoom: number;
    roll: number;
    pitch: number;
    bearing: number;
    elevation: number;
}) => {
    center?: LngLat;
    zoom?: number;
    roll?: number;
    pitch?: number;
    bearing?: number;
    elevation?: number;
};
export declare abstract class Camera extends Evented {
    transform: ITransform;
    cameraHelper: ICameraHelper;
    terrain: Terrain;
    handlers: HandlerManager;
    _moving: boolean;
    _zooming: boolean;
    _rotating: boolean;
    _pitching: boolean;
    _rolling: boolean;
    _padding: boolean;
    _bearingSnap: number;
    _easeStart: number;
    _easeOptions: {
        duration?: number;
        easing?: (_: number) => number;
    };
    _easeId: string | void;
    _onEaseFrame: (_: number) => void;
    _onEaseEnd: (easeId?: string) => void;
    _easeFrameId: TaskID;
    _elevationCenter: LngLat;
    _elevationTarget: number;
    _elevationStart: number;
    _elevationFreeze: boolean;
    _requestedCameraState?: ITransform;
    transformCameraUpdate: CameraUpdateTransformFunction | null;
    _centerClampedToGround: boolean;
    abstract _requestRenderFrame(a: () => void): TaskID;
    abstract _cancelRenderFrame(_: TaskID): void;
    constructor(transform: ITransform, cameraHelper: ICameraHelper, options: {
        bearingSnap: number;
    });
    migrateProjection(newTransform: ITransform, newCameraHelper: ICameraHelper): void;
    getCenter(): LngLat;
    setCenter(center: LngLatLike, eventData?: any): this;
    getCenterElevation(): number;
    setCenterElevation(elevation: number, eventData?: any): this;
    getCenterClampedToGround(): boolean;
    setCenterClampedToGround(centerClampedToGround: boolean): void;
    panBy(offset: PointLike, options?: EaseToOptions, eventData?: any): this;
    panTo(lnglat: LngLatLike, options?: EaseToOptions, eventData?: any): this;
    getZoom(): number;
    setZoom(zoom: number, eventData?: any): this;
    zoomTo(zoom: number, options?: EaseToOptions | null, eventData?: any): this;
    zoomIn(options?: AnimationOptions, eventData?: any): this;
    zoomOut(options?: AnimationOptions, eventData?: any): this;
    getVerticalFieldOfView(): number;
    setVerticalFieldOfView(fov: number, eventData?: any): this;
    getBearing(): number;
    setBearing(bearing: number, eventData?: any): this;
    getPadding(): PaddingOptions;
    setPadding(padding: PaddingOptions, eventData?: any): this;
    rotateTo(bearing: number, options?: EaseToOptions, eventData?: any): this;
    resetNorth(options?: AnimationOptions, eventData?: any): this;
    resetNorthPitch(options?: AnimationOptions, eventData?: any): this;
    snapToNorth(options?: AnimationOptions, eventData?: any): this;
    getPitch(): number;
    setPitch(pitch: number, eventData?: any): this;
    getRoll(): number;
    setRoll(roll: number, eventData?: any): this;
    cameraForBounds(bounds: LngLatBoundsLike, options?: CameraForBoundsOptions): CenterZoomBearing | undefined;
    _cameraForBoxAndBearing(p0: LngLatLike, p1: LngLatLike, bearing: number, options?: CameraForBoundsOptions): CenterZoomBearing | undefined;
    fitBounds(bounds: LngLatBoundsLike, options?: FitBoundsOptions, eventData?: any): this;
    fitScreenCoordinates(p0: PointLike, p1: PointLike, bearing: number, options?: FitBoundsOptions, eventData?: any): this;
    _fitInternal(calculatedOptions?: CenterZoomBearing, options?: FitBoundsOptions, eventData?: any): this;
    jumpTo(options: JumpToOptions, eventData?: any): this;
    calculateCameraOptionsFromTo(from: LngLatLike, altitudeFrom: number, to: LngLatLike, altitudeTo?: number): CameraOptions;
    calculateCameraOptionsFromCameraLngLatAltRotation(cameraLngLat: LngLatLike, cameraAlt: number, bearing: number, pitch: number, roll?: number): CameraOptions;
    easeTo(options: EaseToOptions, eventData?: any): this;
    _prepareEase(eventData: any, noMoveStart: boolean, currently?: {
        moving?: boolean;
        zooming?: boolean;
        rotating?: boolean;
        pitching?: boolean;
        rolling?: boolean;
    }): void;
    _prepareElevation(center: LngLat): void;
    _updateElevation(k: number): void;
    _finalizeElevation(): void;
    _getTransformForUpdate(): ITransform;
    _elevateCameraIfInsideTerrain(tr: ITransform): {
        pitch?: number;
        zoom?: number;
    };
    _applyUpdatedTransform(tr: ITransform): void;
    _fireMoveEvents(eventData?: any): void;
    _afterEase(eventData?: any, easeId?: string): void;
    flyTo(options: FlyToOptions, eventData?: any): this;
    isEasing(): boolean;
    stop(): this;
    _stop(allowGestures?: boolean, easeId?: string): this;
    _ease(frame: (_: number) => void, finish: () => void, options: {
        animate?: boolean;
        duration?: number;
        easing?: (_: number) => number;
    }): void;
    _renderFrameCallback: () => void;
    _normalizeBearing(bearing: number, currentBearing: number): number;
    queryTerrainElevation(lngLatLike: LngLatLike): number | null;
}
//# sourceMappingURL=camera.d.ts.map