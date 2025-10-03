import Point from '@mapbox/point-geometry';
import { type IReadonlyTransform, type ITransform } from '../transform_interface';
import { type LngLat, type LngLatLike } from '../lng_lat';
import { type CameraForBoundsOptions, type PointLike } from '../../ui/camera';
import { type PaddingOptions } from '../edge_insets';
import { type LngLatBounds } from '../lng_lat_bounds';
import { type RollPitchBearing } from '../../util/util';
export type MapControlsDeltas = {
    panDelta: Point;
    zoomDelta: number;
    bearingDelta: number;
    pitchDelta: number;
    rollDelta: number;
    around: Point;
};
export type CameraForBoxAndBearingHandlerResult = {
    center: LngLat;
    zoom: number;
    bearing: number;
};
export type EaseToHandlerOptions = {
    bearing: number;
    pitch: number;
    roll: number;
    padding: PaddingOptions;
    offsetAsPoint: Point;
    around?: LngLat;
    aroundPoint?: Point;
    center?: LngLatLike;
    zoom?: number;
    offset?: PointLike;
};
export type EaseToHandlerResult = {
    easeFunc: (k: number) => void;
    elevationCenter: LngLat;
    isZooming: boolean;
};
export type FlyToHandlerOptions = {
    bearing: number;
    pitch: number;
    roll: number;
    padding: PaddingOptions;
    offsetAsPoint: Point;
    center?: LngLatLike;
    locationAtOffset: LngLat;
    zoom?: number;
    minZoom?: number;
};
export type FlyToHandlerResult = {
    easeFunc: (k: number, scale: number, centerFactor: number, pointAtOffset: Point) => void;
    scaleOfZoom: number;
    scaleOfMinZoom?: number;
    targetCenter: LngLat;
    pixelPathLength: number;
};
export type UpdateRotationArgs = {
    startEulerAngles: RollPitchBearing;
    endEulerAngles: RollPitchBearing;
    tr: ITransform;
    k: number;
    useSlerp: boolean;
};
export declare function cameraBoundsWarning(): void;
export interface ICameraHelper {
    get useGlobeControls(): boolean;
    handlePanInertia(pan: Point, transform: IReadonlyTransform): {
        easingCenter: LngLat;
        easingOffset: Point;
    };
    handleMapControlsRollPitchBearingZoom(deltas: MapControlsDeltas, tr: ITransform): void;
    handleMapControlsPan(deltas: MapControlsDeltas, tr: ITransform, preZoomAroundLoc: LngLat): void;
    cameraForBoxAndBearing(options: CameraForBoundsOptions, padding: PaddingOptions, bounds: LngLatBounds, bearing: number, tr: IReadonlyTransform): CameraForBoxAndBearingHandlerResult;
    handleJumpToCenterZoom(tr: ITransform, options: {
        zoom?: number;
        center?: LngLatLike;
    }): void;
    handleEaseTo(tr: ITransform, options: EaseToHandlerOptions): EaseToHandlerResult;
    handleFlyTo(tr: ITransform, options: FlyToHandlerOptions): FlyToHandlerResult;
}
export declare function updateRotation(args: UpdateRotationArgs): void;
export declare function cameraForBoxAndBearing(options: CameraForBoundsOptions, padding: PaddingOptions, bounds: LngLatBounds, bearing: number, tr: IReadonlyTransform): CameraForBoxAndBearingHandlerResult;
//# sourceMappingURL=camera_helper.d.ts.map