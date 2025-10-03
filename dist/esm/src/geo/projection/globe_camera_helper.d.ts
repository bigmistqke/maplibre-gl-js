import type Point from '@mapbox/point-geometry';
import type { CameraForBoxAndBearingHandlerResult, EaseToHandlerResult, EaseToHandlerOptions, FlyToHandlerResult, FlyToHandlerOptions, ICameraHelper, MapControlsDeltas } from './camera_helper';
import type { LngLat, LngLatLike } from '../lng_lat';
import type { IReadonlyTransform, ITransform } from '../transform_interface';
import type { GlobeProjection } from './globe_projection';
import type { CameraForBoundsOptions } from '../../ui/camera';
import type { LngLatBounds } from '../lng_lat_bounds';
import type { PaddingOptions } from '../edge_insets';
export declare class GlobeCameraHelper implements ICameraHelper {
    private _globe;
    private _mercatorCameraHelper;
    private _verticalPerspectiveCameraHelper;
    constructor(globe: GlobeProjection);
    get useGlobeControls(): boolean;
    get currentHelper(): ICameraHelper;
    handlePanInertia(pan: Point, transform: IReadonlyTransform): {
        easingCenter: LngLat;
        easingOffset: Point;
    };
    handleMapControlsRollPitchBearingZoom(deltas: MapControlsDeltas, tr: ITransform): void;
    handleMapControlsPan(deltas: MapControlsDeltas, tr: ITransform, preZoomAroundLoc: LngLat): void;
    cameraForBoxAndBearing(options: CameraForBoundsOptions, padding: PaddingOptions, bounds: LngLatBounds, bearing: number, tr: ITransform): CameraForBoxAndBearingHandlerResult;
    handleJumpToCenterZoom(tr: ITransform, options: {
        zoom?: number;
        center?: LngLatLike;
    }): void;
    handleEaseTo(tr: ITransform, options: EaseToHandlerOptions): EaseToHandlerResult;
    handleFlyTo(tr: ITransform, options: FlyToHandlerOptions): FlyToHandlerResult;
}
//# sourceMappingURL=globe_camera_helper.d.ts.map