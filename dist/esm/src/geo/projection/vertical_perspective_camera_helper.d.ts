import Point from '@mapbox/point-geometry';
import { type CameraForBoxAndBearingHandlerResult, type EaseToHandlerResult, type EaseToHandlerOptions, type FlyToHandlerResult, type FlyToHandlerOptions, type ICameraHelper, type MapControlsDeltas } from './camera_helper';
import { LngLat, type LngLatLike } from '../lng_lat';
import type { IReadonlyTransform, ITransform } from '../transform_interface';
import type { CameraForBoundsOptions } from '../../ui/camera';
import type { LngLatBounds } from '../lng_lat_bounds';
import type { PaddingOptions } from '../edge_insets';
export declare class VerticalPerspectiveCameraHelper implements ICameraHelper {
    get useGlobeControls(): boolean;
    handlePanInertia(pan: Point, transform: IReadonlyTransform): {
        easingCenter: LngLat;
        easingOffset: Point;
    };
    handleMapControlsRollPitchBearingZoom(deltas: MapControlsDeltas, tr: ITransform): void;
    handleMapControlsPan(deltas: MapControlsDeltas, tr: ITransform, _preZoomAroundLoc: LngLat): void;
    cameraForBoxAndBearing(options: CameraForBoundsOptions, padding: PaddingOptions, bounds: LngLatBounds, bearing: number, tr: ITransform): CameraForBoxAndBearingHandlerResult;
    handleJumpToCenterZoom(tr: ITransform, options: {
        zoom?: number;
        center?: LngLatLike;
    }): void;
    handleEaseTo(tr: ITransform, options: EaseToHandlerOptions): EaseToHandlerResult;
    handleFlyTo(tr: ITransform, options: FlyToHandlerOptions): FlyToHandlerResult;
    private static solveVectorScale;
    private static getLesserNonNegativeNonNull;
}
//# sourceMappingURL=vertical_perspective_camera_helper.d.ts.map