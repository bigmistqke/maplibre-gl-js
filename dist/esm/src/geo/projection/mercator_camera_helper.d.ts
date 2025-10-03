import type Point from '@mapbox/point-geometry';
import { LngLat, type LngLatLike } from '../lng_lat';
import { type CameraForBoxAndBearingHandlerResult, type EaseToHandlerResult, type EaseToHandlerOptions, type FlyToHandlerResult, type FlyToHandlerOptions, type ICameraHelper, type MapControlsDeltas } from './camera_helper';
import type { IReadonlyTransform, ITransform } from '../transform_interface';
import type { CameraForBoundsOptions } from '../../ui/camera';
import type { PaddingOptions } from '../edge_insets';
import type { LngLatBounds } from '../lng_lat_bounds';
export declare class MercatorCameraHelper implements ICameraHelper {
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
//# sourceMappingURL=mercator_camera_helper.d.ts.map