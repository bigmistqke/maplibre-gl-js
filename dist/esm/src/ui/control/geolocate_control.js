import { Event, Evented } from '../../util/evented';
import { DOM } from '../../util/dom';
import { extend, warnOnce } from '../../util/util';
import { checkGeolocationSupport } from '../../util/geolocation_support';
import { LngLat } from '../../geo/lng_lat';
import { Marker } from '../marker';
import { LngLatBounds } from '../../geo/lng_lat_bounds';
const defaultOptions = {
    positionOptions: {
        enableHighAccuracy: false,
        maximumAge: 0,
        timeout: 6000
    },
    fitBoundsOptions: {
        maxZoom: 15
    },
    trackUserLocation: false,
    showAccuracyCircle: true,
    showUserLocation: true
};
let numberOfWatches = 0;
let noTimeout = false;
export class GeolocateControl extends Evented {
    constructor(options) {
        super();
        this._onSuccess = (position) => {
            if (!this._map) {
                return;
            }
            if (this._isOutOfMapMaxBounds(position)) {
                this._setErrorState();
                this.fire(new Event('outofmaxbounds', position));
                this._updateMarker();
                this._finish();
                return;
            }
            if (this.options.trackUserLocation) {
                this._lastKnownPosition = position;
                switch (this._watchState) {
                    case 'WAITING_ACTIVE':
                    case 'ACTIVE_LOCK':
                    case 'ACTIVE_ERROR':
                        this._watchState = 'ACTIVE_LOCK';
                        this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-waiting');
                        this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-active-error');
                        this._geolocateButton.classList.add('maplibregl-ctrl-geolocate-active');
                        break;
                    case 'BACKGROUND':
                    case 'BACKGROUND_ERROR':
                        this._watchState = 'BACKGROUND';
                        this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-waiting');
                        this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-background-error');
                        this._geolocateButton.classList.add('maplibregl-ctrl-geolocate-background');
                        break;
                    default:
                        throw new Error(`Unexpected watchState ${this._watchState}`);
                }
            }
            if (this.options.showUserLocation && this._watchState !== 'OFF') {
                this._updateMarker(position);
            }
            if (!this.options.trackUserLocation || this._watchState === 'ACTIVE_LOCK') {
                this._updateCamera(position);
            }
            if (this.options.showUserLocation) {
                this._dotElement.classList.remove('maplibregl-user-location-dot-stale');
            }
            this.fire(new Event('geolocate', position));
            this._finish();
        };
        this._updateCamera = (position) => {
            const center = new LngLat(position.coords.longitude, position.coords.latitude);
            const radius = position.coords.accuracy;
            const bearing = this._map.getBearing();
            const options = extend({ bearing }, this.options.fitBoundsOptions);
            const newBounds = LngLatBounds.fromLngLat(center, radius);
            this._map.fitBounds(newBounds, options, {
                geolocateSource: true
            });
        };
        this._updateMarker = (position) => {
            if (position) {
                const center = new LngLat(position.coords.longitude, position.coords.latitude);
                this._accuracyCircleMarker.setLngLat(center).addTo(this._map);
                this._userLocationDotMarker.setLngLat(center).addTo(this._map);
                this._accuracy = position.coords.accuracy;
                this._updateCircleRadiusIfNeeded();
            }
            else {
                this._userLocationDotMarker.remove();
                this._accuracyCircleMarker.remove();
            }
        };
        this._onUpdate = () => {
            this._updateCircleRadiusIfNeeded();
        };
        this._onError = (error) => {
            if (!this._map) {
                return;
            }
            if (error.code === 1) {
                this._watchState = 'OFF';
                this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-waiting');
                this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-active');
                this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-active-error');
                this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-background');
                this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-background-error');
                this._geolocateButton.disabled = true;
                const title = this._map._getUIString('GeolocateControl.LocationNotAvailable');
                this._geolocateButton.title = title;
                this._geolocateButton.setAttribute('aria-label', title);
                if (this._geolocationWatchID !== undefined) {
                    this._clearWatch();
                }
            }
            else if (error.code === 3 && noTimeout) {
                return;
            }
            else if (this.options.trackUserLocation) {
                this._setErrorState();
            }
            if (this._watchState !== 'OFF' && this.options.showUserLocation) {
                this._dotElement.classList.add('maplibregl-user-location-dot-stale');
            }
            this.fire(new Event('error', error));
            this._finish();
        };
        this._finish = () => {
            if (this._timeoutId) {
                clearTimeout(this._timeoutId);
            }
            this._timeoutId = undefined;
        };
        this._setupUI = () => {
            if (!this._map) {
                return;
            }
            this._container.addEventListener('contextmenu', (e) => e.preventDefault());
            this._geolocateButton = DOM.create('button', 'maplibregl-ctrl-geolocate', this._container);
            DOM.create('span', 'maplibregl-ctrl-icon', this._geolocateButton).setAttribute('aria-hidden', 'true');
            this._geolocateButton.type = 'button';
            this._geolocateButton.disabled = true;
        };
        this._finishSetupUI = (supported) => {
            if (!this._map) {
                return;
            }
            if (supported === false) {
                warnOnce('Geolocation support is not available so the GeolocateControl will be disabled.');
                const title = this._map._getUIString('GeolocateControl.LocationNotAvailable');
                this._geolocateButton.disabled = true;
                this._geolocateButton.title = title;
                this._geolocateButton.setAttribute('aria-label', title);
            }
            else {
                const title = this._map._getUIString('GeolocateControl.FindMyLocation');
                this._geolocateButton.disabled = false;
                this._geolocateButton.title = title;
                this._geolocateButton.setAttribute('aria-label', title);
            }
            if (this.options.trackUserLocation) {
                this._geolocateButton.setAttribute('aria-pressed', 'false');
                this._watchState = 'OFF';
            }
            if (this.options.showUserLocation) {
                this._dotElement = DOM.create('div', 'maplibregl-user-location-dot');
                this._userLocationDotMarker = new Marker({ element: this._dotElement });
                this._circleElement = DOM.create('div', 'maplibregl-user-location-accuracy-circle');
                this._accuracyCircleMarker = new Marker({ element: this._circleElement, pitchAlignment: 'map' });
                if (this.options.trackUserLocation)
                    this._watchState = 'OFF';
                this._map.on('zoom', this._onUpdate);
                this._map.on('move', this._onUpdate);
                this._map.on('rotate', this._onUpdate);
                this._map.on('pitch', this._onUpdate);
            }
            this._geolocateButton.addEventListener('click', () => this.trigger());
            this._setup = true;
            if (this.options.trackUserLocation) {
                this._map.on('movestart', (event) => {
                    const fromResize = (event === null || event === void 0 ? void 0 : event[0]) instanceof ResizeObserverEntry;
                    if (!event.geolocateSource && this._watchState === 'ACTIVE_LOCK' && !fromResize && !this._map.isZooming()) {
                        this._watchState = 'BACKGROUND';
                        this._geolocateButton.classList.add('maplibregl-ctrl-geolocate-background');
                        this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-active');
                        this.fire(new Event('trackuserlocationend'));
                        this.fire(new Event('userlocationlostfocus'));
                    }
                });
            }
        };
        this.options = extend({}, defaultOptions, options);
    }
    onAdd(map) {
        this._map = map;
        this._container = DOM.create('div', 'maplibregl-ctrl maplibregl-ctrl-group');
        this._setupUI();
        checkGeolocationSupport().then((supported) => this._finishSetupUI(supported));
        return this._container;
    }
    onRemove() {
        if (this._geolocationWatchID !== undefined) {
            window.navigator.geolocation.clearWatch(this._geolocationWatchID);
            this._geolocationWatchID = undefined;
        }
        if (this.options.showUserLocation && this._userLocationDotMarker) {
            this._userLocationDotMarker.remove();
        }
        if (this.options.showAccuracyCircle && this._accuracyCircleMarker) {
            this._accuracyCircleMarker.remove();
        }
        DOM.remove(this._container);
        this._map.off('zoom', this._onUpdate);
        this._map.off('move', this._onUpdate);
        this._map.off('rotate', this._onUpdate);
        this._map.off('pitch', this._onUpdate);
        this._map = undefined;
        numberOfWatches = 0;
        noTimeout = false;
    }
    _isOutOfMapMaxBounds(position) {
        const bounds = this._map.getMaxBounds();
        const coordinates = position.coords;
        return bounds && (coordinates.longitude < bounds.getWest() ||
            coordinates.longitude > bounds.getEast() ||
            coordinates.latitude < bounds.getSouth() ||
            coordinates.latitude > bounds.getNorth());
    }
    _setErrorState() {
        switch (this._watchState) {
            case 'WAITING_ACTIVE':
                this._watchState = 'ACTIVE_ERROR';
                this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-active');
                this._geolocateButton.classList.add('maplibregl-ctrl-geolocate-active-error');
                break;
            case 'ACTIVE_LOCK':
                this._watchState = 'ACTIVE_ERROR';
                this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-active');
                this._geolocateButton.classList.add('maplibregl-ctrl-geolocate-active-error');
                this._geolocateButton.classList.add('maplibregl-ctrl-geolocate-waiting');
                break;
            case 'BACKGROUND':
                this._watchState = 'BACKGROUND_ERROR';
                this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-background');
                this._geolocateButton.classList.add('maplibregl-ctrl-geolocate-background-error');
                this._geolocateButton.classList.add('maplibregl-ctrl-geolocate-waiting');
                break;
            case 'ACTIVE_ERROR':
                break;
            default:
                throw new Error(`Unexpected watchState ${this._watchState}`);
        }
    }
    _updateCircleRadiusIfNeeded() {
        const userLocation = this._userLocationDotMarker.getLngLat();
        if (!this.options.showUserLocation || !this.options.showAccuracyCircle || !this._accuracy || !userLocation) {
            return;
        }
        const screenPosition = this._map.project(userLocation);
        const userLocationWith100Px = this._map.unproject([screenPosition.x + 100, screenPosition.y]);
        const pixelsToMeters = userLocation.distanceTo(userLocationWith100Px) / 100;
        const circleDiameter = 2 * this._accuracy / pixelsToMeters;
        this._circleElement.style.width = `${circleDiameter.toFixed(2)}px`;
        this._circleElement.style.height = `${circleDiameter.toFixed(2)}px`;
    }
    trigger() {
        if (!this._setup) {
            warnOnce('Geolocate control triggered before added to a map');
            return false;
        }
        if (this.options.trackUserLocation) {
            switch (this._watchState) {
                case 'OFF':
                    this._watchState = 'WAITING_ACTIVE';
                    this.fire(new Event('trackuserlocationstart'));
                    break;
                case 'WAITING_ACTIVE':
                case 'ACTIVE_LOCK':
                case 'ACTIVE_ERROR':
                case 'BACKGROUND_ERROR':
                    numberOfWatches--;
                    noTimeout = false;
                    this._watchState = 'OFF';
                    this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-waiting');
                    this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-active');
                    this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-active-error');
                    this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-background');
                    this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-background-error');
                    this.fire(new Event('trackuserlocationend'));
                    break;
                case 'BACKGROUND':
                    this._watchState = 'ACTIVE_LOCK';
                    this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-background');
                    if (this._lastKnownPosition)
                        this._updateCamera(this._lastKnownPosition);
                    this.fire(new Event('trackuserlocationstart'));
                    this.fire(new Event('userlocationfocus'));
                    break;
                default:
                    throw new Error(`Unexpected watchState ${this._watchState}`);
            }
            switch (this._watchState) {
                case 'WAITING_ACTIVE':
                    this._geolocateButton.classList.add('maplibregl-ctrl-geolocate-waiting');
                    this._geolocateButton.classList.add('maplibregl-ctrl-geolocate-active');
                    break;
                case 'ACTIVE_LOCK':
                    this._geolocateButton.classList.add('maplibregl-ctrl-geolocate-active');
                    break;
                case 'OFF':
                    break;
                default:
                    throw new Error(`Unexpected watchState ${this._watchState}`);
            }
            if (this._watchState === 'OFF' && this._geolocationWatchID !== undefined) {
                this._clearWatch();
            }
            else if (this._geolocationWatchID === undefined) {
                this._geolocateButton.classList.add('maplibregl-ctrl-geolocate-waiting');
                this._geolocateButton.setAttribute('aria-pressed', 'true');
                numberOfWatches++;
                let positionOptions;
                if (numberOfWatches > 1) {
                    positionOptions = { maximumAge: 600000, timeout: 0 };
                    noTimeout = true;
                }
                else {
                    positionOptions = this.options.positionOptions;
                    noTimeout = false;
                }
                this._geolocationWatchID = window.navigator.geolocation.watchPosition(this._onSuccess, this._onError, positionOptions);
            }
        }
        else {
            window.navigator.geolocation.getCurrentPosition(this._onSuccess, this._onError, this.options.positionOptions);
            this._timeoutId = setTimeout(this._finish, 10000);
        }
        return true;
    }
    _clearWatch() {
        window.navigator.geolocation.clearWatch(this._geolocationWatchID);
        this._geolocationWatchID = undefined;
        this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-waiting');
        this._geolocateButton.setAttribute('aria-pressed', 'false');
        if (this.options.showUserLocation) {
            this._updateMarker(null);
        }
    }
}
//# sourceMappingURL=geolocate_control.js.map