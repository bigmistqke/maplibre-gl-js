import Point from '@mapbox/point-geometry';
export class TransformProvider {
    constructor(map) {
        this._map = map;
    }
    get transform() {
        return this._map._requestedCameraState || this._map.transform;
    }
    get center() {
        return { lng: this.transform.center.lng, lat: this.transform.center.lat };
    }
    get zoom() {
        return this.transform.zoom;
    }
    get pitch() {
        return this.transform.pitch;
    }
    get bearing() {
        return this.transform.bearing;
    }
    unproject(point) {
        return this.transform.screenPointToLocation(Point.convert(point), this._map.terrain);
    }
}
//# sourceMappingURL=transform-provider.js.map