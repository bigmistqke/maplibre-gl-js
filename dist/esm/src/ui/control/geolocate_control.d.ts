import { Evented } from '../../util/evented';
import { Marker } from '../marker';
import type { Map } from '../map';
import type { FitBoundsOptions } from '../camera';
import type { IControl } from './control';
export type GeolocateControlOptions = {
    positionOptions?: PositionOptions;
    fitBoundsOptions?: FitBoundsOptions;
    trackUserLocation?: boolean;
    showAccuracyCircle?: boolean;
    showUserLocation?: boolean;
};
export declare class GeolocateControl extends Evented implements IControl {
    _map: Map;
    options: GeolocateControlOptions;
    _container: HTMLElement;
    _dotElement: HTMLElement;
    _circleElement: HTMLElement;
    _geolocateButton: HTMLButtonElement;
    _geolocationWatchID: number;
    _timeoutId: ReturnType<typeof setTimeout>;
    _watchState: 'OFF' | 'ACTIVE_LOCK' | 'WAITING_ACTIVE' | 'ACTIVE_ERROR' | 'BACKGROUND' | 'BACKGROUND_ERROR';
    _lastKnownPosition: any;
    _userLocationDotMarker: Marker;
    _accuracyCircleMarker: Marker;
    _accuracy: number;
    _setup: boolean;
    constructor(options: GeolocateControlOptions);
    onAdd(map: Map): HTMLElement;
    onRemove(): void;
    _isOutOfMapMaxBounds(position: GeolocationPosition): boolean;
    _setErrorState(): void;
    _onSuccess: (position: GeolocationPosition) => void;
    _updateCamera: (position: GeolocationPosition) => void;
    _updateMarker: (position?: GeolocationPosition | null) => void;
    _updateCircleRadiusIfNeeded(): void;
    _onUpdate: () => void;
    _onError: (error: GeolocationPositionError) => void;
    _finish: () => void;
    _setupUI: () => void;
    _finishSetupUI: (supported: boolean) => void;
    trigger(): boolean;
    _clearWatch(): void;
}
//# sourceMappingURL=geolocate_control.d.ts.map